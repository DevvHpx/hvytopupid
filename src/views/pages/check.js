// ============================================================
// CEK PESANAN  (/cek-pesanan)
// ============================================================
import { esc, rupiah, formatDateTime } from '../../utils/helpers.js';
import { icon, notice, statusPill } from '../components.js';

export function checkPage({ orderId = '', contact = '', result = null }) {
  let resultHtml = '';
  if (result) {
    if (result.ok) {
      const o = result.order;
      resultHtml = `<div class="card mt-16">
        <div class="section-head" style="margin-bottom:10px">
          <div><h2 style="font-size:16px">${esc(o.order_id)}</h2><div class="sub">${esc(formatDateTime(o.created_at))}</div></div>
          ${statusPill(o.status)}
        </div>
        <div class="sum-row"><span class="k">Game</span><span class="v">${esc(o.game_name)}</span></div>
        <div class="sum-row"><span class="k">Produk</span><span class="v">${esc(o.product_name)}</span></div>
        <div class="sum-row"><span class="k">Total</span><span class="v">${rupiah(o.total)}</span></div>
        <a class="btn btn-primary btn-block mt-12" href="/order/${esc(o.order_id)}">Lihat Detail &amp; Status ${icon('arrow')}</a>
      </div>`;
    } else {
      resultHtml = `<div class="mt-16">${notice(esc(result.error), 'err', '❌')}</div>`;
    }
  }

  const body = `
<div class="container" style="max-width:640px">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span class="sep">/</span><span>Cek Pesanan</span></nav>
  <div class="section" style="padding-top:14px">
    <div class="section-head"><div><h2 class="silver-text">Cek Pesanan</h2><div class="sub">Lacak status top-up kamu secara real-time</div></div></div>
    <div class="card">
      <p class="hint">Masukkan Order ID kamu. Email atau nomor WhatsApp hanya diperlukan bila kamu mengisinya saat checkout.</p>
      <form method="get" action="/cek-pesanan" novalidate>
        <div class="field">
          <label for="order">Order ID <span class="req">*</span></label>
          <input type="text" id="order" name="order" value="${esc(orderId)}" placeholder="Contoh: HVY-241008-AB12CD" required autocomplete="off">
        </div>
        <div class="field">
          <label for="contact">Email / Nomor WhatsApp <span class="opt">(opsional)</span></label>
          <input type="text" id="contact" name="contact" value="${esc(contact)}" placeholder="nama@email.com atau 08xxxxxxxxxx" autocomplete="off">
        </div>
        <button class="btn btn-primary btn-block btn-lg mt-16" type="submit">${icon('search')} Cek Status</button>
      </form>
    </div>
    ${resultHtml}
  </div>
</div>`;
  return { title: 'Cek Pesanan', active: 'cek', body };
}
