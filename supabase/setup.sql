-- =====================================================================
-- Loom Lah: database setup
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run more than once.
-- =====================================================================

-- ---------- Products (your catalogue) --------------------------------
create table if not exists public.products (
  id          bigint generated always as identity primary key,
  slug        text unique not null,
  name        text not null,
  description text,
  occasion    text not null default 'everyday'
              check (occasion in ('cny', 'raya', 'playdate', 'everyday')),
  price       numeric(10,2) not null check (price > 0),
  sizes       text[] not null default '{}',          -- e.g. {"2–3 yrs","3–4 yrs"}
  image_url   text,                                   -- full URL, or a path like assets/img/x.jpg
  image_alt   text,
  active      boolean not null default true,          -- untick to hide from the shop
  sort_order  int not null default 100,               -- lower shows first
  created_at  timestamptz not null default now()
);

-- ---------- Shop settings (one row) ----------------------------------
create table if not exists public.settings (
  id                 int primary key default 1 check (id = 1),
  delivery_fee       numeric(10,2) not null default 0 check (delivery_fee >= 0),
  free_delivery_over numeric(10,2),                   -- leave empty for no free-delivery threshold
  shop_open          boolean not null default true    -- untick to pause checkout
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ---------- Orders ---------------------------------------------------
-- Stores only: email, order number, cost, items, date
-- (+ payment status and two technical fields used to confirm payment).
create sequence if not exists public.order_no_seq start 1001;

create table if not exists public.orders (
  order_no          text primary key default ('LL-' || nextval('public.order_no_seq')),
  email             text not null,
  items             jsonb not null,                   -- [{product_id, name, size, qty, unit_price}]
  delivery_fee      numeric(10,2) not null default 0,
  total             numeric(10,2) not null,
  status            text not null default 'pending'
                    check (status in ('pending', 'paid', 'failed', 'cancelled')),
  created_at        timestamptz not null default now(),
  paid_at           timestamptz,
  hitpay_request_id text,                             -- HitPay's id for this payment
  lookup_token      text not null default replace(gen_random_uuid()::text, '-', '')
);
create index if not exists orders_email_idx on public.orders (lower(email));

-- ---------- Seconds listings -----------------------------------------
create table if not exists public.seconds_listings (
  id             bigint generated always as identity primary key,
  order_no       text not null references public.orders (order_no),
  item_index     int  not null,                       -- which line of the order
  title          text not null,
  size           text,
  condition      text not null check (condition in ('Like new', 'Gently used', 'Well loved')),
  price          numeric(10,2) not null default 0 check (price >= 0 and price <= 200),  -- 0 = free
  area           text,
  contact_method text not null check (contact_method in ('telegram', 'instagram', 'whatsapp')),
  contact_value  text not null,
  photos         text[] not null default '{}',
  status         text not null default 'pending'
                 check (status in ('pending', 'live', 'sold', 'removed')),  -- set to 'live' to approve
  created_at     timestamptz not null default now(),
  unique (order_no, item_index)
);

-- ---------- Security ---------------------------------------------------
-- The website uses the public key. It may only:
--   * read active products and the settings row
--   * read approved ("live") Seconds listings, without order numbers
-- Orders and everything else are reachable only through the server functions.
alter table public.products          enable row level security;
alter table public.settings          enable row level security;
alter table public.orders            enable row level security;
alter table public.seconds_listings  enable row level security;

revoke all on public.products, public.settings, public.orders, public.seconds_listings from anon, authenticated;

grant select on public.products, public.settings to anon, authenticated;
drop policy if exists "public reads active products" on public.products;
create policy "public reads active products" on public.products
  for select to anon, authenticated using (active);
drop policy if exists "public reads settings" on public.settings;
create policy "public reads settings" on public.settings
  for select to anon, authenticated using (true);

grant select (id, title, size, condition, price, area, contact_method, contact_value, photos, created_at)
  on public.seconds_listings to anon, authenticated;
drop policy if exists "public reads live listings" on public.seconds_listings;
create policy "public reads live listings" on public.seconds_listings
  for select to anon, authenticated using (status = 'live');

revoke all on sequence public.order_no_seq from anon, authenticated;

-- ---------- File storage -----------------------------------------------
-- Public buckets: anyone can view a photo by its link; only you (dashboard)
-- and the server functions can upload.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true),
       ('seconds-photos', 'seconds-photos', true)
on conflict (id) do nothing;
