// Loom Lah – seconds-create
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

const CONDITIONS = ["Like new", "Gently used", "Well loved"];
const MAX_PHOTO_BYTES = 2_000_000;

function cleanContact(method: string, value: string): string {
  const v = value.trim();
  if (method === "telegram" || method === "instagram") {
    const h = v.replace(/^@/, "");
    if (!/^[A-Za-z0-9_.]{3,32}$/.test(h)) throw new HttpError(400, "Please enter a valid username (letters, numbers, _ or .).");
    return "@" + h;
  }
  if (method === "whatsapp") {
    const d = v.replace(/[^\d]/g, "").replace(/^65(?=\d{8}$)/, "");
    if (!/^[689]\d{7}$/.test(d)) throw new HttpError(400, "Please enter a Singapore mobile number, e.g. 9123 4567.");
    return "+65" + d;
  }
  throw new HttpError(400, "Choose how buyers should contact you.");
}

function decodePhoto(dataUrl: string): { bytes: Uint8Array; type: string; ext: string } {
  const m = /^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new HttpError(400, "Photos must be JPG, PNG or WebP images.");
  const bin = atob(m[3]);
  if (bin.length > MAX_PHOTO_BYTES) throw new HttpError(400, "Each photo must be under 2 MB.");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, type: m[1], ext: m[2] === "jpeg" ? "jpg" : m[2] };
}

serveJson(async (body) => {
  const order = await findPaidOrder(normOrder(body.order_no), normEmail(body.email));
  const index = Number(body.item_index);
  const item = Number.isInteger(index) ? order.items[index] : undefined;
  if (!item) throw new HttpError(400, "Choose which item you're listing.");

  if (body.consent !== true) throw new HttpError(400, "Please agree to show your contact details on the listing.");
  const condition = String(body.condition ?? "");
  if (!CONDITIONS.includes(condition)) throw new HttpError(400, "Choose the item's condition.");
  const price = Math.round(Number(body.price ?? 0) * 100) / 100;
  if (!(price >= 0 && price <= 200)) throw new HttpError(400, "Price must be between S$0 (free) and S$200.");
  const area = String(body.area ?? "").trim().slice(0, 40);
  const method = String(body.contact_method ?? "");
  const contact = cleanContact(method, String(body.contact_value ?? ""));

  const photos = Array.isArray(body.photos) ? body.photos.slice(0, 3) : [];
  const decoded = photos.map((p: unknown) => decodePhoto(String(p)));

  const urls: string[] = [];
  for (let i = 0; i < decoded.length; i++) {
    const path = `${order.order_no}/${index}-${i + 1}-${crypto.randomUUID().slice(0, 8)}.${decoded[i].ext}`;
    const { error } = await db.storage.from("seconds-photos").upload(path, decoded[i].bytes, { contentType: decoded[i].type });
    if (error) throw error;
    urls.push(db.storage.from("seconds-photos").getPublicUrl(path).data.publicUrl);
  }

  const { error } = await db.from("seconds_listings").insert({
    order_no: order.order_no,
    item_index: index,
    title: item.name,
    size: item.size ?? null,
    condition,
    price,
    area: area || null,
    contact_method: method,
    contact_value: contact,
    photos: urls,
  });
  if (error) {
    if (error.code === "23505") throw new HttpError(409, "This item is already listed.");
    throw error;
  }
  return { ok: true, status: "pending" };
});
