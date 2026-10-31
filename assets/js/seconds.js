/* Loom Lah Seconds: live listings, order verification and new listings with photos. */
(function () {
  'use strict';
  var LL = window.LL;
  var track = window.LLtrack || function () {};
  var state = { listings: [], filter: 'all', order: null, email: '', photos: [] };
  var MAX_PHOTOS = 3;

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
  function $(id) { return document.getElementById(id); }
  function showErr(id, msg) { var n = $(id); n.textContent = msg; n.classList.remove('ll-hide'); n.scrollIntoView({ block: 'nearest' }); }
  function hideErr(id) { $(id).classList.add('ll-hide'); }
  function step(n) {
    ['sec-step1', 'sec-step2', 'sec-step3'].forEach(function (id, i) { $(id).classList.toggle('is-active', i === n - 1); });
  }

  /* ---------------- listings ---------------- */
  function contactLink(l) {
    var v = String(l.contact_value || '');
    var msg = 'Hi! I saw your ' + l.title + ' on Loom Lah Seconds. Is it still available?';
    if (l.contact_method === 'telegram') return { href: 'https://t.me/' + encodeURIComponent(v.replace(/^@/, '')), label: 'Message on Telegram' };
    if (l.contact_method === 'instagram') return { href: 'https://ig.me/m/' + encodeURIComponent(v.replace(/^@/, '')), label: 'Message on Instagram' };
    if (l.contact_method === 'whatsapp') return { href: 'https://wa.me/' + v.replace(/[^\d]/g, '') + '?text=' + encodeURIComponent(msg), label: 'Message on WhatsApp' };
    return null;
  }

  function listingCard(l) {
    var photos = (l.photos && l.photos.length) ? l.photos : ['assets/logo.png'];
    var img = el('img', { src: photos[0], alt: l.title + ', pre-loved', loading: 'lazy', width: '720', height: '900' });
    var thumbs = photos.length > 1 ? el('div', { class: 'll-thumbs', role: 'group', 'aria-label': 'Photos' }, photos.map(function (src, i) {
      var b = el('button', { type: 'button', 'aria-pressed': String(i === 0), 'aria-label': 'Photo ' + (i + 1) + ' of ' + photos.length }, [el('img', { src: src, alt: '' })]);
      b.addEventListener('click', function () {
        img.src = src;
        b.parentNode.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      });
      return b;
    })) : null;
    var free = Number(l.price) === 0;
    var c = contactLink(l);
    var contact = l.sample
      ? el('button', { type: 'button', class: 'll-btn ll-btn-block', disabled: true, text: 'Contact seller (sample)' })
      : (c ? el('a', { class: 'll-btn ll-btn-solid ll-btn-block', href: c.href, target: '_blank', rel: 'noopener', text: c.label,
        onclick: function () { track('seconds_contact', { method: l.contact_method }); } }) : null);

    return el('article', { class: 'll-card' }, [
      el('div', { class: 'll-card-media' }, [img,
        el('span', { class: 'll-tag', style: free ? 'background:#B4C04E;color:#1F3311' : '', text: free ? 'Free' : LL.money(l.price) })]),
      el('div', { class: 'll-card-body' }, [
        thumbs,
        el('h3', { class: 'll-card-title', text: l.title }),
        el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' }, [
          l.size ? el('span', { style: 'padding:4px 10px;border-radius:8px;background:#E3EDF5;font-size:.85rem;font-weight:600', text: 'Age ' + l.size }) : null,
          el('span', { style: 'padding:4px 10px;border-radius:8px;background:#E4ECDB;color:#34502A;font-size:.85rem;font-weight:600', text: l.condition })
        ]),
        l.area ? el('span', { class: 'll-desc', text: 'Pickup: ' + l.area }) : null,
        el('span', { style: 'font-size:.85rem;font-weight:700;color:#3F6A2B', text: '✓ Verified Loom Lah order' }),
        el('div', { class: 'll-card-actions' }, [contact])
      ])
    ]);
  }

  function renderListings() {
    var grid = $('sec-grid');
    var all = state.listings;
    var counts = { all: all.length, sale: all.filter(function (l) { return Number(l.price) > 0; }).length };
    counts.free = all.length - counts.sale;
    var chips = $('sec-chips');
    chips.textContent = '';
    [['all', 'All'], ['sale', 'For sale'], ['free', 'Free']].forEach(function (d) {
      chips.appendChild(el('button', { type: 'button', class: 'll-chip', 'aria-pressed': String(state.filter === d[0]), text: d[1] + ' (' + counts[d[0]] + ')',
        onclick: function () { state.filter = d[0]; renderListings(); } }));
    });
    var list = all.filter(function (l) {
      return state.filter === 'all' || (state.filter === 'free' ? Number(l.price) === 0 : Number(l.price) > 0);
    });
    grid.textContent = '';
    if (!list.length) {
      grid.appendChild(el('div', { class: 'll-empty', style: 'grid-column: 1 / -1' }, [
        el('p', { text: all.length ? 'Nothing in this filter right now.' : 'No listings yet. Be the first to pass a set on!' }),
        el('a', { class: 'll-btn', href: '#list-yours', text: 'List your item' })
      ]));
      return;
    }
    list.forEach(function (l) { grid.appendChild(listingCard(l)); });
  }

  /* ---------------- step 1: verify ---------------- */
  async function verify(e) {
    e.preventDefault();
    hideErr('sv-error');
    var f = e.target, btn = f.querySelector('button[type="submit"]');
    var orderNo = f.order.value.trim().toUpperCase(), email = f.email.value.trim();
    if (!orderNo || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      showErr('sv-error', 'Enter your order number and the email you ordered with.');
      return;
    }
    btn.disabled = true;
    var label = btn.textContent;
    btn.textContent = 'Checking…';
    try {
      var res = await LL.verifyOrder(orderNo, email);
      state.order = res; state.email = email; state.photos = [];
      renderStep2();
      step(2);
      track('seconds_verify');
    } catch (ex) {
      showErr('sv-error', ex.message);
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  /* ---------------- step 2: listing form ---------------- */
  function renderStep2() {
    $('sv-verified').textContent = 'Order ' + state.order.order_no + ' verified';
    var box = $('sv-items');
    box.textContent = '';
    var firstOpen = null;
    state.order.items.forEach(function (it) {
      var input = el('input', { type: 'radio', name: 'item', value: String(it.index), disabled: it.listed ? true : null });
      if (!it.listed && firstOpen === null) { firstOpen = it.index; input.checked = true; }
      box.appendChild(el('label', { class: 'll-check', style: 'padding:12px 14px;border:1.5px solid #CFDCE6;border-radius:12px;' + (it.listed ? 'opacity:.6' : '') }, [
        input,
        el('span', {}, [el('strong', { text: it.name }), it.size ? ' · ' + it.size : '', it.listed ? ' (already listed)' : ''])
      ]));
    });
    var submit = $('sec-step2').querySelector('button[type="submit"]');
    submit.disabled = firstOpen === null;
    if (firstOpen === null) showErr('sv-error2', 'Every item from this order is already listed.'); else hideErr('sv-error2');
    renderPhotos();
  }

  var HINTS = {
    telegram: ['@username', 'Your Telegram username.'],
    instagram: ['@username', 'Your Instagram username. Buyers will message you there.'],
    whatsapp: ['9123 4567', 'Your Singapore mobile number for WhatsApp.']
  };
  function updateContactHint() {
    var h = HINTS[$('sv-method').value];
    $('sv-contact').placeholder = h[0];
    $('sv-contact').inputMode = $('sv-method').value === 'whatsapp' ? 'tel' : 'text';
    $('sv-contact-hint').textContent = h[1];
  }
  function updatePriceField() {
    var free = $('sec-step2').mode.value === 'free';
    $('sv-price-wrap').classList.toggle('ll-hide', free);
  }

  /* Photos are resized in the browser (max 1200px, JPEG) before upload. */
  function resize(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('We couldn’t read that photo. Please use a JPG or PNG.')); };
      img.src = url;
    });
  }

  async function addPhotos(e) {
    hideErr('sv-error2');
    var files = Array.prototype.slice.call(e.target.files || []);
    e.target.value = '';
    var room = MAX_PHOTOS - state.photos.length;
    if (files.length > room) showErr('sv-error2', 'You can add up to ' + MAX_PHOTOS + ' photos.');
    for (var i = 0; i < Math.min(room, files.length); i++) {
      try { state.photos.push(await resize(files[i])); }
      catch (ex) { showErr('sv-error2', ex.message); }
    }
    renderPhotos();
  }

  function renderPhotos() {
    var box = $('sv-photos');
    box.textContent = '';
    state.photos.forEach(function (src, i) {
      box.appendChild(el('div', { class: 'll-photo' }, [
        el('img', { src: src, alt: 'Photo ' + (i + 1) }),
        el('button', { type: 'button', 'aria-label': 'Remove photo ' + (i + 1), text: '×', onclick: function () { state.photos.splice(i, 1); renderPhotos(); } })
      ]));
    });
    $('sv-photo-btn').classList.toggle('ll-hide', state.photos.length >= MAX_PHOTOS);
  }

  async function submitListing(e) {
    e.preventDefault();
    hideErr('sv-error2');
    var f = e.target, btn = f.querySelector('button[type="submit"]');
    var item = f.querySelector('input[name="item"]:checked');
    var condition = f.querySelector('input[name="condition"]:checked');
    var free = f.mode.value === 'free';
    var price = free ? 0 : Number(f.price.value);
    var contact = f.contact.value.trim();

    if (!item) return showErr('sv-error2', 'Choose which item you’re listing.');
    if (!condition) return showErr('sv-error2', 'Choose the item’s condition.');
    if (!free && !(price >= 1 && price <= 200)) return showErr('sv-error2', 'Enter a price between S$1 and S$200, or choose Give away free.');
    if (!contact) return showErr('sv-error2', 'Add how buyers can contact you.');
    if (!f.consent.checked) return showErr('sv-error2', 'Please agree to show your contact details on the listing.');

    btn.disabled = true;
    var label = btn.textContent;
    btn.textContent = 'Submitting…';
    try {
      await LL.createListing({
        order_no: state.order.order_no, email: state.email, item_index: Number(item.value),
        condition: condition.value, price: price, area: f.area.value.trim(),
        contact_method: f.method.value, contact_value: contact, consent: true, photos: state.photos
      });
      track('seconds_list', { free: free });
      state.order.items.forEach(function (it) { if (it.index === Number(item.value)) it.listed = true; });
      f.reset(); state.photos = []; updatePriceField(); updateContactHint();
      step(3);
      $('sec-step3').scrollIntoView({ block: 'nearest' });
    } catch (ex) {
      showErr('sv-error2', ex.message);
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  /* ---------------- boot ---------------- */
  async function init() {
    if (LL.demo) document.querySelectorAll('[data-demo-only]').forEach(function (n) { n.classList.remove('ll-hide'); });
    $('sec-step1').addEventListener('submit', verify);
    $('sec-step1').addEventListener('input', function () { hideErr('sv-error'); });
    $('sec-step2').addEventListener('input', function () { hideErr('sv-error2'); });
    $('sec-step2').addEventListener('submit', submitListing);
    $('sec-step2').addEventListener('change', function (e) { if (e.target.name === 'mode') updatePriceField(); });
    $('sv-method').addEventListener('change', updateContactHint);
    $('sv-photo-input').addEventListener('change', addPhotos);
    $('sv-back').addEventListener('click', function () { step(1); });
    $('sv-another').addEventListener('click', function () { renderStep2(); step(2); });
    updateContactHint();
    updatePriceField();

    try {
      state.listings = await LL.getListings();
      renderListings();
    } catch (ex) {
      $('sec-grid').textContent = '';
      $('sec-grid').appendChild(el('p', { class: 'll-notice ll-notice-error', text: ex.message }));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
