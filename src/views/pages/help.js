// ============================================================
// BANTUAN  (/bantuan)
// ============================================================
import { esc } from '../../utils/helpers.js';
import { icon, notice } from '../components.js';
import { integrationStatus } from '../../providers/index.js';

export function helpPage({ faqs, settings }) {
  const st = integrationStatus();
  const faqHtml = faqs.map((f) => `<details><summary>${esc(f.question)}</summary><div class="ans">${esc(f.answer)}</div></details>`).join('');

  const statusRow = (label, ok) => `<div class="sum-row"><span class="k">${label}</span><span class="v">${ok ? '✅ Terkonfigurasi' : '⚠️ Belum dikonfigurasi'}</span></div>`;

  const contact = [];
  if (settings.support_whatsapp) contact.push(`<a class="btn btn-primary" href="https://wa.me/${esc(settings.support_whatsapp.replace(/[^0-9]/g, ''))}" target="_blank" rel="noopener">WhatsApp</a>`);
  if (settings.support_email) contact.push(`<a class="btn" href="mailto:${esc(settings.support_email)}">Email</a>`);
  const contactHtml = contact.length
    ? `<div class="hero-cta">${contact.join('')}</div>`
    : notice('Kanal bantuan langsung (WhatsApp/Email) <b>belum dikonfigurasi</b>. Hubungi admin untuk mengaktifkannya.', 'warn', '⚠️');

  const body = `
<div class="container" style="max-width:760px">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span class="sep">/</span><span>Bantuan</span></nav>
  <div class="section" style="padding-top:14px">
    <div class="section-head"><div><h2 class="silver-text">Pusat Bantuan</h2><div class="sub">Panduan, FAQ, dan status layanan</div></div></div>

    <div class="card">
      <h2 style="font-size:16px">Cara Top Up (3 Langkah)</h2>
      <div class="mt-12">
        <div class="sum-row"><span class="k">1. Pilih game</span><span class="v">Buka katalog &amp; pilih game</span></div>
        <div class="sum-row"><span class="k">2. Masukkan ID</span><span class="v">Isi User ID &amp; Zone/Server</span></div>
        <div class="sum-row"><span class="k">3. Bayar</span><span class="v">Pilih nominal &amp; metode pembayaran</span></div>
      </div>
    </div>

    <div class="card" id="faq">
      <h2 style="font-size:16px">Pertanyaan Umum</h2>
      <div class="faq mt-12" style="border:none">${faqHtml}</div>
    </div>

    <div class="card">
      <h2 style="font-size:16px">Hubungi Kami</h2>
      <p class="hint">Tim kami siap membantu. Sertakan Order ID agar penanganan lebih cepat.</p>
      <div class="mt-12">${contactHtml}</div>
    </div>

    <div class="card">
      <h2 style="font-size:16px">Status Layanan &amp; Integrasi</h2>
      <p class="hint">Transparansi status integrasi pihak ketiga. Fitur yang belum dikonfigurasi tidak akan menampilkan hasil palsu.</p>
      <div class="mt-12">
        ${statusRow('Payment Gateway', st.payment_gateway === 'configured')}
        ${statusRow('Supplier / Fulfilment API', st.supplier_api === 'configured')}
        ${statusRow('Validasi ID Otomatis', st.id_validation === 'configured')}
        <div class="sum-row"><span class="k">Mode Sandbox (Uji)</span><span class="v">${st.sandbox_enabled ? '🧪 Aktif' : 'Nonaktif'}</span></div>
      </div>
    </div>
  </div>
</div>`;
  return { title: 'Bantuan & FAQ', active: 'bantuan', body };
}
