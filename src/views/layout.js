// ============================================================
// HTML shell: <head>, navbar, footer, toast host.
// ============================================================
import { esc } from '../utils/helpers.js';
import { icon } from './components.js';
import { ASSET_V } from '../utils/assets.js';

const NAV = [
  ['/', 'Home', 'home'],
  ['/game', 'Game', 'game'],
  ['/cek-pesanan', 'Cek Pesanan', 'cek'],
  ['/promo', 'Promo', 'promo'],
  ['/bantuan', 'Bantuan', 'bantuan'],
];

// Brand lockup: uploaded chrome+gem mark + wordmark.
function brandLockup({ size = 52, cls = '' } = {}) {
  return `<img class="brand-mark ${cls}" src="/img/brand/mark.png" alt="" width="${size}" height="${size}" fetchpriority="high">
      <span class="brand-text"><strong>HEAVYY</strong><small>TOP UP ID</small></span>`;
}

export function renderPage({ title, description = '', active = '', body, settings = {}, scripts = [] }) {
  const brand = settings.brand_name || 'HEAVYY TOP UP ID';
  const fullTitle = title ? `${title} \u2014 ${brand}` : `${brand} \u2014 Top Up Game Aman, Tercepat & Terpercaya`;
  const desc = description || 'Top up game favoritmu dalam hitungan detik. Proses otomatis 24 jam, harga bersaing, dan aman. Mobile Legends, Free Fire, PUBG Mobile, Genshin Impact, dan banyak lagi.';

  const navLinks = NAV.map(([href, label, key]) =>
    `<a href="${href}" class="${active === key ? 'active' : ''}">${label}</a>`).join('');
  const mobileLinks = NAV.map(([href, label]) => `<a href="${href}">${label}</a>`).join('');

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#08090c">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:image" content="/img/brand/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/styles.css?v=${ASSET_V}">
</head>
<body>
<a href="#main" class="hide">Lewati ke konten</a>
<header class="nav">
  <div class="container nav-inner">
    <a class="brand" href="/" aria-label="${esc(brand)}">
      ${brandLockup({ size: 52 })}
    </a>
    <nav class="nav-links" aria-label="Navigasi utama">${navLinks}</nav>
    <div class="nav-actions">
      <button class="icon-btn" id="openSearch" aria-label="Cari game">${icon('search')}</button>
      <button class="icon-btn nav-toggle" id="navToggle" aria-label="Menu" aria-expanded="false">${icon('menu')}</button>
    </div>
  </div>
  <div class="mobile-menu" id="mobileMenu">${mobileLinks}</div>
</header>

<main id="main">${body}</main>

<footer class="footer">
  <div class="container footer-grid">
    <div class="brand-col">
      <span class="brand brand-footer">
        ${brandLockup({ size: 40 })}
      </span>
      <p>Platform top-up game otomatis. Proses cepat, harga bersaing, dan aman. Kami tidak pernah meminta password, OTP, atau data login akun game kamu.</p>
      <div class="pay-logos">
        <span>QRIS</span><span>GoPay</span><span>OVO</span><span>DANA</span><span>ShopeePay</span><span>Virtual Account</span><span>Alfamart</span><span>Indomaret</span>
      </div>
    </div>
    <div>
      <h4>Navigasi</h4>
      <a href="/">Home</a>
      <a href="/game">Semua Game</a>
      <a href="/cek-pesanan">Cek Pesanan</a>
      <a href="/promo">Promo</a>
      <a href="/bantuan">Bantuan &amp; FAQ</a>
    </div>
    <div>
      <h4>Bantuan</h4>
      <a href="/bantuan#faq">Cara Top Up</a>
      <a href="/bantuan#faq">Metode Pembayaran</a>
      <a href="/bantuan#faq">Kebijakan Refund</a>
      <a href="/cek-pesanan">Lacak Transaksi</a>
    </div>
  </div>
  <div class="container footer-bottom">
    <span>&copy; ${new Date().getFullYear()} ${esc(brand)}. Seluruh hak cipta dilindungi.</span>
    <span>Nama &amp; logo game adalah milik masing-masing penerbit. Situs ini tidak berafiliasi dengan penerbit.</span>
  </div>
</footer>

<div class="search-overlay" id="searchOverlay" role="dialog" aria-modal="true" aria-label="Cari game">
  <div class="search-box">
    <form id="searchForm" action="/game" method="get">
      ${icon('search')}
      <input type="search" name="q" id="searchInput" placeholder="Cari game\u2026 (contoh: Mobile Legends)" autocomplete="off" aria-label="Kata kunci pencarian">
      <button type="button" class="icon-btn" id="closeSearch" aria-label="Tutup">${icon('close')}</button>
    </form>
    <div class="search-results" id="searchResults"></div>
  </div>
</div>

<div class="toast-wrap" id="toastWrap" aria-live="polite"></div>
<script src="/js/app.js?v=${ASSET_V}" defer></script>
${scripts.map((s) => `<script src="${s}?v=${ASSET_V}" defer></script>`).join('\n')}
</body>
</html>`;
}
