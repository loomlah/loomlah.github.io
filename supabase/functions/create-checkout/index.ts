// Loom Lah – create-checkout
// Self-contained Supabase Edge Function. Deploy with "Verify JWT" turned OFF.
// Secrets used (Supabase > Edge Functions > Secrets): SITE_URL, ALLOWED_ORIGINS, HITPAY_API_KEY, HITPAY_ENV, HITPAY_PAYMENT_METHODS (optional)
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
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254;
const cents = (v: unknown) => Math.round(Number(v) * 100);


const HITPAY_API = (Deno.env.get("HITPAY_ENV") ?? "sandbox") === "production"
  ? "https://api.hit-pay.com"
  : "https://api.sandbox.hit-pay.com";

function hitpayHeaders(): Record<string, string> {
  return {
    "X-BUSINESS-API-KEY": Deno.env.get("HITPAY_API_KEY") ?? "",
    "X-Requested-With": "XMLHttpRequest",
  };
}


const SITE_URL = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
const METHODS = (Deno.env.get("HITPAY_PAYMENT_METHODS") ?? "paynow_online")
  .split(",").map((s) => s.trim()).filter(Boolean);

serveJson(async (body) => {
  const email = normEmail(body.email);
  if (!isEmail(email)) throw new HttpError(400, "Please enter a valid email address.");
  const cart = Array.isArray(body.items) ? body.items : [];
  if (cart.length === 0) throw new HttpError(400, "Your cart is empty.");
  if (cart.length > 20) throw new HttpError(400, "That's a lot of items! Please message us for large orders.");

  const { data: settings } = await db.from("settings").select("*").eq("id", 1).maybeSingle();
  if (settings && settings.shop_open === false) throw new HttpError(503, "Checkout is paused right now. Please try again later.");

  const ids = [...new Set(cart.map((i: { product_id: unknown }) => Number(i.product_id)))];
  const { data: products, error } = await db.from("products")
    .select("id, name, price, sizes, active").in("id", ids);
  if (error) throw error;

  // Prices always come from the database, never from the browser.
  const lines = cart.map((i: { product_id: unknown; size?: unknown; qty?: unknown }) => {
    const p = (products ?? []).find((x) => x.id === Number(i.product_id));
    if (!p || !p.active) throw new HttpError(400, "An item in your cart is no longer available. Please refresh and try again.");
    const qty = Math.floor(Number(i.qty));
    if (!(qty >= 1 && qty <= 10)) throw new HttpError(400, "Please choose a quantity between 1 and 10.");
    const size = String(i.size ?? "");
    if ((p.sizes ?? []).length > 0 && !p.sizes.includes(size)) {
      throw new HttpError(400, `Please choose a size for ${p.name}.`);
    }
    return { product_id: p.id, name: p.name, size, qty, unit_price: Number(p.price) };
  });

  const subtotal = lines.reduce((s: number, l: { unit_price: number; qty: number }) => s + cents(l.unit_price) * l.qty, 0);
  const freeOver = settings?.free_delivery_over == null ? null : cents(settings.free_delivery_over);
  const delivery = freeOver !== null && subtotal >= freeOver ? 0 : cents(settings?.delivery_fee ?? 0);
  const total = subtotal + delivery;

  const { data: order, error: insErr } = await db.from("orders")
    .insert({ email, items: lines, delivery_fee: delivery / 100, total: total / 100 })
    .select("order_no, lookup_token").single();
  if (insErr) throw insErr;

  const form = new URLSearchParams({
    amount: (total / 100).toFixed(2),
    currency: "SGD",
    email,
    purpose: `Loom Lah order ${order.order_no}`,
    reference_number: order.order_no,
    redirect_url: `${SITE_URL}/order.html?o=${encodeURIComponent(order.order_no)}&t=${order.lookup_token}`,
  });
  for (const m of METHODS) form.append("payment_methods[]", m);

  const r = await fetch(`${HITPAY_API}/v1/payment-requests`, {
    method: "POST",
    headers: { ...hitpayHeaders(), "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const pr = await r.json().catch(() => ({}));
  if (!r.ok || !pr.url) {
    console.error("HitPay error", r.status, pr);
    await db.from("orders").update({ status: "cancelled" }).eq("order_no", order.order_no);
    throw new HttpError(502, "We couldn't start the payment. Please try again in a moment.");
  }
  await db.from("orders").update({ hitpay_request_id: pr.id }).eq("order_no", order.order_no);

  return { order_no: order.order_no, url: pr.url };
});
