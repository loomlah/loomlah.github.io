-- =====================================================================
-- Loom Lah: starter catalogue (run once, after setup.sql)
-- PRICES ARE PLACEHOLDERS (S$29.90). Change them in Table Editor > products
-- before you open the shop. Sizes are a starting guess too.
-- Image paths point at the photos already on your website; you can swap
-- them for Supabase Storage links later.
-- =====================================================================
insert into public.products (slug, name, description, occasion, price, sizes, image_url, image_alt, sort_order) values
('red-pocket-set',      'Red pocket set',          'White cotton shirt with a red floral pocket and matching shorts.', 'cny',      29.90, '{"2–3 yrs","3–4 yrs","4–5 yrs","5–6 yrs"}', 'assets/img/cny-red-set.jpg',         'White shirt with red pocket and red floral shorts set',      10),
('pastel-stripe-set',   'Pastel stripe set',       'Pale yellow textured stripes with a soft collar and wooden buttons.', 'raya', 29.90, '{"2–3 yrs","3–4 yrs","4–5 yrs","5–6 yrs"}', 'assets/img/raya-pastel-set.jpg',     'Pale yellow striped shirt and shorts set with wooden buttons', 20),
('fruit-ruffle-set',    'Fruit-print ruffle set',  'Ruffle-sleeve top in a cheerful fruit print with teal bow shorts.', 'playdate', 29.90, '{"2–3 yrs","3–4 yrs","4–5 yrs","5–6 yrs"}', 'assets/img/playdate-fruit-set.jpg', 'Fruit-print ruffle-sleeve top with teal bow shorts',         30),
('bear-bunny-set',      'Bear & bunny set',        'Soft white gauze with tiny hand-drawn bears and bunnies.',       'playdate', 29.90, '{"2–3 yrs","3–4 yrs","4–5 yrs","5–6 yrs"}', 'assets/img/bear-bunny-set.jpg',     'White set with tiny bear and bunny prints',                   40),
('blue-flower-set',     'Blue flower-print set',   'Denim-blue crinkled cotton with a white flower print.',           'everyday', 29.90, '{"2–3 yrs","3–4 yrs","4–5 yrs","5–6 yrs"}', 'assets/img/blue-flower-set.jpg',    'Denim-blue set with white flower print',                      50),
('leaf-peplum-set',     'Leaf-print peplum set',   'Blue leaf-print peplum top with royal blue shorts.',              'everyday', 29.90, '{"2–3 yrs","3–4 yrs","4–5 yrs","5–6 yrs"}', 'assets/img/leaf-peplum-set.jpg',    'Blue leaf-print peplum top with royal blue shorts',           60),
('rainbow-ruffle-set',  'Rainbow stripe ruffle set','Multicolour stripe ruffle top with pink shorts.',                'playdate', 29.90, '{"2–3 yrs","3–4 yrs","4–5 yrs","5–6 yrs"}', 'assets/img/stripe-ruffle-set.jpg',  'Multicolour stripe ruffle top with pink shorts',              70),
('check-pocket-set',    'Check pocket set',        'White shirt with a black check pocket and check shorts.',         'everyday', 29.90, '{"2–3 yrs","3–4 yrs","4–5 yrs","5–6 yrs"}', 'assets/img/check-pocket-set.jpg',   'White shirt with black check pocket and check shorts',        80)
on conflict (slug) do nothing;
