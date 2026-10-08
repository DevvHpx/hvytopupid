// ============================================================
// Generates original, brand-consistent SVG assets:
//   - game badge logos  -> public/img/games/<slug>.svg
//   - game banners      -> public/img/banners/<slug>.svg
//   - brand logo + favicon
// These are ORIGINAL designs (monogram badges), not copies of
// any publisher's trademarked artwork.
// ============================================================
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gamesDir = join(root, 'public', 'img', 'games');
const bannersDir = join(root, 'public', 'img', 'banners');
const brandDir = join(root, 'public', 'img', 'brand');
[gamesDir, bannersDir, brandDir].forEach((d) => mkdirSync(d, { recursive: true }));

// slug, monogram, display name, accent colour, short tagline
const GAMES = [
  ['mobile-legends', 'ML', 'MOBILE LEGENDS', '#3b82f6', 'MOBA 5v5'],
  ['free-fire', 'FF', 'FREE FIRE', '#f97316', 'Battle Royale'],
  ['pubg-mobile', 'PUBG', 'PUBG MOBILE', '#f59e0b', 'Battle Royale'],
  ['honor-of-kings', 'HoK', 'HONOR OF KINGS', '#eab308', 'MOBA 5v5'],
  ['genshin-impact', 'GI', 'GENSHIN IMPACT', '#22d3ee', 'Open World RPG'],
  ['roblox', 'RBX', 'ROBLOX', '#ef4444', 'Sandbox'],
  ['valorant', 'VAL', 'VALORANT', '#fb7185', 'Tactical FPS'],
  ['cod-mobile', 'COD', 'CALL OF DUTY MOBILE', '#22c55e', 'FPS'],
  ['arena-of-valor', 'AoV', 'ARENA OF VALOR', '#a855f7', 'MOBA 5v5'],
  ['wild-rift', 'WR', 'WILD RIFT', '#38bdf8', 'MOBA 5v5'],
  ['clash-of-clans', 'CoC', 'CLASH OF CLANS', '#f59e0b', 'Strategy'],
  ['point-blank', 'PB', 'POINT BLANK', '#0ea5e9', 'FPS'],
  ['growtopia', 'GT', 'GROWTOPIA', '#4ade80', 'Sandbox'],
  ['higgs-domino', 'HD', 'HIGGS DOMINO', '#eab308', 'Casual'],
  ['steam-wallet', 'ST', 'STEAM WALLET', '#94a3b8', 'Voucher'],
  ['google-play', 'GP', 'GOOGLE PLAY', '#34d399', 'Voucher'],
];

const SILVER = `
  <linearGradient id="silver" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff"/>
    <stop offset="0.28" stop-color="#eef1f4"/>
    <stop offset="0.5" stop-color="#a7b0ba"/>
    <stop offset="0.68" stop-color="#f6f8fa"/>
    <stop offset="1" stop-color="#c4ccd4"/>
  </linearGradient>`;

function badge([slug, mono, name, accent, tag]) {
  const fs = mono.length >= 4 ? 60 : mono.length === 3 ? 76 : 96;
  const label = name.length > 16 ? tag.toUpperCase() : name;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-label="${name}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#20242b"/>
      <stop offset="0.55" stop-color="#12151a"/>
      <stop offset="1" stop-color="#08090c"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="38%" r="60%">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    ${SILVER}
  </defs>
  <rect width="256" height="256" rx="58" fill="url(#bg)"/>
  <rect x="3" y="3" width="250" height="250" rx="55" fill="none" stroke="url(#silver)" stroke-opacity="0.45" stroke-width="2"/>
  <ellipse cx="128" cy="104" rx="104" ry="96" fill="url(#glow)"/>
  <text x="128" y="132" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fs}" font-weight="800" letter-spacing="1" fill="url(#silver)">${mono}</text>
  <text x="128" y="196" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" letter-spacing="1.5" fill="#cbd5e1" opacity="0.9">${label}</text>
</svg>`;
}

function banner([slug, mono, name, accent, tag]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 420" width="1200" height="420" role="img" aria-label="${name}">
  <defs>
    <linearGradient id="bbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a0b0e"/>
      <stop offset="0.5" stop-color="#16191f"/>
      <stop offset="1" stop-color="#0a0b0e"/>
    </linearGradient>
    <radialGradient id="bglow" cx="78%" cy="30%" r="70%">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.42"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    ${SILVER}
  </defs>
  <rect width="1200" height="420" fill="url(#bbg)"/>
  <rect width="1200" height="420" fill="url(#bglow)"/>
  <g opacity="0.10" stroke="#ffffff" stroke-width="1">
    ${Array.from({ length: 14 }, (_, i) => `<line x1="${i * 90}" y1="0" x2="${i * 90 - 120}" y2="420"/>`).join('')}
  </g>
  <rect x="0" y="0" width="1200" height="6" fill="url(#silver)" opacity="0.5"/>
  <text x="72" y="168" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" letter-spacing="6" fill="#9aa3ad">${tag.toUpperCase()}</text>
  <text x="70" y="252" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="800" letter-spacing="1" fill="url(#silver)">${name}</text>
  <text x="72" y="308" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="600" fill="#cbd5e1" opacity="0.85">Top Up Instan &#183; Proses Otomatis 24 Jam</text>
  <g transform="translate(940,96)">
    <rect width="180" height="180" rx="42" fill="#0b0d10" stroke="url(#silver)" stroke-opacity="0.4" stroke-width="2"/>
    <ellipse cx="90" cy="74" rx="80" ry="70" fill="${accent}" opacity="0.25"/>
    <text x="90" y="118" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="800" fill="url(#silver)">${mono}</text>
  </g>
</svg>`;
}

for (const g of GAMES) {
  writeFileSync(join(gamesDir, `${g[0]}.svg`), badge(g));
  writeFileSync(join(bannersDir, `${g[0]}.svg`), banner(g));
}

// ---- Brand wordmark (HEAVYY TOP UP ID) ----
const brand = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 140" width="620" height="140" role="img" aria-label="HEAVYY TOP UP ID">
  <defs>
    <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.30" stop-color="#eef1f4"/>
      <stop offset="0.50" stop-color="#9aa3ad"/>
      <stop offset="0.62" stop-color="#f6f8fa"/>
      <stop offset="0.80" stop-color="#c4ccd4"/>
      <stop offset="1" stop-color="#7f8891"/>
    </linearGradient>
    <linearGradient id="gem" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8fd3ff"/>
      <stop offset="0.5" stop-color="#3b82f6"/>
      <stop offset="1" stop-color="#1d4ed8"/>
    </linearGradient>
  </defs>
  <g transform="translate(6,14)">
    <path d="M14 8 L40 8 L40 44 L72 44 L72 8 L98 8 L98 104 L72 104 L72 70 L40 70 L40 104 L14 104 Z" fill="url(#chrome)"/>
    <path d="M112 8 L138 8 L160 68 L182 8 L208 8 L172 104 L148 104 Z" fill="url(#chrome)"/>
    <path d="M196 34 L232 8 L262 30 L228 58 Z" fill="url(#gem)" opacity="0.95"/>
    <path d="M228 58 L262 30 L262 78 Z" fill="#1e40af" opacity="0.75"/>
  </g>
  <text x="286" y="72" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="800" letter-spacing="1" fill="url(#chrome)">HEAVYY</text>
  <text x="288" y="112" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" letter-spacing="8" fill="#cbd5e1">TOP UP ID</text>
</svg>`;

const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="HEAVYY mark">
  <defs>
    <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="0.3" stop-color="#eef1f4"/>
      <stop offset="0.5" stop-color="#9aa3ad"/><stop offset="0.62" stop-color="#f6f8fa"/>
      <stop offset="0.8" stop-color="#c4ccd4"/><stop offset="1" stop-color="#7f8891"/>
    </linearGradient>
    <linearGradient id="gem" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8fd3ff"/><stop offset="0.5" stop-color="#3b82f6"/><stop offset="1" stop-color="#1d4ed8"/>
    </linearGradient>
  </defs>
  <rect width="120" height="120" rx="30" fill="#0b0d10"/>
  <rect x="2" y="2" width="116" height="116" rx="28" fill="none" stroke="url(#chrome)" stroke-opacity="0.4" stroke-width="2"/>
  <g transform="translate(20,26) scale(0.72)">
    <path d="M14 8 L40 8 L40 44 L72 44 L72 8 L98 8 L98 104 L72 104 L72 70 L40 70 L40 104 L14 104 Z" fill="url(#chrome)"/>
    <path d="M112 8 L138 8 L160 68 L182 8 L208 8 L172 104 L148 104 Z" fill="url(#chrome)"/>
    <path d="M196 34 L232 8 L262 30 L228 58 Z" fill="url(#gem)"/>
  </g>
</svg>`;

writeFileSync(join(brandDir, 'logo.svg'), brand);
writeFileSync(join(brandDir, 'mark.svg'), mark);
writeFileSync(join(root, 'public', 'favicon.svg'), mark);

console.log(`Generated ${GAMES.length} game badges, ${GAMES.length} banners, brand logo + mark.`);
