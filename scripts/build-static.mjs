// ============================================================
// Build a static mirror of the SSR pages for a visual preview.
// The live app is dynamic (Express + SQLite); this snapshot is
// only for browsing the UI on a static host.
// ============================================================
import { mkdir, writeFile, cp, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'static-preview');
const BASE = process.env.BASE || 'http://localhost:3000';

const slugs = [
  'mobile-legends', 'free-fire', 'pubg-mobile', 'honor-of-kings', 'genshin-impact',
  'roblox', 'valorant', 'cod-mobile', 'arena-of-valor', 'wild-rift', 'clash-of-clans',
  'point-blank', 'growtopia', 'higgs-domino', 'steam-wallet', 'google-play',
];

// [route, output file, depth]
const routes = [
  ['/', 'index.html', 0],
  ['/game', 'game/index.html', 1],
  ['/promo', 'promo/index.html', 1],
  ['/bantuan', 'bantuan/index.html', 1],
  ['/cek-pesanan', 'cek-pesanan/index.html', 1],
  ...slugs.map((s) => [`/game/${s}`, `game/${s}/index.html`, 2]),
];

function rewrite(html, depth) {
  const prefix = '../'.repeat(depth);
  const root = prefix || './';
  // Strip cache-busting query from asset urls (static host friendly).
  html = html.replace(/(\.(?:css|js))\?v=[^"']*/g, '$1');
  html = html.replace(/(href|src|content)="([^"]*)"/g, (m, attr, val) => {
    if (!val.startsWith('/')) return m; // external / relative / hash untouched
    const path = val.slice(1);
    const idx = path.search(/[?#]/);
    let head = idx === -1 ? path : path.slice(0, idx);
    const tail = idx === -1 ? '' : path.slice(idx);
    if (head === '') return `${attr}="${root}"`;
    if (!/\.[a-z0-9]+$/i.test(head) && !head.endsWith('/')) head += '/';
    return `${attr}="${prefix}${head}${tail}"`;
  });
  return html;
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  for (const [route, file, depth] of routes) {
    const res = await fetch(BASE + route);
    if (!res.ok) { console.warn('skip', route, res.status); continue; }
    let html = rewrite(await res.text(), depth);
    html = html.replace(
      '</body>',
      `<div style="position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#0b0f17;border-top:1px solid #2a3240;color:#c7ced9;font:12px/1.5 system-ui,sans-serif;padding:8px 14px;text-align:center">Pratinjau statis — alur pesanan &amp; pembayaran berjalan pada server Node (lihat README).</div></body>`,
    );
    const full = join(OUT, file);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, html);
    console.log('saved', route, '->', file);
  }

  await cp(join(ROOT, 'public'), OUT, { recursive: true });
  console.log('assets copied');
}

main().catch((e) => { console.error(e); process.exit(1); });
