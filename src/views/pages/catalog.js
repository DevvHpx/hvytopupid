// ============================================================
// GAME CATALOG  (/game)
// ============================================================
import { esc } from '../../utils/helpers.js';
import { gameCard, icon, sectionHead } from '../components.js';

export function catalogPage({ games, categories, q = '', category = '' }) {
  const chips = [
    `<a class="chip ${!category ? 'active' : ''}" href="/game${q ? `?q=${encodeURIComponent(q)}` : ''}">Semua</a>`,
    ...categories.map((c) => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      params.set('category', c.slug);
      return `<a class="chip ${category === c.slug ? 'active' : ''}" href="/game?${params}">${c.icon || ''} ${esc(c.name)}</a>`;
    }),
  ].join('');

  const grid = games.length
    ? `<div class="game-grid">${games.map((g, i) => gameCard(g, { eager: i < 5 })).join('')}</div>`
    : `<div class="empty"><div class="big">🔍</div><p>Game tidak ditemukan${q ? ` untuk “${esc(q)}”` : ''}.</p><p class="mt-8"><a class="btn btn-sm" href="/game">Reset pencarian</a></p></div>`;

  const body = `
<div class="container">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span class="sep">/</span><span>Game</span></nav>
  <div class="section" style="padding-top:14px">
    ${sectionHead('Semua Game &amp; Voucher', `${games.length} layanan tersedia`)}
    <form class="searchbar" action="/game" method="get" role="search" style="margin-bottom:16px">
      ${icon('search')}
      <input type="search" name="q" value="${esc(q)}" placeholder="Cari game… (contoh: Mobile Legends)" aria-label="Cari game">
      ${category ? `<input type="hidden" name="category" value="${esc(category)}">` : ''}
      <button class="btn btn-primary btn-sm" type="submit">Cari</button>
    </form>
    <div class="chips">${chips}</div>
  </div>
  <div class="section" style="padding-top:0">${grid}</div>
</div>`;
  return { title: 'Semua Game', active: 'game', body };
}
