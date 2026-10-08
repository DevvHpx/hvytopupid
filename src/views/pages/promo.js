// ============================================================
// PROMO  (/promo)
// ============================================================
import { esc } from '../../utils/helpers.js';
import { icon } from '../components.js';

export function promoPage({ promos }) {
  const cards = promos.map((p) => `
    <div class="card" style="padding:0;overflow:hidden">
      <div class="promo-card" style="min-height:160px;border:none;border-radius:0">
        ${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" decoding="async">` : ''}
        <div class="overlay">
          ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.subtitle)}</p>
        </div>
      </div>
      <div style="padding:16px 18px">
        <p class="dim" style="font-size:13px">${esc(p.description)}</p>
        <div class="mt-12" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${p.code ? `<span class="orderid-box" style="margin:0;padding:8px 12px"><code style="font-size:13px">${esc(p.code)}</code><button class="btn btn-sm copy" type="button" data-copy="${esc(p.code)}">${icon('copy')}</button></span>` : ''}
          <a class="btn btn-primary btn-sm" href="${esc(p.link)}">Gunakan Promo ${icon('arrow')}</a>
        </div>
      </div>
    </div>`).join('');

  const body = `
<div class="container">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span class="sep">/</span><span>Promo</span></nav>
  <div class="section" style="padding-top:14px">
    <div class="section-head"><div><h2 class="silver-text">Promo &amp; Penawaran</h2><div class="sub">Hemat lebih banyak setiap transaksi</div></div></div>
    <div class="promo-grid" style="grid-template-columns:1fr">${cards || '<div class="empty"><div class="big">🎁</div><p>Belum ada promo aktif saat ini.</p></div>'}</div>
  </div>
</div>`;
  return { title: 'Promo', active: 'promo', body };
}
