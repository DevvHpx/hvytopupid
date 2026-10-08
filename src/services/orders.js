// ============================================================
// Order service — creation, validation and the status state machine.
// ============================================================
import { all, get, run } from '../db/index.js';
import { getGameBySlug, getProduct, getPaymentMethod } from './catalog.js';
import { payment as paymentProvider, supplier as supplierProvider } from '../providers/index.js';
import { makeOrderId, parseJson, isValidEmail, isValidPhone, normalizePhone } from '../utils/helpers.js';

// Canonical status metadata used by every page.
export const STATUS = {
  pending_payment: { label: 'Menunggu Pembayaran', tone: 'warn', step: 1, icon: '⏳' },
  paid:            { label: 'Pembayaran Berhasil', tone: 'info', step: 2, icon: '✅' },
  processing:      { label: 'Memproses Top-Up',    tone: 'info', step: 3, icon: '⚙️' },
  success:         { label: 'Top-Up Berhasil',     tone: 'ok',   step: 4, icon: '🎉' },
  failed:          { label: 'Top-Up Gagal',        tone: 'err',  step: 4, icon: '⚠️' },
  cancelled:       { label: 'Dibatalkan',          tone: 'muted',step: 0, icon: '🚫' },
  refund:          { label: 'Refund / Perlu Penanganan', tone: 'err', step: 4, icon: '↩️' },
};

export function statusMeta(status) {
  return STATUS[status] || { label: status, tone: 'muted', step: 0, icon: '•' };
}

export function computeFee(method, price) {
  if (!method) return 0;
  const pct = Math.round((price * (Number(method.fee_percent) || 0)) / 100);
  return pct + (Number(method.fee_fixed) || 0);
}

// Validate the account fields the user submitted against the game's schema.
export function validateFields(game, fields = {}) {
  const errors = {};
  for (const f of game.id_fields) {
    const raw = fields[f.key];
    const val = raw === undefined || raw === null ? '' : String(raw).trim();
    if (f.required && !val) { errors[f.key] = `${f.label} wajib diisi.`; continue; }
    if (!val) continue;
    if (f.type === 'number' && !/^[0-9]+$/.test(val)) errors[f.key] = `${f.label} hanya boleh angka.`;
    if (f.type === 'text' && val.length < 3) errors[f.key] = `${f.label} minimal 3 karakter.`;
    if (f.type === 'select' && Array.isArray(f.options) && !f.options.includes(val)) errors[f.key] = `Pilihan ${f.label} tidak valid.`;
  }
  return errors;
}

export function createOrder({ gameSlug, productId, fields = {}, email = '', whatsapp = '', paymentCode = '' }) {
  const game = getGameBySlug(gameSlug);
  if (!game) return { ok: false, error: 'Game tidak ditemukan.' };

  const product = getProduct(Number(productId));
  if (!product || product.game_id !== game.id) return { ok: false, error: 'Produk tidak valid.' };
  if (product.status !== 'active') return { ok: false, error: 'Produk sedang tidak tersedia.' };

  const fieldErrors = validateFields(game, fields);
  if (Object.keys(fieldErrors).length) return { ok: false, error: 'Data akun belum lengkap.', fieldErrors };

  email = String(email || '').trim();
  whatsapp = String(whatsapp || '').trim();
  if (email && !isValidEmail(email)) return { ok: false, error: 'Format email tidak valid.' };
  if (whatsapp && !isValidPhone(whatsapp)) return { ok: false, error: 'Format nomor WhatsApp tidak valid.' };

  const method = getPaymentMethod(paymentCode);
  if (!method) return { ok: false, error: 'Pilih metode pembayaran.' };
  const payStatus = paymentProvider.status(method.code);
  if (!payStatus.ok) return { ok: false, error: `Metode pembayaran tidak tersedia. ${payStatus.reason}` };

  const price = product.price;
  const adminFee = computeFee(method, price);
  const total = price + adminFee;

  // Keep only the fields defined by the game schema.
  const cleanFields = {};
  for (const f of game.id_fields) cleanFields[f.key] = String(fields[f.key] ?? '').trim();

  const orderId = makeOrderId();
  run(`INSERT INTO orders
      (order_id, game_id, product_id, game_name, game_slug, product_name, account_fields,
       email, whatsapp, price, admin_fee, total, payment_code, payment_name,
       payment_status, topup_status, status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'unpaid','pending','pending_payment')`,
    [orderId, game.id, product.id, game.name, game.slug, product.name, JSON.stringify(cleanFields),
      email, whatsapp ? normalizePhone(whatsapp) : '', price, adminFee, total, method.code, method.name]);

  addEvent(orderId, 'pending_payment', 'Pesanan dibuat. Menunggu pembayaran.');

  const charge = paymentProvider.createCharge({ order_id: orderId }, method);
  return { ok: true, orderId, charge };
}

export function getOrder(orderId) {
  const row = get('SELECT * FROM orders WHERE order_id=?', [orderId]);
  if (!row) return null;
  return { ...row, account_fields: parseJson(row.account_fields, {}) };
}

export function getOrderEvents(orderId) {
  return all('SELECT * FROM order_events WHERE order_id=? ORDER BY id ASC', [orderId]);
}

export function addEvent(orderId, status, message = '') {
  run('INSERT INTO order_events (order_id,status,message) VALUES (?,?,?)', [orderId, status, message]);
}

export function setStatus(orderId, status, message = '', extra = {}) {
  const order = getOrder(orderId);
  if (!order) return null;
  const patch = { status, updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19), ...extra };
  const cols = Object.keys(patch);
  run(`UPDATE orders SET ${cols.map((c) => `${c}=?`).join(', ')} WHERE order_id=?`,
    [...cols.map((c) => patch[c]), orderId]);
  addEvent(orderId, status, message);
  return getOrder(orderId);
}

// Payment confirmed -> mark paid, then hand to the supplier.
export function markPaid(orderId, note = 'Pembayaran terkonfirmasi.') {
  const order = getOrder(orderId);
  if (!order) return { ok: false, error: 'Pesanan tidak ditemukan.' };
  if (order.payment_status === 'paid') return { ok: true, already: true, order };

  setStatus(orderId, 'paid', note, { payment_status: 'paid' });

  // Hand off to supplier / fulfilment queue.
  const result = supplierProvider.fulfill(order);
  setStatus(orderId, 'processing', result.message, { topup_status: 'processing' });
  return { ok: true, order: getOrder(orderId) };
}

export function setTopupStatus(orderId, topupStatus, message = '') {
  const map = {
    success: 'success',
    failed: 'failed',
    refund: 'refund',
    processing: 'processing',
    pending: 'paid',
  };
  const status = map[topupStatus] || 'processing';
  return setStatus(orderId, status, message, { topup_status: topupStatus });
}

export function cancelOrder(orderId, message = 'Pesanan dibatalkan.') {
  const order = getOrder(orderId);
  if (!order) return { ok: false, error: 'Pesanan tidak ditemukan.' };
  if (['success', 'processing'].includes(order.status)) {
    return { ok: false, error: 'Pesanan sudah diproses dan tidak dapat dibatalkan.' };
  }
  setStatus(orderId, 'cancelled', message, { payment_status: 'cancelled' });
  return { ok: true, order: getOrder(orderId) };
}

// Update the optional contact details on a pending order.
export function updateContact(orderId, { email = '', whatsapp = '' }) {
  run(`UPDATE orders SET email=?, whatsapp=?, updated_at=? WHERE order_id=?`,
    [email, whatsapp, new Date().toISOString().replace('T', ' ').slice(0, 19), orderId]);
  return getOrder(orderId);
}

// Look up an order by id + a matching contact (email or whatsapp).
export function checkOrder(orderId, contact) {
  const order = getOrder(String(orderId || '').trim().toUpperCase());
  if (!order) return { ok: false, error: 'Pesanan tidak ditemukan. Periksa kembali Order ID kamu.' };

  const c = String(contact || '').trim();
  if (!c) return { ok: true, order }; // id-only lookup allowed

  const emailMatch = order.email && order.email.toLowerCase() === c.toLowerCase();
  const phoneMatch = order.whatsapp && normalizePhone(order.whatsapp) === normalizePhone(c);
  if (!emailMatch && !phoneMatch) {
    return { ok: false, error: 'Kontak tidak cocok dengan pesanan ini.' };
  }
  return { ok: true, order };
}

export function listOrders({ limit = 50 } = {}) {
  return all(`SELECT * FROM orders ORDER BY id DESC LIMIT ?`, [limit]);
}

export function stats() {
  const g = (sql, p = []) => get(sql, p).n;
  return {
    total: g('SELECT COUNT(*) n FROM orders'),
    success: g(`SELECT COUNT(*) n FROM orders WHERE status='success'`),
    pending: g(`SELECT COUNT(*) n FROM orders WHERE status='pending_payment'`),
    revenue: get(`SELECT COALESCE(SUM(total),0) n FROM orders WHERE status='success'`).n,
  };
}
