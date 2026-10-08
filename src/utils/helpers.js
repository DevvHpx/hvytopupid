// ============================================================
// Shared helpers: formatting, ids, sanitising, escaping.
// ============================================================

// Escape untrusted text before injecting into HTML.
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Format an integer rupiah amount -> "Rp 15.000"
export function rupiah(amount) {
  const n = Number(amount) || 0;
  return 'Rp ' + n.toLocaleString('id-ID');
}

// Public order id: HVY-YYMMDD-XXXXXX
export function makeOrderId() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) rand += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `HVY-${yy}${mm}${dd}-${rand}`;
}

export function nowIso() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

// Human friendly relative/absolute time for the timeline.
export function formatDateTime(value) {
  if (!value) return '';
  const iso = String(value).includes('T') ? value : String(value).replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }) + ' WIB';
}

// Basic contact validation (email OR indonesian whatsapp).
export function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
}
export function normalizePhone(v) {
  let s = String(v || '').replace(/[\s\-()]/g, '');
  if (s.startsWith('+62')) s = '0' + s.slice(3);
  if (s.startsWith('62')) s = '0' + s.slice(2);
  return s;
}
export function isValidPhone(v) {
  const s = normalizePhone(v);
  return /^08[0-9]{7,13}$/.test(s);
}

export function slugify(v) {
  return String(v || '').toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

// Parse a JSON column safely.
export function parseJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}
