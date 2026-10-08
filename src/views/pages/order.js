// ============================================================
// PAYMENT / ORDER STATUS  (/order/:orderId)
// ============================================================
import { esc, rupiah, formatDateTime } from '../../utils/helpers.js';
import { icon, notice, statusPill, stepsBar, timeline } from '../components.js';

export function orderPage({ order, events, game, methodStatus }) {
  const fields = game ? game.id_fields : [];
  const accountRows = fields.map((f) => `
    <div class="sum-row"><span class="k">${esc(f.label)}</span><span class="v">${esc(order.account_fields[f.key] || '—')}</span></div>`).join('');

  const isPending = order.status === 'pending_payment';
  const isDone = ['success', 'failed', 'cancelled', 'refund'].includes(order.status);

  // Payment panel
  let payPanel = '';
  if (isPending) {
    if (methodStatus.sandbox) {
      payPanel = `<div class="card">
        <h2 style="font-size:15px">🧪 Pembayaran Sandbox</h2>
        <p class="hint">Mode uji aktif. Klik tombol di bawah untuk memproses pesanan melalui alur pembayaran yang sama dengan transaksi nyata.</p>
        <button class="btn btn-primary btn-block btn-lg mt-12" id="sandboxPay">Simulasikan Pembayaran Berhasil</button>
        <button class="btn btn-ghost btn-block mt-8" id="cancelOrder">Batalkan Pesanan</button>
      </div>`;
    } else {
      payPanel = `<div class="card">
        <h2 style="font-size:15px">Instruksi Pembayaran</h2>
        ${notice(`Metode <b>${esc(order.payment_name)}</b> belum dikonfigurasi, sehingga instruksi pembayaran belum tersedia. Hubungi admin untuk mengaktifkan payment gateway.`, 'warn', '⚠️')}
        <button class="btn btn-ghost btn-block mt-12" id="cancelOrder">Batalkan Pesanan</button>
      </div>`;
    }
  }

  const body = `
<div class="container">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">/</span><a href="/cek-pesanan">Cek Pesanan</a><span class="sep">/</span><span>${esc(order.order_id)}</span>
  </nav>

  <div class="section" style="padding-top:14px">
    <div class="section-head">
      <div>
        <h2 class="silver-text">Status Pesanan</h2>
        <div class="sub">Order ID <b style="color:var(--silver-2)">${esc(order.order_id)}</b> · ${esc(formatDateTime(order.created_at))}</div>
      </div>
      <span id="statusPillHost">${statusPill(order.status)}</span>
    </div>
    <div class="steps" id="stepsHost" aria-hidden="true">${stepsBar(order.status).replace(/^<div class="steps"[^>]*>|<\/div>$/g, '')}</div>
    <div id="statusNote">${order.note ? notice(esc(order.note), 'info', 'ℹ️') : ''}</div>
  </div>

  <div class="two-col" style="margin-top:0">
    <div>
      ${payPanel}
      <div class="card">
        <h2 style="font-size:15px">Riwayat Pesanan</h2>
        <div id="timelineHost" class="mt-12">${timeline(events)}</div>
      </div>
    </div>

    <div>
      <div class="card summary">
        <h2 style="font-size:15px">Detail Pesanan</h2>
        <div class="mt-12">
          <div class="sum-row"><span class="k">Game</span><span class="v">${esc(order.game_name)}</span></div>
          ${accountRows}
          <div class="sum-row"><span class="k">Produk</span><span class="v">${esc(order.product_name)}</span></div>
          <div class="sum-row"><span class="k">Metode</span><span class="v">${esc(order.payment_name)}</span></div>
          <div class="sum-row"><span class="k">Harga</span><span class="v">${rupiah(order.price)}</span></div>
          <div class="sum-row"><span class="k">Biaya Admin</span><span class="v">${rupiah(order.admin_fee)}</span></div>
          <div class="sum-row total"><span class="k">Total</span><span class="v">${rupiah(order.total)}</span></div>
        </div>
        ${order.email ? `<div class="sum-row mt-12"><span class="k">Email</span><span class="v">${esc(order.email)}</span></div>` : ''}
        ${order.whatsapp ? `<div class="sum-row"><span class="k">WhatsApp</span><span class="v">${esc(order.whatsapp)}</span></div>` : ''}
        <div class="orderid-box mt-16">
          <code>${esc(order.order_id)}</code>
          <button class="btn btn-sm copy" type="button" data-copy="${esc(order.order_id)}">${icon('copy')} Salin</button>
        </div>
        <a class="btn btn-ghost btn-block mt-12" href="/game/${esc(order.game_slug)}">Top Up Lagi</a>
      </div>
    </div>
  </div>
</div>

<script type="application/json" id="pageData">${JSON.stringify({
    orderId: order.order_id,
    sandbox: !!methodStatus.sandbox,
    status: order.status,
    terminal: isDone,
  }).replace(/</g, '\\u003c')}</script>`;

  return { title: `Pesanan ${order.order_id}`, active: 'cek', body, scripts: ['/js/order.js'] };
}
