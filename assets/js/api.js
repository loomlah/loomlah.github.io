/* Loom Lah data layer: talks to Supabase, or fakes it in demo mode. */
(function () {
  'use strict';
  var C = window.LOOMLAH_CONFIG || {};
  var BASE = String(C.supabaseUrl || '').replace(/\/$/, '');
  var KEY = C.supabaseKey || '';
  var DEMO = !BASE || !KEY;

  function store(kind) {
    try { return window[kind]; } catch (_) { return null; }
  }
  function readJSON(kind, key, fallback) {
    try { var s = store(kind); var v = s && s.getItem(key); return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; }
  }
  function writeJSON(kind, key, value) {
    try { var s = store(kind); if (s) s.setItem(key, JSON.stringify(value)); } catch (_) { /* ignore */ }
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function rest(path) {
    var r = await fetch(BASE + '/rest/v1/' + path, { headers: { apikey: KEY } });
    if (!r.ok) throw new Error('We couldn’t load this right now. Please refresh the page.');
    return r.json();
  }
  async function fn(name, body) {
    var r;
    try {
      r = await fetch(BASE + '/functions/v1/' + name, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: KEY },
        body: JSON.stringify(body)
      });
    } catch (_) {
      throw new Error('We couldn’t reach the shop. Check your connection and try again.');
    }
    var data = {};
    try { data = await r.json(); } catch (_) { /* empty */ }
    if (!r.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  }

  /* ---------------- demo data ---------------- */
  var SIZES = ['2–3 yrs', '3–4 yrs', '4–5 yrs', '5–6 yrs'];
  var DEMO_PRODUCTS = [
    [1, 'Red pocket set', 'White cotton shirt with a red floral pocket and matching shorts.', 'cny', 'assets/img/cny-red-set.jpg', 'White shirt with red pocket and red floral shorts set'],
    [2, 'Pastel stripe set', 'Pale yellow textured stripes with a soft collar and wooden buttons.', 'raya', 'assets/img/raya-pastel-set.jpg', 'Pale yellow striped shirt and shorts set with wooden buttons'],
    [3, 'Fruit-print ruffle set', 'Ruffle-sleeve top in a cheerful fruit print with teal bow shorts.', 'playdate', 'assets/img/playdate-fruit-set.jpg', 'Fruit-print ruffle-sleeve top with teal bow shorts'],
    [4, 'Bear & bunny set', 'Soft white gauze with tiny hand-drawn bears and bunnies.', 'playdate', 'assets/img/bear-bunny-set.jpg', 'White set with tiny bear and bunny prints'],
    [5, 'Blue flower-print set', 'Denim-blue crinkled cotton with a white flower print.', 'everyday', 'assets/img/blue-flower-set.jpg', 'Denim-blue set with white flower print'],
    [6, 'Leaf-print peplum set', 'Blue leaf-print peplum top with royal blue shorts.', 'everyday', 'assets/img/leaf-peplum-set.jpg', 'Blue leaf-print peplum top with royal blue shorts'],
    [7, 'Rainbow stripe ruffle set', 'Multicolour stripe ruffle top with pink shorts.', 'playdate', 'assets/img/stripe-ruffle-set.jpg', 'Multicolour stripe ruffle top with pink shorts'],
    [8, 'Check pocket set', 'White shirt with a black check pocket and check shorts.', 'everyday', 'assets/img/check-pocket-set.jpg', 'White shirt with black check pocket and check shorts']
  ].map(function (p) {
    return { id: p[0], name: p[1], description: p[2], occasion: p[3], price: 29.9, sizes: SIZES, image_url: p[4], image_alt: p[5] };
  });
  var DEMO_SETTINGS = { delivery_fee: 0, free_delivery_over: null, shop_open: true };
  var DEMO_LISTINGS = [
    ['Fruit-print ruffle set', '3–4 yrs', 'Like new', 12, 'Tampines', 'assets/img/playdate-fruit-set.jpg'],
    ['Bear & bunny set', '2–3 yrs', 'Gently used', 0, 'Punggol', 'assets/img/bear-bunny-set.jpg'],
    ['Red pocket set', '4–5 yrs', 'Like new', 15, 'Bishan', 'assets/img/cny-red-set.jpg'],
    ['Pastel stripe set', '5–6 yrs', 'Like new', 14, 'Jurong West', 'assets/img/raya-pastel-set.jpg'],
    ['Blue flower-print set', '3–4 yrs', 'Gently used', 0, 'Toa Payoh', 'assets/img/blue-flower-set.jpg'],
    ['Leaf-print peplum set', '4–5 yrs', 'Gently used', 10, 'Sengkang', 'assets/img/leaf-peplum-set.jpg'],
    ['Rainbow stripe ruffle set', '2–3 yrs', 'Well loved', 0, 'Clementi', 'assets/img/stripe-ruffle-set.jpg'],
    ['Check pocket set', '5–6 yrs', 'Like new', 12, 'Ang Mo Kio', 'assets/img/check-pocket-set.jpg']
  ].map(function (l, i) {
    return { id: i + 1, title: l[0], size: l[1], condition: l[2], price: l[3], area: l[4], photos: [l[5]],
      contact_method: ['telegram', 'instagram', 'whatsapp'][i % 3], contact_value: 'sample', sample: true };
  });
  var DEMO_ORDERS = {
    'LL-1024': [{ name: 'Fruit-print ruffle set', size: '3–4 yrs', qty: 1 }, { name: 'Bear & bunny set', size: '2–3 yrs', qty: 1 }],
    'LL-1031': [{ name: 'Red pocket set', size: '4–5 yrs', qty: 1 }]
  };

  /* ---------------- public API ---------------- */
  var LL = {
    demo: DEMO,

    money: function (n) {
      var v = Number(n) || 0;
      return 'S$' + (Math.round(v * 100) % 100 === 0 ? v.toFixed(0) : v.toFixed(2));
    },

    getProducts: async function () {
      if (DEMO) return DEMO_PRODUCTS;
      return rest('products?select=id,name,description,occasion,price,sizes,image_url,image_alt&order=sort_order.asc,id.asc');
    },

    getSettings: async function () {
      if (DEMO) return DEMO_SETTINGS;
      var rows = await rest('settings?select=delivery_fee,free_delivery_over,shop_open&id=eq.1');
      return rows[0] || DEMO_SETTINGS;
    },

    /* items: [{product_id, size, qty}] -> {order_no, url} */
    createCheckout: async function (email, items) {
      if (!DEMO) return fn('create-checkout', { email: email, items: items });
      await wait(600);
      var orderNo = 'LL-DEMO' + Math.floor(1000 + Math.random() * 9000);
      var lines = items.map(function (i) {
        var p = DEMO_PRODUCTS.filter(function (x) { return x.id === i.product_id; })[0];
        return { product_id: p.id, name: p.name, size: i.size, qty: i.qty, unit_price: p.price };
      });
      var total = lines.reduce(function (s, l) { return s + l.unit_price * l.qty; }, 0);
      writeJSON('sessionStorage', 'll-demo-order', { order_no: orderNo, email: email, items: lines, total: total, delivery_fee: 0, created_at: new Date().toISOString() });
      return { order_no: orderNo, url: 'order.html?o=' + orderNo + '&t=demo' };
    },

    /* {order_no, token} or {order_no, email} */
    getOrderStatus: async function (q) {
      if (!DEMO) return fn('order-status', q);
      await wait(500);
      var o = readJSON('sessionStorage', 'll-demo-order', null);
      if (!o || o.order_no !== String(q.order_no || '').toUpperCase()) throw new Error('We couldn’t find an order with those details.');
      o.status = 'paid';
      return o;
    },

    getListings: async function () {
      if (DEMO) return DEMO_LISTINGS;
      return rest('seconds_listings?select=id,title,size,condition,price,area,contact_method,contact_value,photos,created_at&order=created_at.desc&limit=200');
    },

    verifyOrder: async function (orderNo, email) {
      if (!DEMO) return fn('seconds-verify', { order_no: orderNo, email: email });
      await wait(500);
      var key = String(orderNo || '').trim().toUpperCase();
      var items = DEMO_ORDERS[key];
      if (!items) throw new Error('We couldn’t find an order with that number and email.');
      return { order_no: key, items: items.map(function (it, i) { return { index: i, name: it.name, size: it.size, listed: false }; }) };
    },

    createListing: async function (payload) {
      if (!DEMO) return fn('seconds-create', payload);
      await wait(900);
      return { ok: true, status: 'pending' };
    },

    cart: {
      get: function () { return readJSON('localStorage', 'll-cart', []); },
      set: function (items) { writeJSON('localStorage', 'll-cart', items); document.dispatchEvent(new CustomEvent('ll:cart')); },
      count: function () { return LL.cart.get().reduce(function (s, i) { return s + i.qty; }, 0); }
    }
  };

  window.LL = LL;
})();
