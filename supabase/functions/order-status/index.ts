// Loom Lah – order-status
// Self-contained Supabase Edge Function. Deploy with "Verify JWT" turned OFF.
// Secrets used (Supabase > Edge Functions > Secrets): ALLOWED_ORIGINS, HITPAY_API_KEY, HITPAY_ENV
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOWED.length === 0 ? "*" : (ALLOWED.includes(origin) ? origin : ALLOWED[0]);
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function reply(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
function serveJson(handler: (body: any, req: Request) => Promise<unknown>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
    if (req.method !== "POST") return reply(req, { error: "Method not allowed" }, 405);
    let body: unknown;
    try { body = await req.json(); } catch { return reply(req, { error: "Invalid request" }, 400); }
    try {
      return reply(req, await handler(body ?? {}, req));
    } catch (e) {
      if (e instanceof HttpError) return reply(req, { error: e.message }, e.status);
      console.error(e);
      return reply(req, { error: "Something went wrong. Please try again." }, 500);
    }
  });
}

const normEmail = (v: unknown) => String(v ?? "").trim().toLowerCase();
const normOrder = (v: unknown) => String(v ?? "").trim().toUpperCase();
const cents = (v: unknown) => Math.round(Number(v) * 100);

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const HITPAY_API = (Deno.env.get("HITPAY_ENV") ?? "sandbox") === "production"
  ? "https://api.hit-pay.com"
  : "https://api.sandbox.hit-pay.com";

function hitpayHeaders(): Record<string, string> {
  return {
    "X-BUSINESS-API-KEY": Deno.env.get("HITPAY_API_KEY") ?? "",
    "X-Requested-With": "XMLHttpRequest",
  };
}

// Fallback check used when a webhook hasn't arrived yet.
async function fetchPaymentRequest(id: string): Promise<{ status?: string; amount?: string } | null> {
  try {
    const r = await fetch(`${HITPAY_API}/v1/payment-requests/${encodeURIComponent(id)}`, { headers: hitpayHeaders() });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

serveJson(async (body) => {
  const orderNo = normOrder(body.order_no);
  const token = String(body.token ?? "");
  const email = normEmail(body.email);
  if (!orderNo || (!token && !email)) throw new HttpError(400, "Enter your order number and email.");

  const { data: order, error } = await db.from("orders")
    .select("order_no, email, items, delivery_fee, total, status, created_at, paid_at, hitpay_request_id, lookup_token")
    .eq("order_no", orderNo).maybeSingle();
  if (error) throw error;
  const ok = order && ((token && safeEqual(token, order.lookup_token)) || (email && normEmail(order.email) === email));
  if (!ok) throw new HttpError(404, "We couldn't find an order with those details.");

  // If the webhook hasn't arrived yet, ask HitPay directly.
  if (order.status === "pending" && order.hitpay_request_id &&
      Date.now() - new Date(order.created_at).getTime() > 15_000) {
    const pr = await fetchPaymentRequest(order.hitpay_request_id);
    if (pr && String(pr.status).toLowerCase() === "completed" &&
        (pr.amount == null || cents(pr.amount) === cents(order.total))) {
      await db.from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("order_no", orderNo);
      order.status = "paid";
    }
  }

  return {
    order_no: order.order_no,
    status: order.status,
    total: Number(order.total),
    delivery_fee: Number(order.delivery_fee),
    items: order.items,
    created_at: order.created_at,
  };
});
