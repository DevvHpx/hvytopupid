// Asset version = file mtime, so updated CSS/JS busts the browser cache.
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
function v(rel) {
  try { return Math.floor(statSync(join(root, rel)).mtimeMs).toString(36); } catch { return '1'; }
}
export const ASSET_V = [v('public/css/styles.css'), v('public/js/app.js'), v('public/js/game.js'), v('public/js/checkout.js'), v('public/js/order.js')].join('-');
