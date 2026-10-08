// ============================================================
// CHECKOUT  (/checkout/:orderId)
// ============================================================
import { esc, rupiah } from '../../utils/helpers.js';
import { icon, notice, statusPill } from '../components.js';

export function checkoutPage({ order, game, method, methodStatus }) {
  const fields = game ? game.id_fields : [];
  const accountRows = fields.map((f) => `
    <div class="sum-row"><span class="k">${esc(f.label)}</span><span class="v">${esc(order.account_fields[f.key] || '—')}</span></div>`).join('');

  const payNotice = methodStatus.sandbox
    ? notice('Metode <b>Sandbox (Mode Uji)</b> aktif. Pembayaran disimulasikan untuk menguji alur — tidak ada transaksi nyata.', 'info', '🧪')
    : (methodStatus.ok
      ? notice('Metode pembayaran siap digunakan.', 'ok', '✅')
      : notice(`Metode ini <b>belum dikonfigurasi</b>. ${esc(methodStatus.reason)}`, 'warn', '⚠️'));

  const body = `
<div class="container">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">/</span><a href="/game">Game</a>
    <span class="sep">/</span><a href="/game/${esc(order.game_slug)}">${esc(order.game_name)}</a>
    <span class="sep">/</span><span>Checkout</span>
  </nav>

  <div class="section" style="padding-top:14px">
    <div class="section-head"><div><h2 class="silver-text">Konfirmasi Pesanan</h2><div class="sub">Periksa kembali detail pesanan sebelum membayar</div></div>${statusPill(order.status)}</div>
  </div>

  <div class="two-col" style="margin-top:0">
    <div>
      <div class="card">
        <h2 style="font-size:15px">Detail Pesanan</h2>
        <div class="mt-12">
          <div class="sum-row"><span class="k">Game</span><span class="v">${esc(order.game_name)}</span></div>
          ${accountRows}
          <div class="sum-row"><span class="k">Produk</span><span class="v">${esc(order.product_name)}</span></div>
          <div class="sum-row"><span class="k">Metode Pembayaran</span><span class="v">${esc(order.payment_name)}</span></div>
        </div>
        ${payNotice}
      </div>

      <div class="card">
        <h2 style="font-size:15px">Kontak (Opsional)</h2>
        <p class="hint">Isi email atau nomor WhatsApp untuk menerima notifikasi &amp; memudahkan pengecekan pesanan.</p>
        <form id="checkoutForm" novalidate>
          <div class="field-row">
            <div class="field" data-field-wrap="email">
              <label for="email">Email <span class="opt">(opsional)</span></label>
              <input type="email" id="email" name="email" value="${esc(order.email)}" placeholder="nama@email.com" autocomplete="email">
              <div class="err" data-err="email"></div>
            </div>
            <div class="field" data-field-wrap="whatsapp">
              <label for="whatsapp">Nomor WhatsApp <span class="opt">(opsional)</span></label>
              <input type="tel" id="whatsapp" name="whatsapp" value="${esc(order.whatsapp)}" placeholder="08xxxxxxxxxx" autocomplete="tel" inputmode="numeric">
              <div class="err" data-err="whatsapp"></div>
            </div>
          </div>
        </form>
      </div>

      <div class="card">
        <h2 style="font-size:15px">Order ID</h2>
        <p class="hint">Simpan Order ID ini untuk melacak status pesananmu.</p>
        <div class="orderid-box">
          <code id="orderIdValue">${esc(order.order_id)}</code>
          <button class="btn btn-sm copy" type="button" data-copy="${esc(order.order_id)}">${icon('copy')} Salin</button>
        </div>
      </div>
    </div>

    <div>
      <div class="card summary">
        <h2 style="font-size:15px">Ringkasan Pembayaran</h2>
        <div class="mt-12">
          <div class="sum-row"><span class="k">Harga Produk</span><span class="v">${rupiah(order.price)}</span></div>
          <div class="sum-row"><span class="k">Biaya Admin</span><span class="v">${rupiah(order.admin_fee)}</span></div>
          <div class="sum-row total"><span class="k">Total Pembayaran</span><span class="v">${rupiah(order.total)}</span></div>
        </div>
        <button class="btn btn-primary btn-block btn-lg mt-16" id="payBtn">Bayar ${rupiah(order.total)}</button>
        <p class="hint center mt-8">Dengan membayar, kamu menyetujui syarat &amp; ketentuan layanan.</p>
      </div>
    </div>
  </div>
</div>

<script type="application/json" id="pageData">${JSON.stringify({
    orderId: order.order_id,
    sandbox: !!methodStatus.sandbox,
  }).replace(/</g, '\\u003c')}</script>`;

  return { title: 'Checkout', active: 'game', body, scripts: ['/js/checkout.js'] };
}
