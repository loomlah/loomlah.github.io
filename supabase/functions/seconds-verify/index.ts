// Loom Lah – seconds-verify
// Self-contained Supabase Edge Function. Deploy with "Verify JWT" turned OFF.
// Secrets used (Supabase > Edge Functions > Secrets): ALLOWED_ORIGINS
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
const normOrder = (v: unknown) => String(v ?? "").trim().toUpperCase();


async function findPaidOrder(orderNo: string, email: string) {
  if (!orderNo || !isEmail(email)) throw new HttpError(400, "Enter your order number and the email you ordered with.");
  const { data: order, error } = await db.from("orders")
    .select("order_no, email, items, status")
    .eq("order_no", orderNo).maybeSingle();
  if (error) throw error;
  if (!order || normEmail(order.email) !== email) {
    throw new HttpError(404, "We couldn't find an order with that number and email.");
  }
  if (order.status !== "paid") throw new HttpError(409, "This order hasn't been paid yet, so its items can't be listed.");
  return order as { order_no: string; email: string; items: Array<{ name: string; size?: string; qty: number }>; status: string };
}

serveJson(async (body) => {
  const order = await findPaidOrder(normOrder(body.order_no), normEmail(body.email));
  const { data: listed } = await db.from("seconds_listings")
    .select("item_index").eq("order_no", order.order_no);
  const taken = new Set((listed ?? []).map((l) => l.item_index));
  return {
    order_no: order.order_no,
    items: order.items.map((it, index) => ({ index, name: it.name, size: it.size ?? "", listed: taken.has(index) })),
  };
});
