// ============================================================
// GAME DETAIL / TOP-UP  (/game/:slug)
// ============================================================
import { esc, rupiah } from '../../utils/helpers.js';
import { icon, notice } from '../components.js';
import { integrationStatus } from '../../providers/index.js';

export function gamePage({ game, products, payments, settings }) {
  const st = integrationStatus();

  // --- Step 1: account fields (built from the DB schema) ---
  const fields = game.id_fields.map((f) => {
    const req = f.required ? '<span class="req">*</span>' : '<span class="opt">(opsional)</span>';
    let control;
    if (f.type === 'select') {
      control = `<select name="${esc(f.key)}" data-field="${esc(f.key)}" ${f.required ? 'required' : ''}>
        <option value="">— Pilih ${esc(f.label)} —</option>
        ${(f.options || []).map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}
      </select>`;
    } else {
      control = `<input type="${f.type === 'number' ? 'text' : 'text'}" inputmode="${f.type === 'number' ? 'numeric' : 'text'}"
        name="${esc(f.key)}" data-field="${esc(f.key)}" placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''} autocomplete="off">`;
    }
    return `<div class="field" data-field-wrap="${esc(f.key)}">
      <label for="${esc(f.key)}">${esc(f.label)} ${req}</label>
      ${control}
      ${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}
      <div class="err" data-err="${esc(f.key)}"></div>
    </div>`;
  }).join('');

  const validationNotice = game.validation === 'available' && st.id_validation === 'configured'
    ? notice('Validasi ID otomatis aktif untuk game ini.', 'ok', '✅')
    : notice('Validasi ID otomatis <b>belum dikonfigurasi</b>. Mohon periksa kembali User ID &amp; Zone ID kamu sebelum melanjutkan.', 'warn', '⚠️');

  // --- Step 2: products ---
  const prodHtml = products.map((p) => `
    <button type="button" class="product ${p.status === 'out_of_stock' ? 'out' : ''}"
      data-product data-id="${p.id}" data-name="${esc(p.name)}" data-price="${p.price}"
      ${p.status === 'out_of_stock' ? 'disabled' : ''}>
      ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}
      <div class="name">${esc(p.name)}</div>
      <div class="denom">${esc(p.denomination || '')}</div>
      <div class="price">${rupiah(p.price)}</div>
      <div class="stock">${p.status === 'out_of_stock' ? 'Stok habis' : 'Tersedia'}</div>
    </button>`).join('');

  // --- Step 3: payment methods ---
  const payHtml = payments.map((m) => {
    const configured = m.config_status === 'configured';
    const isSandbox = m.type === 'sandbox';
    const fee = [];
    if (Number(m.fee_percent)) fee.push(`${m.fee_percent}%`);
    if (Number(m.fee_fixed)) fee.push(rupiah(m.fee_fixed));
    const feeLabel = fee.length ? `Biaya ${fee.join(' + ')}` : 'Tanpa biaya admin';
    const tag = configured
      ? (isSandbox ? '<span class="p-tag sandbox">MODE UJI</span>' : '<span class="p-tag">Aktif</span>')
      : '<span class="p-tag off">Belum dikonfigurasi</span>';
    return `<button type="button" class="pay-item ${configured ? '' : 'disabled'}"
        data-payment data-code="${esc(m.code)}" data-name="${esc(m.name)}"
        data-fee-percent="${m.fee_percent}" data-fee-fixed="${m.fee_fixed}"
        ${configured ? '' : 'disabled'} aria-disabled="${!configured}">
      <span class="p-ic">${esc((m.name[0] || '?').toUpperCase())}</span>
      <span>
        <span class="p-name">${esc(m.name)}</span>
        <span class="p-fee" style="display:block">${esc(feeLabel)}</span>
      </span>
      ${tag}
    </button>`;
  }).join('');

  const anyConfigured = payments.some((m) => m.config_status === 'configured');
  const payNotice = anyConfigured
    ? notice('Metode pembayaran bertanda <b>“Belum dikonfigurasi”</b> belum tersedia karena kredensial payment gateway belum dipasang. Gunakan <b>Sandbox (Mode Uji)</b> untuk mencoba alur lengkap.', 'info', '💳')
    : notice('Belum ada metode pembayaran yang dikonfigurasi. Hubungi admin untuk mengaktifkan payment gateway.', 'warn', '⚠️');

  const body = `
<div class="container">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">/</span><a href="/game">Game</a><span class="sep">/</span><span>${esc(game.name)}</span>
  </nav>

  <div class="game-hero">
    <img class="banner" src="${esc(game.banner)}" alt="Banner ${esc(game.name)}" width="1200" height="420" fetchpriority="high">
    <div class="g-head">
      <img class="logo" src="${esc(game.logo)}" alt="Logo ${esc(game.name)}" width="68" height="68">
      <div>
        <h1>${esc(game.name)}</h1>
        <div class="pub">${esc(game.publisher || '')}${game.category_name ? ` · ${esc(game.category_name)}` : ''}</div>
      </div>
    </div>
  </div>

  <div class="two-col">
    <div>
      <div class="card">
        <h2><span class="step-n">1</span> Masukkan Data Akun</h2>
        <p class="hint">${esc(game.instructions || 'Masukkan data akun kamu dengan benar.')}</p>
        <form id="topupForm" novalidate>
          ${fields}
          <div class="mt-12">
            <button type="button" class="btn btn-ghost btn-sm" id="validateBtn">${icon('shield')} Cek ID Otomatis</button>
          </div>
          <div id="validationResult"></div>
        </form>
        ${validationNotice}
      </div>

      <div class="card">
        <h2><span class="step-n">2</span> Pilih Nominal</h2>
        <p class="hint">Pilih denominasi yang ingin kamu top up.</p>
        <div class="product-grid mt-12" id="productGrid">${prodHtml}</div>
      </div>

      <div class="card">
        <h2><span class="step-n">3</span> Pilih Metode Pembayaran</h2>
        <p class="hint">Biaya admin ditampilkan transparan sebelum kamu membayar.</p>
        <div class="pay-list mt-12" id="payList">${payHtml}</div>
        ${payNotice}
      </div>
    </div>

    <div>
      <div class="card summary">
        <h2 style="font-size:15px">Ringkasan Pesanan</h2>
        <div class="mt-12">
          <div class="sum-row"><span class="k">Game</span><span class="v">${esc(game.name)}</span></div>
          <div class="sum-row"><span class="k">Data Akun</span><span class="v" id="sumAccount">—</span></div>
          <div class="sum-row"><span class="k">Produk</span><span class="v" id="sumProduct">—</span></div>
          <div class="sum-row"><span class="k">Harga Produk</span><span class="v" id="sumPrice">Rp 0</span></div>
          <div class="sum-row"><span class="k">Biaya Admin</span><span class="v" id="sumFee">Rp 0</span></div>
          <div class="sum-row total"><span class="k">Total</span><span class="v" id="sumTotal">Rp 0</span></div>
        </div>
        <button class="btn btn-primary btn-block btn-lg mt-16" id="buyBtn" disabled>Beli Sekarang</button>
        <p class="hint center mt-8" id="buyHint">Lengkapi data akun dan pilih nominal untuk melanjutkan.</p>
      </div>
    </div>
  </div>
</div>

<script type="application/json" id="pageData">${JSON.stringify({
    slug: game.slug,
    gameName: game.name,
    fields: game.id_fields,
    validationConfigured: game.validation === 'available' && st.id_validation === 'configured',
  }).replace(/</g, '\\u003c')}</script>`;

  return { title: `${game.name} — Top Up`, active: 'game', body, scripts: ['/js/game.js'] };
}
