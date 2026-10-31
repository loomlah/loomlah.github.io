/* Google Analytics 4 (only loads when a measurement ID is set in config.js). */
(function () {
  'use strict';
  var id = (window.LOOMLAH_CONFIG || {}).gaMeasurementId;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  if (id) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
    window.gtag('js', new Date());
    window.gtag('config', id);
  }

  /* Small helper used by the shop: LLtrack('add_to_cart', {...}) */
  window.LLtrack = function (name, params) {
    try { if (id) window.gtag('event', name, params || {}); } catch (_) { /* ignore */ }
  };

  /* Every social/shop link tagged with data-cta reports which channel was clicked. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-cta]');
    if (a) window.LLtrack('cta_click', { channel: a.getAttribute('data-cta') });
  });
})();
