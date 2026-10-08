/* Checkout page */
(function () {
  'use strict';
  var dataEl = document.getElementById('pageData');
  if (!dataEl) return;
  var PAGE = JSON.parse(dataEl.textContent);

  var form = document.getElementById('checkoutForm');
  var payBtn = document.getElementById('payBtn');

  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function normPhone(v) {
    v = String(v).replace(/[\s\-()]/g, '');
    if (v.indexOf('+62') === 0) v = '0' + v.slice(3);
    if (v.indexOf('62') === 0) v = '0' + v.slice(2);
    return v;
  }
  function validPhone(v) { return /^08[0-9]{7,13}$/.test(normPhone(v)); }

  function setErr(key, msg) {
    var wrap = form.querySelector('[data-field-wrap="' + key + '"]');
    var err = form.querySelector('[data-err="' + key + '"]');
    if (wrap) wrap.classList.toggle('invalid', !!msg);
    if (err) err.textContent = msg || '';
    return !msg;
  }

  function validate() {
    var email = document.getElementById('email').value.trim();
    var wa = document.getElementById('whatsapp').value.trim();
    var ok = true;
    ok = setErr('email', email && !validEmail(email) ? 'Format email tidak valid.' : '') && ok;
    ok = setErr('whatsapp', wa && !validPhone(wa) ? 'Format nomor WhatsApp tidak valid (contoh: 08xxxxxxxxxx).' : '') && ok;
    return ok;
  }

  ['email', 'whatsapp'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('blur', validate);
  });

  payBtn.addEventListener('click', function () {
    if (!validate()) { window.toast('Periksa kembali kontak kamu', 'err'); return; }
    payBtn.disabled = true;
    payBtn.textContent = 'Memproses…';
    fetch('/api/orders/' + encodeURIComponent(PAGE.orderId) + '/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('email').value.trim(),
        whatsapp: document.getElementById('whatsapp').value.trim(),
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.ok) {
          window.location.href = '/order/' + encodeURIComponent(PAGE.orderId);
        } else {
          window.toast(res.error || 'Gagal memproses pembayaran', 'err');
          payBtn.disabled = false;
          payBtn.textContent = 'Bayar';
        }
      })
      .catch(function () {
        window.toast('Terjadi kesalahan jaringan', 'err');
        payBtn.disabled = false;
        payBtn.textContent = 'Bayar';
      });
  });
})();
