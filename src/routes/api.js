// ============================================================
// JSON API — used by the client for search, validation,
// order polling, payment and admin actions.
// ============================================================
import { Router } from 'express';
import * as catalog from '../services/catalog.js';
import * as orders from '../services/orders.js';
import { payment as paymentProvider, validation as validationProvider } from '../providers/index.js';
import { isValidEmail, isValidPhone, normalizePhone } from '../utils/helpers.js';

export const api = Router();

// ---------- Live search ----------
api.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ games: [] });
  const games = catalog.getGames({ q, limit: 8 }).map((g) => ({
    slug: g.slug, name: g.name, publisher: g.publisher, logo: g.logo,
  }));
  res.json({ games });
});

// ---------- ID validation ----------
api.post('/validate-id', (req, res) => {
  const { slug, fields } = req.body || {};
  const game = catalog.getGameBySlug(String(slug || ''));
  if (!game) return res.status(404).json({ status: 'error', message: 'Game tidak ditemukan.' });
  const result = validationProvider.validate(game, fields || {});
  res.json(result);
});

// ---------- Create order (JSON) ----------
api.post('/orders', (req, res) => {
  const b = req.body || {};
  const result = orders.createOrder({
    gameSlug: b.slug, productId: b.productId, fields: b.fields || {},
    email: b.email || '', whatsapp: b.whatsapp || '', paymentCode: b.paymentCode,
  });
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

// ---------- Get order + events (polling) ----------
api.get('/orders/:orderId', (req, res) => {
  const order = orders.getOrder(req.params.orderId);
  if (!order) return res.status(404).json({ ok: false, error: 'Pesanan tidak ditemukan.' });
  const events = orders.getOrderEvents(order.order_id).map((e) => ({
    status: e.status, message: e.message, created_at: e.created_at,
  }));
  res.json({ ok: true, order, events });
});

// ---------- Pay (update contact + create charge) ----------
api.post('/orders/:orderId/pay', (req, res) => {
  const order = orders.getOrder(req.params.orderId);
  if (!order) return res.status(404).json({ ok: false, error: 'Pesanan tidak ditemukan.' });
  if (order.status !== 'pending_payment') return res.json({ ok: true, already: true });

  const { email = '', whatsapp = '' } = req.body || {};
  const e = String(email).trim();
  const w = String(whatsapp).trim();
  if (e && !isValidEmail(e)) return res.status(400).json({ ok: false, error: 'Format email tidak valid.' });
  if (w && !isValidPhone(w)) return res.status(400).json({ ok: false, error: 'Format nomor WhatsApp tidak valid.' });

  orders.updateContact(order.order_id, { email: e, whatsapp: w ? normalizePhone(w) : '' });

  const method = catalog.getPaymentMethod(order.payment_code);
  const charge = paymentProvider.createCharge(order, method);
  if (!charge.ok) return res.status(400).json({ ok: false, error: charge.reason });

  res.json({ ok: true, charge });
});

// ---------- Sandbox: simulate a successful payment ----------
api.post('/orders/:orderId/sandbox/confirm', (req, res) => {
  const order = orders.getOrder(req.params.orderId);
  if (!order) return res.status(404).json({ ok: false, error: 'Pesanan tidak ditemukan.' });
  const method = catalog.getPaymentMethod(order.payment_code);
  const st = paymentProvider.status(method ? method.code : '');
  if (!st.sandbox) return res.status(403).json({ ok: false, error: 'Aksi ini hanya untuk metode Sandbox.' });
  const result = orders.markPaid(order.order_id, 'Pembayaran sandbox terkonfirmasi.');

  // Sandbox-only: simulate the supplier fulfilment callback completing.
  // A real deployment advances this via the supplier API / admin action.
  setTimeout(() => {
    const o = orders.getOrder(order.order_id);
    if (o && o.topup_status === 'processing') {
      orders.setTopupStatus(order.order_id, 'success', 'Top up berhasil dikirim ke akun (sandbox).');
    }
  }, 4000);

  res.json({ ok: true, order: result.order });
});

// ---------- Cancel ----------
api.post('/orders/:orderId/cancel', (req, res) => {
  const result = orders.cancelOrder(req.params.orderId, 'Dibatalkan oleh pengguna.');
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

// ---------- Payment webhook (for a real gateway later) ----------
// Verifies a shared secret header, then advances the order.
api.post('/webhooks/payment', (req, res) => {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET || '';
  if (!secret) return res.status(503).json({ ok: false, error: 'Webhook belum dikonfigurasi (PAYMENT_WEBHOOK_SECRET kosong).' });
  if (req.get('x-webhook-secret') !== secret) return res.status(401).json({ ok: false, error: 'Signature tidak valid.' });
  const { orderId, status } = req.body || {};
  if (!orderId) return res.status(400).json({ ok: false, error: 'orderId wajib.' });
  if (status === 'paid') orders.markPaid(orderId, 'Pembayaran terkonfirmasi via webhook.');
  else if (status === 'expired') orders.setStatus(orderId, 'cancelled', 'Pembayaran kedaluwarsa.', { payment_status: 'expired' });
  res.json({ ok: true });
});

// ---------- Admin (token protected) ----------
function requireAdmin(req, res, next) {
  const token = process.env.ADMIN_TOKEN || '';
  const provided = req.get('x-admin-token') || req.query.token || '';
  if (!token) return res.status(503).json({ ok: false, error: 'Admin belum dikonfigurasi (ADMIN_TOKEN kosong).' });
  if (provided !== token) return res.status(401).json({ ok: false, error: 'Token admin tidak valid.' });
  next();
}

api.get('/admin/orders', requireAdmin, (req, res) => {
  res.json({ ok: true, orders: orders.listOrders({ limit: Number(req.query.limit) || 50 }), stats: orders.stats() });
});

api.post('/admin/orders/:orderId/status', requireAdmin, (req, res) => {
  const { status, message } = req.body || {};
  const allowed = ['paid', 'processing', 'success', 'failed', 'refund', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ ok: false, error: 'Status tidak valid.' });
  let result;
  if (status === 'paid') result = orders.markPaid(req.params.orderId, message || 'Ditandai lunas oleh admin.');
  else if (status === 'cancelled') result = orders.cancelOrder(req.params.orderId, message || 'Dibatalkan oleh admin.');
  else result = { ok: true, order: orders.setTopupStatus(req.params.orderId, status, message || '') };
  if (!result || result.ok === false) return res.status(400).json(result || { ok: false });
  res.json({ ok: true, order: result.order });
});
