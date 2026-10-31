/* Loom Lah order status page: shown after HitPay checkout, or to look up an order. */
(function () {
  'use strict';
  var LL = window.LL;
  var track = window.LLtrack || function () {};
  var result = document.getElementById('order-result');
  var lookup = document.getElementById('order-lookup');
  var params = new URLSearchParams(location.search);
  var orderNo = (params.get('o') || '').toUpperCase();
  var token = params.get('t') || '';
  var polls = 0;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }
    catch (_) { return ''; }
  }
  function show(html) { result.innerHTML = html; result.classList.remove('ll-hide'); }

  function itemsTable(o) {
    var rows = (o.items || []).map(function (i) {
      return '<tr><td>' + esc(i.name) + (i.size ? ' <span class="ll-small">(' + esc(i.size) + ')</span>' : '') + ' × ' + esc(i.qty) + '</td><td>' + LL.money(i.unit_price * i.qty) + '</td></tr>';
    }).join('');
    rows += '<tr><td>Delivery</td><td>' + (Number(o.delivery_fee) ? LL.money(o.delivery_fee) : 'Free') + '</td></tr>';
    rows += '<tr><td><strong>Total</strong></td><td>' + LL.money(o.total) + '</td></tr>';
    return '<table class="ll-table" style="margin-top: 16px"><tbody>' + rows + '</tbody></table>';
  }

  function render(o) {
    var head = '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between">' +
      '<div><div style="font-family:var(--ll-display);font-size:1.5rem;font-weight:800">Order ' + esc(o.order_no) + '</div>' +
      '<div class="ll-small" style="font-size:.95rem">' + esc(fmtDate(o.created_at)) + '</div></div>';

    if (o.status === 'paid') {
      document.getElementById('order-title').textContent = 'Thank you!';
      show(head + '<span class="ll-status ll-status-paid">Payment received</span></div>' + itemsTable(o) +
        '<div style="margin-top:20px;display:flex;flex-direction:column;gap:12px;line-height:1.6">' +
        '<p style="margin:0">We’ve got your order. We’ll email you within 1 working day to arrange delivery.</p>' +
        '<p class="ll-notice ll-notice-ok" style="margin:0">Keep your order number <strong>' + esc(o.order_no) + '</strong>. When your little one outgrows a set, you can use it to list the set on <a href="seconds.html">Loom Lah Seconds</a>.</p>' +
        '<a class="ll-btn" href="index.html#shop" style="align-self:flex-start">Keep shopping</a></div>');
      try { localStorage.removeItem('ll-cart'); } catch (_) { /* ignore */ }
      var key = 'll-purchase-' + o.order_no;
      var seen = false;
      try { seen = !!localStorage.getItem(key); localStorage.setItem(key, '1'); } catch (_) { /* ignore */ }
      if (!seen) {
        track('purchase', { transaction_id: o.order_no, currency: 'SGD', value: Number(o.total), shipping: Number(o.delivery_fee) || 0,
          items: (o.items || []).map(function (i) { return { item_id: String(i.product_id), item_name: i.name, item_variant: i.size, price: i.unit_price, quantity: i.qty }; }) });
      }
      return;
    }

    if (o.status === 'pending') {
      if (polls < 20) {
        show(head + '<span class="ll-status ll-status-pending"><span class="ll-spinner" aria-hidden="true"></span>Confirming payment…</span></div>' +
          '<p style="margin:16px 0 0;line-height:1.6">This usually takes a few seconds. Please keep this page open.</p>');
        polls++;
        setTimeout(load, 3000);
        return;
      }
      show(head + '<span class="ll-status ll-status-pending">Waiting for payment</span></div>' + itemsTable(o) +
        '<p style="margin:16px 0 0;line-height:1.6">We haven’t received confirmation yet. If you’ve already paid, please don’t pay again: it can take a few minutes to come through. Check again shortly, or message us on <a href="https://ig.me/m/loomlah" target="_blank" rel="noopener">Instagram</a> with your order number.</p>' +
        '<button type="button" class="ll-btn" id="recheck" style="margin-top:16px">Check again</button>');
      document.getElementById('recheck').addEventListener('click', function () { polls = 0; load(); });
      return;
    }

    show(head + '<span class="ll-status ll-status-' + esc(o.status) + '">Payment not completed</span></div>' +
      '<p style="margin:16px 0 0;line-height:1.6">The payment didn’t go through, so you haven’t been charged. Your cart is still saved.</p>' +
      '<a class="ll-btn ll-btn-solid" href="index.html#shop" style="margin-top:16px">Back to the shop</a>');
  }

  var lastQuery = null;
  async function load(query) {
    var q = query || lastQuery || { order_no: orderNo, token: token };
    lastQuery = q;
    try {
      render(await LL.getOrderStatus(q));
    } catch (ex) {
      if (query) throw ex;
      result.classList.add('ll-hide');
      lookup.classList.remove('ll-hide');
      var err = document.getElementById('lookup-error');
      err.textContent = ex.message;
      err.classList.remove('ll-hide');
    }
  }

  document.getElementById('lookup-form').addEventListener('input', function () { document.getElementById('lookup-error').classList.add('ll-hide'); });
  document.getElementById('lookup-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var f = e.target, err = document.getElementById('lookup-error'), btn = f.querySelector('button');
    err.classList.add('ll-hide');
    var o = f.order.value.trim().toUpperCase(), em = f.email.value.trim();
    if (!o || !em) { err.textContent = 'Enter your order number and email.'; err.classList.remove('ll-hide'); return; }
    btn.disabled = true;
    try {
      orderNo = o; token = ''; polls = 0;
      await load({ order_no: o, email: em });
      lookup.classList.add('ll-hide');
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove('ll-hide');
    } finally {
      btn.disabled = false;
    }
  });

  if (orderNo && token) {
    show('<span class="ll-status ll-status-pending"><span class="ll-spinner" aria-hidden="true"></span>Loading your order…</span>');
    load();
  } else {
    lookup.classList.remove('ll-hide');
  }
})();
