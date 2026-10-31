/* Loom Lah shop: product grid, cart drawer and HitPay checkout. */
(function () {
  'use strict';
  var LL = window.LL;
  var track = window.LLtrack || function () {};
  var OCCASIONS = { cny: 'Chinese New Year', raya: 'Hari Raya', playdate: 'Play dates', everyday: 'Everyday' };
  var state = { products: [], settings: { delivery_fee: 0, free_delivery_over: null, shop_open: true }, filter: 'all' };

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }

  /* ---------- toast ---------- */
  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('ll-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  /* ---------- product grid ---------- */
  function productCard(p) {
    var groupName = 'size-' + p.id;
    var sizes = (p.sizes || []);
    var sizeSet = sizes.length ? el('fieldset', { class: 'll-sizes' }, [el('legend', { text: 'Size' })].concat(sizes.map(function (s, i) {
      return el('label', { class: 'll-size' }, [
        el('input', { type: 'radio', name: groupName, value: s, checked: i === 0 ? true : null }),
        el('span', { text: s })
      ]);
    }))) : null;

    var add = el('button', { type: 'button', class: 'll-btn ll-btn-solid ll-btn-block', text: 'Add to cart' });
    add.addEventListener('click', function () {
      var picked = card.querySelector('input[name="' + groupName + '"]:checked');
      addToCart(p, picked ? picked.value : '');
    });

    var card = el('article', { class: 'll-card', 'data-occasion': p.occasion || 'everyday' }, [
      el('div', { class: 'll-card-media' }, [
        el('img', { src: p.image_url || 'assets/logo.png', alt: p.image_alt || p.name, loading: 'lazy', width: '720', height: '900' }),
        p.occasion && p.occasion !== 'everyday' ? el('span', { class: 'll-tag ll-tag-' + p.occasion, text: OCCASIONS[p.occasion] || p.occasion }) : null
      ]),
      el('div', { class: 'll-card-body' }, [
        el('div', { class: 'll-card-row' }, [
          el('h3', { class: 'll-card-title', text: p.name }),
          el('span', { class: 'll-price', text: LL.money(p.price) })
        ]),
        p.description ? el('p', { class: 'll-desc', text: p.description }) : null,
        sizeSet,
        el('div', { class: 'll-card-actions' }, [add])
      ])
    ]);
    return card;
  }

  function renderGrid() {
    var grid = document.getElementById('ll-grid');
    if (!grid) return;
    grid.textContent = '';
    var list = state.products.filter(function (p) { return state.filter === 'all' || p.occasion === state.filter; });
    if (!list.length) {
      grid.appendChild(el('p', { class: 'll-empty', text: 'Nothing here yet. Try another filter.' }));
      return;
    }
    list.forEach(function (p) { grid.appendChild(productCard(p)); });
  }

  function renderChips() {
    var box = document.getElementById('ll-chips');
    if (!box) return;
    var present = {};
    state.products.forEach(function (p) { present[p.occasion] = true; });
    var defs = [['all', 'All']].concat(Object.keys(OCCASIONS).filter(function (k) { return present[k]; }).map(function (k) { return [k, OCCASIONS[k]]; }));
    box.textContent = '';
    defs.forEach(function (d) {
      box.appendChild(el('button', {
        type: 'button', class: 'll-chip', 'aria-pressed': String(state.filter === d[0]), text: d[1],
        onclick: function () { setFilter(d[0]); }
      }));
    });
  }

  function setFilter(f) {
    state.filter = f;
    renderChips();
    renderGrid();
  }

  /* ---------- cart ---------- */
  function addToCart(p, size) {
    var items = LL.cart.get();
    var hit = items.filter(function (i) { return i.product_id === p.id && i.size === size; })[0];
    if (hit) hit.qty = Math.min(10, hit.qty + 1);
    else items.push({ product_id: p.id, size: size, qty: 1, name: p.name, price: Number(p.price), image_url: p.image_url });
    LL.cart.set(items);
    toast(p.name + (size ? ' (' + size + ')' : '') + ' added to cart');
    track('add_to_cart', { currency: 'SGD', value: Number(p.price), items: [{ item_id: String(p.id), item_name: p.name, item_variant: size, price: Number(p.price), quantity: 1 }] });
  }

  function freshCart() {
    // Keep names/prices current and drop products that are no longer sold.
    if (!state.products.length) return LL.cart.get();
    var byId = {};
    state.products.forEach(function (p) { byId[p.id] = p; });
    var items = LL.cart.get().filter(function (i) { return byId[i.product_id]; }).map(function (i) {
      var p = byId[i.product_id];
      i.name = p.name; i.price = Number(p.price); i.image_url = p.image_url;
      return i;
    });
    return items;
  }

  function totals(items) {
    var sub = items.reduce(function (s, i) { return s + Math.round(i.price * 100) * i.qty; }, 0);
    var st = state.settings;
    var freeOver = st.free_delivery_over == null ? null : Math.round(Number(st.free_delivery_over) * 100);
    var del = !items.length ? 0 : (freeOver !== null && sub >= freeOver ? 0 : Math.round(Number(st.delivery_fee || 0) * 100));
    return { sub: sub / 100, delivery: del / 100, total: (sub + del) / 100, freeOver: freeOver === null ? null : freeOver / 100 };
  }

  function updateCount() {
    var n = LL.cart.count();
    document.querySelectorAll('[data-cart-count]').forEach(function (b) { b.textContent = String(n); });
    document.querySelectorAll('[data-cart-label]').forEach(function (b) { b.setAttribute('aria-label', 'Cart, ' + n + (n === 1 ? ' item' : ' items')); });
  }

  function renderCart() {
    var body = document.getElementById('ll-cart-lines');
    if (!body) return;
    var items = freshCart();
    body.textContent = '';
    if (!items.length) {
      body.appendChild(el('div', { class: 'll-empty' }, [
        el('p', { text: 'Your cart is empty.' }),
        el('button', { type: 'button', class: 'll-btn', text: 'Browse the sets', onclick: function () { closeCart(); location.hash = '#shop'; } })
      ]));
    }
    items.forEach(function (i, idx) {
      function change(d) {
        var all = LL.cart.get();
        all[idx].qty = Math.max(1, Math.min(10, all[idx].qty + d));
        LL.cart.set(all);
      }
      body.appendChild(el('div', { class: 'll-line' }, [
        el('img', { src: i.image_url || 'assets/logo.png', alt: '' }),
        el('div', {}, [
          el('div', { class: 'll-line-name', text: i.name }),
          i.size ? el('div', { class: 'll-line-meta', text: 'Size ' + i.size }) : null,
          el('div', { class: 'll-qty' }, [
            el('button', { type: 'button', 'aria-label': 'Decrease quantity of ' + i.name, text: '−', onclick: function () { change(-1); } }),
            el('output', { 'aria-live': 'polite', text: String(i.qty) }),
            el('button', { type: 'button', 'aria-label': 'Increase quantity of ' + i.name, text: '+', onclick: function () { change(1); } })
          ])
        ]),
        el('div', {}, [
          el('div', { class: 'll-line-price', text: LL.money(i.price * i.qty) }),
          el('button', { type: 'button', class: 'll-remove', text: 'Remove', onclick: function () {
            var all = LL.cart.get(); all.splice(idx, 1); LL.cart.set(all);
          } })
        ])
      ]));
    });

    var t = totals(items);
    setText('ll-sum-sub', LL.money(t.sub));
    setText('ll-sum-del', !items.length ? '—' : (t.delivery === 0 ? 'Free' : LL.money(t.delivery)));
    setText('ll-sum-total', LL.money(t.total));
    var freeNote = document.getElementById('ll-free-note');
    if (freeNote) {
      var gap = t.freeOver !== null ? t.freeOver - t.sub : 0;
      freeNote.textContent = t.freeOver !== null && gap > 0 && items.length ? 'Add ' + LL.money(gap) + ' more for free delivery.' : '';
    }
    var foot = document.getElementById('ll-checkout');
    if (foot) foot.classList.toggle('ll-hide', !items.length);
  }

  function setText(id, v) { var n = document.getElementById(id); if (n) n.textContent = v; }

  var lastFocus;
  function openCart() {
    var d = document.getElementById('ll-cart');
    if (!d) return;
    lastFocus = document.activeElement;
    renderCart();
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    var items = freshCart();
    track('view_cart', { currency: 'SGD', value: totals(items).total });
  }
  function closeCart() {
    var d = document.getElementById('ll-cart');
    if (!d) return;
    if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  async function checkout(e) {
    e.preventDefault();
    var form = e.target;
    var err = document.getElementById('ll-cart-error');
    var btn = form.querySelector('button[type="submit"]');
    var email = form.email.value.trim();
    err.classList.add('ll-hide');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      err.textContent = 'Please enter a valid email address so we can send your order details.';
      err.classList.remove('ll-hide');
      form.email.focus();
      return;
    }
    var items = freshCart();
    if (!items.length) return;
    btn.disabled = true;
    var label = btn.textContent;
    btn.textContent = 'Opening secure checkout…';
    var t = totals(items);
    track('begin_checkout', { currency: 'SGD', value: t.total, items: items.map(function (i) { return { item_id: String(i.product_id), item_name: i.name, item_variant: i.size, price: i.price, quantity: i.qty }; }) });
    try {
      var res = await LL.createCheckout(email, items.map(function (i) { return { product_id: i.product_id, size: i.size, qty: i.qty }; }));
      window.location.href = res.url;
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove('ll-hide');
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  /* ---------- boot ---------- */
  async function init() {
    updateCount();
    document.addEventListener('ll:cart', function () { updateCount(); renderCart(); });
    window.addEventListener('storage', function (e) { if (e.key === 'll-cart') { updateCount(); renderCart(); } });
    document.querySelectorAll('[data-cart-open]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); openCart(); }); });
    var d = document.getElementById('ll-cart');
    if (d) {
      d.addEventListener('click', function (e) { if (e.target === d) closeCart(); });
      d.querySelectorAll('[data-cart-close]').forEach(function (b) { b.addEventListener('click', closeCart); });
      var f = document.getElementById('ll-checkout');
      if (f) {
        f.addEventListener('submit', checkout);
        f.addEventListener('input', function () { document.getElementById('ll-cart-error').classList.add('ll-hide'); });
      }
    }
    document.querySelectorAll('[data-shop-filter]').forEach(function (a) {
      a.addEventListener('click', function () { setFilter(a.getAttribute('data-shop-filter')); });
    });
    if (LL.demo) document.querySelectorAll('[data-demo-only]').forEach(function (n) { n.classList.remove('ll-hide'); });

    var grid = document.getElementById('ll-grid');
    if (!grid) return;
    try {
      var results = await Promise.all([LL.getProducts(), LL.getSettings()]);
      state.products = results[0] || [];
      state.settings = results[1] || state.settings;
      renderChips();
      renderGrid();
      if (state.settings.shop_open === false) {
        var closed = document.getElementById('ll-shop-closed');
        if (closed) closed.classList.remove('ll-hide');
        var submit = document.querySelector('#ll-checkout button[type="submit"]');
        if (submit) { submit.disabled = true; submit.textContent = 'Checkout is paused'; }
      }
      LL.cart.set(freshCart());
      track('view_item_list', { item_list_name: 'Shop', items: state.products.map(function (p) { return { item_id: String(p.id), item_name: p.name, price: Number(p.price) }; }) });
    } catch (ex) {
      grid.textContent = '';
      grid.appendChild(el('p', { class: 'll-notice ll-notice-error', text: ex.message }));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
