// ============================================================
// HOME
// ============================================================
import { esc } from '../../utils/helpers.js';
import { gameCard, sectionHead, icon, notice } from '../components.js';
import { integrationStatus } from '../../providers/index.js';

export function homePage({ categories, popularGames, allGames, promos, faqs }) {
  const st = integrationStatus();

  const chips = [`<a class="chip active" href="/game">Semua</a>`,
    ...categories.map((c) => `<a class="chip" href="/game?category=${esc(c.slug)}">${c.icon || ''} ${esc(c.name)}</a>`)].join('');

  const popular = popularGames.map((g, i) => gameCard(g, { eager: i < 4 })).join('');

  const digital = allGames.filter((g) => g.category_slug === 'voucher').map((g) => gameCard(g)).join('');

  const promoHtml = promos.map((p) => `
    <a class="promo-card" href="${esc(p.link)}">
      ${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" decoding="async">` : ''}
      <div class="overlay">
        ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.subtitle)}</p>
      </div>
    </a>`).join('');

  const features = [
    ['bolt', 'Proses Kilat', 'Pesanan diproses otomatis dalam hitungan detik setelah pembayaran terkonfirmasi.'],
    ['shield', '100% Aman', 'Kami tidak pernah meminta password, OTP, atau data login akun game kamu.'],
    ['wallet', 'Harga Bersaing', 'Banyak pilihan nominal dengan harga terbaik dan biaya transparan tanpa kejutan.'],
    ['headset', 'Bantuan Responsif', 'Tim kami siap membantu setiap hari melalui kanal bantuan yang tersedia.'],
  ].map(([ic, t, d]) => `<div class="feature"><div class="ic">${icon(ic)}</div><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join('');

  const faqHtml = faqs.map((f) => `<details><summary>${esc(f.question)}</summary><div class="ans">${esc(f.answer)}</div></details>`).join('');

  const body = `
<section class="hero">
  <div class="hero-bg"></div>
  <div class="container hero-inner">
    <span class="hero-badge">${icon('bolt')} Proses Otomatis 24 Jam</span>
    <h1><span class="silver-text">Top Up Game</span><br>Lebih Cepat, Aman &amp; Terpercaya</h1>
    <p class="lead">Isi diamond, voucher, dan item game favoritmu dalam hitungan detik. Cukup masukkan User ID, pilih nominal, bayar, selesai.</p>
    <div class="hero-cta">
      <a class="btn btn-primary btn-lg" href="/game">Mulai Top Up ${icon('arrow')}</a>
      <a class="btn btn-ghost btn-lg" href="/cek-pesanan">Cek Pesanan</a>
    </div>
    <form class="searchbar" action="/game" method="get" role="search">
      ${icon('search')}
      <input type="search" name="q" placeholder="Cari game favoritmu…" aria-label="Cari game">
      <button class="btn btn-primary btn-sm" type="submit">Cari</button>
    </form>
    <div class="hero-stats">
      <div class="hero-stat"><b class="silver-text">${allGames.length}+</b><span>Game &amp; voucher tersedia</span></div>
      <div class="hero-stat"><b class="silver-text">24/7</b><span>Layanan otomatis</span></div>
      <div class="hero-stat"><b class="silver-text">Instan</b><span>Setelah pembayaran</span></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    ${sectionHead('Kategori Game', 'Pilih kategori untuk menemukan game favoritmu')}
    <div class="chips">${chips}</div>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="container">
    ${sectionHead('Game Populer', 'Paling banyak di-top up minggu ini', `<a class="more" href="/game">Lihat semua →</a>`)}
    <div class="game-grid">${popular}</div>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="container">
    ${sectionHead('Produk Digital &amp; Voucher', 'Voucher game &amp; saldo digital resmi', `<a class="more" href="/game?category=voucher">Lihat semua →</a>`)}
    <div class="game-grid">${digital}</div>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="container">
    ${sectionHead('Promo Berjalan', 'Hemat lebih banyak dengan promo aktif', `<a class="more" href="/promo">Semua promo →</a>`)}
    <div class="promo-grid">${promoHtml}</div>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="container">
    ${sectionHead('Kenapa HEAVYY TOP UP ID?', 'Dipercaya ribuan gamer di seluruh Indonesia')}
    <div class="features">${features}</div>
  </div>
</section>

<section class="section" style="padding-top:0" id="faq">
  <div class="container">
    ${sectionHead('Pertanyaan Umum', 'Hal yang paling sering ditanyakan')}
    <div class="faq">${faqHtml}</div>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="container">
    <div class="card center" style="padding:36px 20px">
      <h2 class="silver-text" style="justify-content:center;font-size:22px">Siap Top Up Sekarang?</h2>
      <p class="dim mt-8">Pilih game, masukkan ID, dan selesaikan dalam beberapa langkah sederhana.</p>
      <div class="hero-cta" style="justify-content:center">
        <a class="btn btn-primary btn-lg" href="/game">Pilih Game ${icon('arrow')}</a>
      </div>
    </div>
  </div>
</section>
`;

  return {
    title: 'Top Up Game Aman, Tercepat & Terpercaya',
    active: 'home',
    body,
    settings: {},
  };
}
