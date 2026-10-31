// Loom Lah – hitpay-webhook
// Self-contained Supabase Edge Function. Deploy with "Verify JWT" turned OFF.
// Secrets used (Supabase > Edge Functions > Secrets): HITPAY_WEBHOOK_SALT
import { createClient } from "npm:@supabase/supabase-js@2";

// Register this function's URL in HitPay > Developers > Webhook Endpoints,
// subscribed to payment_request.completed and payment_request.failed.
// Paste that endpoint's salt into the HITPAY_WEBHOOK_SALT secret.

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

async function hmacHex(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const cents = (v: unknown) => Math.round(Number(v) * 100);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const raw = await req.text();
  const salt = Deno.env.get("HITPAY_WEBHOOK_SALT") ?? "";
  const given = (req.headers.get("hitpay-signature") ?? "").trim().toLowerCase();
  if (!salt || !given || !safeEqual(await hmacHex(salt, raw), given)) {
    console.warn("Rejected webhook: bad signature");
    return new Response("Invalid signature", { status: 401 });
  }

  // deno-lint-ignore no-explicit-any
  let p: any;
  try { p = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }

  const ref = String(p.reference_number ?? "").trim().toUpperCase();
  if (!ref) return new Response("Ignored: no reference", { status: 200 });

  const { data: order } = await db.from("orders")
    .select("order_no, total, status, hitpay_request_id").eq("order_no", ref).maybeSingle();
  if (!order) return new Response("Ignored: unknown order", { status: 200 });

  const status = String(p.status ?? "").toLowerCase();
  const payments: Array<{ status?: string }> = Array.isArray(p.payments) ? p.payments : [];
  const succeeded = status === "completed" ||
    payments.some((x) => ["succeeded", "completed"].includes(String(x.status ?? "").toLowerCase()));

  if (succeeded) {
    if (p.amount != null && cents(p.amount) !== cents(order.total)) {
      console.error(`Amount mismatch for ${ref}: paid ${p.amount}, expected ${order.total}`);
      return new Response("Amount mismatch", { status: 200 });
    }
    if (order.status !== "paid") {
      await db.from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("order_no", ref);
    }
  } else if (status === "failed" && order.status === "pending") {
    await db.from("orders").update({ status: "failed" }).eq("order_no", ref);
  }
  return new Response("ok", { status: 200 });
});
