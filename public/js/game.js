/* Game detail / top-up page */
(function () {
  'use strict';
  var dataEl = document.getElementById('pageData');
  if (!dataEl) return;
  var PAGE = JSON.parse(dataEl.textContent);

  var form = document.getElementById('topupForm');
  var buyBtn = document.getElementById('buyBtn');
  var buyHint = document.getElementById('buyHint');
  var validateBtn = document.getElementById('validateBtn');
  var validationResult = document.getElementById('validationResult');

  var selected = { product: null, payment: null };

  function fmt(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }
  function $(sel) { return document.querySelector(sel); }

  // ---------- field validation ----------
  function fieldValue(key) {
    var el = form.querySelector('[data-field="' + key + '"]');
    return el ? el.value.trim() : '';
  }
  // Pure check — no DOM side effects (used for the readiness gate).
  function isValidField(f) {
    var val = fieldValue(f.key);
    if (f.required && !val) return false;
    if (val && f.type === 'number' && !/^[0-9]+$/.test(val)) return false;
    if (val && f.type === 'text' && val.length < 3) return false;
    if (val && f.type === 'select' && f.options && f.options.indexOf(val) === -1) return false;
    return true;
  }
  function fieldMessage(f) {
    var val = fieldValue(f.key);
    if (f.required && !val) return f.label + ' wajib diisi.';
    if (val && f.type === 'number' && !/^[0-9]+$/.test(val)) return f.label + ' hanya boleh angka.';
    if (val && f.type === 'text' && val.length < 3) return f.label + ' minimal 3 karakter.';
    if (val && f.type === 'select' && f.options && f.options.indexOf(val) === -1) return 'Pilihan ' + f.label + ' tidak valid.';
    return '';
  }
  // DOM-mutating check (used on input & on explicit actions).
  function validateField(f) {
    var msg = fieldMessage(f);
    var wrap = form.querySelector('[data-field-wrap="' + f.key + '"]');
    var errEl = form.querySelector('[data-err="' + f.key + '"]');
    if (wrap) wrap.classList.toggle('invalid', !!msg);
    if (errEl) errEl.textContent = msg;
    return !msg;
  }
  function validateAll() {
    return PAGE.fields.map(validateField).every(Boolean);
  }
  function allValid() {
    return PAGE.fields.map(isValidField).every(Boolean);
  }

  // ---------- summary ----------
  function refreshSummary() {
    var parts = PAGE.fields.map(function (f) {
      var v = fieldValue(f.key);
      return v ? (f.label + ': ' + v) : null;
    }).filter(Boolean);
    $('#sumAccount').textContent = parts.length ? parts.join(' · ') : '—';

    var price = selected.product ? selected.product.price : 0;
    var fee = 0;
    if (selected.payment) fee = Math.round(price * (selected.payment.feePercent || 0) / 100) + (selected.payment.feeFixed || 0);

    $('#sumProduct').textContent = selected.product ? selected.product.name : '—';
    $('#sumPrice').textContent = fmt(price);
    $('#sumFee').textContent = fmt(fee);
    $('#sumTotal').textContent = fmt(price + fee);

    var ready = allValid() && selected.product && selected.payment;
    buyBtn.disabled = !ready;
    if (ready) {
      buyHint.textContent = 'Siap! Klik Beli Sekarang untuk melanjutkan ke checkout.';
    } else if (!selected.product) {
      buyHint.textContent = 'Pilih nominal top up terlebih dahulu.';
    } else if (!selected.payment) {
      buyHint.textContent = 'Pilih metode pembayaran.';
    } else {
      buyHint.textContent = 'Lengkapi data akun dengan benar untuk melanjutkan.';
    }
  }

  // ---------- field events ----------
  form.querySelectorAll('[data-field]').forEach(function (el) {
    el.addEventListener('input', function () {
      var f = PAGE.fields.find(function (x) { return x.key === el.getAttribute('data-field'); });
      if (f) validateField(f);
      refreshSummary();
    });
    el.addEventListener('change', function () {
      var f = PAGE.fields.find(function (x) { return x.key === el.getAttribute('data-field'); });
      if (f) validateField(f);
      refreshSummary();
    });
  });

  // ---------- product selection ----------
  document.querySelectorAll('[data-product]').forEach(function (el) {
    el.addEventListener('click', function () {
      document.querySelectorAll('[data-product]').forEach(function (x) { x.classList.remove('selected'); });
      el.classList.add('selected');
      selected.product = {
        id: el.getAttribute('data-id'),
        name: el.getAttribute('data-name'),
        price: Number(el.getAttribute('data-price')),
      };
      refreshSummary();
    });
  });

  // ---------- payment selection ----------
  document.querySelectorAll('[data-payment]').forEach(function (el) {
    el.addEventListener('click', function () {
      if (el.disabled) return;
      document.querySelectorAll('[data-payment]').forEach(function (x) { x.classList.remove('selected'); });
      el.classList.add('selected');
      selected.payment = {
        code: el.getAttribute('data-code'),
        name: el.getAttribute('data-name'),
        feePercent: Number(el.getAttribute('data-fee-percent') || 0),
        feeFixed: Number(el.getAttribute('data-fee-fixed') || 0),
      };
      refreshSummary();
    });
  });

  // ---------- ID validation ----------
  if (validateBtn) {
    validateBtn.addEventListener('click', function () {
      var ok = validateAll();
      refreshSummary();
      if (!ok) {
        validationResult.innerHTML = '<div class="notice err"><span class="ic">❌</span><span>Lengkapi data akun terlebih dahulu.</span></div>';
        return;
      }
      validateBtn.disabled = true;
      validateBtn.textContent = 'Memeriksa…';
      var payload = { slug: PAGE.slug, fields: {} };
      PAGE.fields.forEach(function (f) { payload.fields[f.key] = fieldValue(f.key); });
      fetch('/api/validate-id', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          var tone = res.status === 'valid' ? 'ok' : (res.status === 'invalid' ? 'err' : 'warn');
          var ic = res.status === 'valid' ? '✅' : (res.status === 'invalid' ? '❌' : '⚠️');
          validationResult.innerHTML = '<div class="notice ' + tone + '"><span class="ic">' + ic + '</span><span>' + res.message + '</span></div>';
        })
        .catch(function () {
          validationResult.innerHTML = '<div class="notice err"><span class="ic">❌</span><span>Gagal memeriksa ID. Coba lagi.</span></div>';
        })
        .finally(function () {
          validateBtn.disabled = false;
          validateBtn.innerHTML = '🛡️ Cek ID Otomatis';
        });
    });
  }

  // ---------- buy ----------
  buyBtn.addEventListener('click', function () {
    if (!validateAll()) { window.toast('Lengkapi data akun terlebih dahulu', 'err'); return; }
    if (!selected.product) { window.toast('Pilih nominal top up', 'err'); return; }
    if (!selected.payment) { window.toast('Pilih metode pembayaran', 'err'); return; }

    var f = document.createElement('form');
    f.method = 'POST';
    f.action = '/checkout';
    function add(name, value) {
      var i = document.createElement('input');
      i.type = 'hidden'; i.name = name; i.value = value; f.appendChild(i);
    }
    add('slug', PAGE.slug);
    add('productId', selected.product.id);
    add('paymentCode', selected.payment.code);
    PAGE.fields.forEach(function (fl) { add('f_' + fl.key, fieldValue(fl.key)); });
    document.body.appendChild(f);
    buyBtn.disabled = true;
    buyBtn.textContent = 'Memproses…';
    f.submit();
  });

  refreshSummary();
})();
