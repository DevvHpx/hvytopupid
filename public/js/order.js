/* Order / payment status page — polling + actions */
(function () {
  'use strict';
  var dataEl = document.getElementById('pageData');
  if (!dataEl) return;
  var PAGE = JSON.parse(dataEl.textContent);

  var pillHost = document.getElementById('statusPillHost');
  var stepsHost = document.getElementById('stepsHost');
  var noteHost = document.getElementById('statusNote');
  var timelineHost = document.getElementById('timelineHost');

  var TONE = {
    pending_payment: ['warn', '⏳', 'Menunggu Pembayaran', 1],
    paid: ['info', '✅', 'Pembayaran Berhasil', 2],
    processing: ['info', '⚙️', 'Memproses Top-Up', 3],
    success: ['ok', '🎉', 'Top-Up Berhasil', 4],
    failed: ['err', '⚠️', 'Top-Up Gagal', 4],
    cancelled: ['muted', '🚫', 'Dibatalkan', 0],
    refund: ['err', '↩️', 'Refund / Perlu Penanganan', 4],
  };
  var TERMINAL = ['success', 'failed', 'cancelled', 'refund'];

  function renderStatus(status, note, events) {
    var m = TONE[status] || ['muted', '•', status, 0];
    if (pillHost) pillHost.innerHTML = '<span class="status-pill ' + m[0] + '">' + m[1] + ' ' + m[2] + '</span>';

    if (stepsHost) {
      var isErr = status === 'failed' || status === 'refund';
      var html = '';
      for (var i = 1; i <= 4; i++) {
        var on = m[3] >= i;
        var err = isErr && i === 4;
        html += '<span class="s ' + (on ? 'on' : '') + ' ' + (err ? 'err' : '') + '"></span>';
      }
      stepsHost.innerHTML = html;
    }
    if (noteHost) {
      noteHost.innerHTML = note ? '<div class="notice info"><span class="ic">ℹ️</span><span>' + note + '</span></div>' : '';
    }
    if (timelineHost && events) {
      timelineHost.innerHTML = events.map(function (e, i) {
        var mm = TONE[e.status] || ['muted', '•', e.status, 0];
        var last = i === events.length - 1;
        return '<div class="tl-item ' + (last ? 'current' : 'done') + '">' +
          '<div class="tl-dot">' + (last ? mm[1] : '✓') + '</div>' +
          '<div class="tl-body"><div class="t">' + mm[2] + '</div>' +
          (e.message ? '<div class="m">' + e.message + '</div>' : '') +
          '<div class="time">' + (e.created_at || '') + '</div></div></div>';
      }).join('');
    }
  }

  var stopped = TERMINAL.indexOf(PAGE.status) !== -1;
  var timer = null;

  function poll() {
    fetch('/api/orders/' + encodeURIComponent(PAGE.orderId))
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res.ok) return;
        var o = res.order;
        renderStatus(o.status, o.note, res.events);
        if (TERMINAL.indexOf(o.status) !== -1) {
          stopped = true;
          clearInterval(timer);
          if (o.status !== PAGE.status) {
            window.toast('Status diperbarui: ' + (TONE[o.status] ? TONE[o.status][2] : o.status), 'ok');
            // refresh to re-render action panels for the new state
            setTimeout(function () { window.location.reload(); }, 900);
          }
        }
      })
      .catch(function () { /* keep polling */ });
  }

  if (!stopped) {
    timer = setInterval(poll, 4000);
    poll();
  }

  // Sandbox pay
  var sandboxPay = document.getElementById('sandboxPay');
  if (sandboxPay) {
    sandboxPay.addEventListener('click', function () {
      sandboxPay.disabled = true;
      sandboxPay.textContent = 'Memproses…';
      fetch('/api/orders/' + encodeURIComponent(PAGE.orderId) + '/sandbox/confirm', { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res.ok) {
            window.toast('Pembayaran sandbox berhasil', 'ok');
            setTimeout(function () { window.location.reload(); }, 700);
          } else {
            window.toast(res.error || 'Gagal', 'err');
            sandboxPay.disabled = false;
            sandboxPay.textContent = 'Simulasikan Pembayaran Berhasil';
          }
        })
        .catch(function () {
          window.toast('Terjadi kesalahan jaringan', 'err');
          sandboxPay.disabled = false;
          sandboxPay.textContent = 'Simulasikan Pembayaran Berhasil';
        });
    });
  }

  // Cancel
  var cancelBtn = document.getElementById('cancelOrder');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function () {
      if (!confirm('Yakin ingin membatalkan pesanan ini?')) return;
      fetch('/api/orders/' + encodeURIComponent(PAGE.orderId) + '/cancel', { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res.ok) { window.toast('Pesanan dibatalkan', 'ok'); setTimeout(function () { window.location.reload(); }, 600); }
          else window.toast(res.error || 'Gagal membatalkan', 'err');
        })
        .catch(function () { window.toast('Terjadi kesalahan jaringan', 'err'); });
    });
  }
})();
