# Loom Lah website: shop, PayNow checkout and Seconds

This folder is the whole Loom Lah website plus its small backend.

| Part | What runs it | Cost |
|---|---|---|
| Website (`index.html`, `seconds.html`, `order.html`, `privacy.html`, `assets/`) | GitHub Pages at https://loomlah.github.io | Free |
| Catalogue, orders, Seconds listings, photos | Supabase (database, file storage, server functions) | Free tier; US$25/month Pro plan when you outgrow it |
| PayNow checkout | HitPay | Per payment only, no monthly fee |
| Visitor analytics | Google Analytics 4 | Free |

**Demo mode:** until you complete Step 4, the site runs with sample products, a pretend checkout and sample Seconds listings. You can upload it today and click through everything; no money is taken.

---

## What you'll need

* Your GitHub account `loomlah`
* A free **Supabase** account: https://supabase.com
* A **HitPay** business account with PayNow enabled: https://www.hitpayapp.com. HitPay also gives you a separate *sandbox* (test) account for trying payments safely.
* Optional: a **Google Analytics 4** property

About 1–2 hours the first time. No coding needed; it's all copy and paste.

---

## Step 1: Put the website online (GitHub Pages)

1. On GitHub, create a public repository named exactly **`loomlah.github.io`**.
2. Upload everything in this folder to the top level of that repository (not inside a sub-folder). *Add file → Upload files* works fine.
3. In the repository: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / root → Save**.
4. After a minute or two, open https://loomlah.github.io. You'll see the shop in demo mode.

The `supabase` folder is published too. It holds no passwords or keys, so that's harmless.

## Step 2: Create the database (Supabase)

1. In Supabase create a **New project**: name `loomlah`, region **Southeast Asia (Singapore)**, and a strong database password (save it in your password manager).
2. Open **SQL Editor → New query**, paste all of `supabase/setup.sql`, then click **Run**.
3. New query again: paste `supabase/seed-products.sql`, then **Run**. This adds your 8 current sets.
4. Open **Table Editor → products** and **set your real prices** (every price is a S$29.90 placeholder) and sizes.
5. In **Table Editor → settings**, set `delivery_fee` (e.g. 4.00) and, if you like, `free_delivery_over` (e.g. 60.00).

## Step 3: Add the server functions

These five small programs keep your HitPay key secret and check every order. For each folder in `supabase/functions/`:

1. Supabase → **Edge Functions → Deploy a new function → Via editor**.
2. Name it **exactly** like the folder: `create-checkout`, `hitpay-webhook`, `order-status`, `seconds-verify`, `seconds-create`.
3. Replace the sample code with the contents of that folder's `index.ts`, then **Deploy**.
4. Open the function's **Details/Settings** and turn **off** "Verify JWT" / "Enforce JWT verification". The website and HitPay call these functions directly; each one does its own checks.

*(If you prefer the command line: `supabase link --project-ref <ref>` then `supabase functions deploy`. The included `config.toml` already turns JWT verification off.)*

Then go to **Edge Functions → Secrets** and add:

| Name | Value |
|---|---|
| `SITE_URL` | `https://loomlah.github.io` |
| `ALLOWED_ORIGINS` | `https://loomlah.github.io` |
| `HITPAY_ENV` | `sandbox` (change to `production` when you go live) |
| `HITPAY_API_KEY` | From HitPay: **Settings → API Keys** (use the sandbox key first) |
| `HITPAY_PAYMENT_METHODS` | `paynow_online` (add `,card` if you also want card payments) |
| `HITPAY_WEBHOOK_SALT` | From Step 3b below |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically, so don't add them.

### Step 3b: Tell HitPay where to send payment confirmations

1. HitPay (sandbox first) → **Developers → Webhook Endpoints → Add**.
2. URL: `https://<your-project-ref>.supabase.co/functions/v1/hitpay-webhook` (your project ref is in Supabase → Project Settings).
3. Events: **payment_request.completed** and **payment_request.failed**.
4. Save, then copy that endpoint's **salt** into the `HITPAY_WEBHOOK_SALT` secret in Supabase.

## Step 4: Connect the website

Edit `assets/js/config.js` on GitHub (pencil icon) and fill in:

```js
supabaseUrl: 'https://<your-project-ref>.supabase.co',
supabaseKey: '<your anon / publishable key>',   // Supabase → Project Settings → API Keys
gaMeasurementId: 'G-XXXXXXX',                    // optional
```

The public key is meant to be public. The database rules only let it read products, settings and approved Seconds listings. **Never** put the HitPay key or the Supabase *service role / secret* key in this file.

Commit, wait a minute, refresh the site. The demo banners disappear and your real products load.

## Step 5: Test, then go live

1. With the sandbox keys, place a test order: add a set, enter your email, **Pay with PayNow**, and complete the sandbox payment.
2. You should land on **Thank you!** with "Payment received". In Supabase → Table Editor → `orders`, that order's `status` is `paid`.
3. Try Seconds: on `/seconds.html` enter that order number and email, submit a listing with a photo, then set its `status` to `live` in `seconds_listings`. It appears on the page.
4. Going live: in HitPay (live account) create an API key and a webhook endpoint (same URL, same two events). In Supabase secrets set `HITPAY_ENV` = `production`, and update `HITPAY_API_KEY` and `HITPAY_WEBHOOK_SALT` to the live values. Place one small real order to confirm.

---

## Day-to-day: where to do what

| Task | Where |
|---|---|
| Add a product / change price / sizes | Supabase → Table Editor → `products` (add a row; `slug` is a short unique name like `green-leaf-set`) |
| Hide a product | Untick `active` |
| Change the display order | Edit `sort_order` (lower shows first) |
| Product photos | Supabase → Storage → `product-images` → Upload → *Get URL* → paste into the product's `image_url`. Use portrait photos (4:5), about 1200px tall. |
| See orders | Supabase → `orders` (filter `status` = `paid`). The money side is also in your HitPay dashboard. |
| Arrange delivery | Email the customer at the address on the order. Checkout only collects an email, so ask for their address and phone in your reply. |
| Approve a Seconds listing | `seconds_listings` → set `status` to `live` (or `removed` to reject). Check the photos in Storage → `seconds-photos`. |
| Mark a Seconds item gone | Set `status` to `sold` |
| Pause the shop | `settings` → untick `shop_open` |
| Delivery fee / free-delivery threshold | `settings` |

**Marketing assets (photos, videos, social posts):** you don't need a separate asset-management system at this size. Keep raw photos and videos in a shared Google Drive folder (`/Products/<set name>/`, `/Campaigns/<season>/`), and make posts in Canva with your logo and colours saved as a Brand Kit. Only finished product photos go into Supabase Storage for the website.

## Analytics

With a GA4 measurement ID in `config.js`, the site reports page views plus these events: `view_item_list`, `add_to_cart`, `view_cart`, `begin_checkout`, `purchase` (order number and value), `cta_click` (which social channel was clicked), `seconds_verify`, `seconds_list` and `seconds_contact`. In GA4, mark `purchase` as a key event to see sales by traffic source (TikTok, Instagram and so on).

## Good to know

* **What's stored per order:** email, order number, items, amount, date, plus payment status and two technical fields (HitPay's payment ID and a private link token) needed to confirm payment. No names, phone numbers or addresses.
* **Free-tier pause:** Supabase pauses a free project after about a week with no activity. A live shop with daily visitors stays awake; if it does pause, click *Restore* in the dashboard, or move to Pro (US$25/month).
* **Storage:** the free tier's 1 GB holds roughly 4,000 Seconds photos (the site shrinks each photo to about 200–300 KB before upload).
* **No stock counts yet:** untick `active` when a set sells out. Stock tracking can be added later.
* **Seconds safety:** every listing waits for your approval. Sellers must agree before their contact details are shown, and there's a "Report a listing" link.
* **Privacy page:** `privacy.html` is a starting draft. Review it (and Singapore's PDPA requirements) before launch; this is not legal advice.
* **HitPay details to confirm in sandbox:** HitPay's docs don't show a complete example of the "completed" webhook message, so the code accepts either a `completed` status or a succeeded payment, and always checks the amount. If a webhook is delayed, the order page asks HitPay directly. Your Step 5 test confirms all of this.
* **Design canvas:** from now on, this folder is the master copy of the website. The earlier design canvas is a reference only.
