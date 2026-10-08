// ============================================================
// Server-rendered page routes.
// ============================================================
import { Router } from 'express';
import { renderPage } from '../views/layout.js';
import { homePage } from '../views/pages/home.js';
import { catalogPage } from '../views/pages/catalog.js';
import { gamePage } from '../views/pages/game.js';
import { checkoutPage } from '../views/pages/checkout.js';
import { orderPage } from '../views/pages/order.js';
import { checkPage } from '../views/pages/check.js';
import { promoPage } from '../views/pages/promo.js';
import { helpPage } from '../views/pages/help.js';
import { notFoundPage } from '../views/pages/notfound.js';
import * as catalog from '../services/catalog.js';
import * as orders from '../services/orders.js';
import { payment as paymentProvider } from '../providers/index.js';

export const pages = Router();

function send(res, view, status = 200) {
  const settings = catalog.getSettings();
  res.status(status).type('html').send(renderPage({ ...view, settings }));
}

// ---------- Home ----------
pages.get('/', (req, res) => {
  send(res, homePage({
    categories: catalog.getCategories(),
    popularGames: catalog.getGames({ popular: true }),
    allGames: catalog.getGames(),
    promos: catalog.getPromos(),
    faqs: catalog.getFaqs(),
  }));
});

// ---------- Catalog ----------
pages.get('/game', (req, res) => {
  const q = String(req.query.q || '').trim();
  const category = String(req.query.category || '').trim();
  send(res, catalogPage({
    games: catalog.getGames({ q, category }),
    categories: catalog.getCategories(),
    q, category,
  }));
});

// ---------- Game detail ----------
pages.get('/game/:slug', (req, res) => {
  const game = catalog.getGameBySlug(req.params.slug);
  if (!game || game.status !== 'active') return send(res, notFoundPage(), 404);
  send(res, gamePage({
    game,
    products: catalog.getProducts(game.id),
    payments: catalog.getPaymentMethods(),
    settings: catalog.getSettings(),
  }));
});

// ---------- Create order (from game page) ----------
pages.post('/checkout', (req, res) => {
  const b = req.body || {};
  const fields = {};
  for (const [k, v] of Object.entries(b)) {
    if (k.startsWith('f_')) fields[k.slice(2)] = v;
  }
  const result = orders.createOrder({
    gameSlug: b.slug,
    productId: b.productId,
    fields,
    paymentCode: b.paymentCode,
  });
  if (!result.ok) {
    // Bounce back to the game page with a message.
    const slug = b.slug || '';
    return res.redirect(303, `/game/${encodeURIComponent(slug)}?error=${encodeURIComponent(result.error)}`);
  }
  res.redirect(303, `/checkout/${encodeURIComponent(result.orderId)}`);
});

// ---------- Checkout page ----------
pages.get('/checkout/:orderId', (req, res) => {
  const order = orders.getOrder(req.params.orderId);
  if (!order) return send(res, notFoundPage(), 404);
  if (order.status !== 'pending_payment') {
    return res.redirect(303, `/order/${encodeURIComponent(order.order_id)}`);
  }
  const game = catalog.getGameBySlug(order.game_slug);
  const method = catalog.getPaymentMethod(order.payment_code);
  send(res, checkoutPage({
    order, game, method,
    methodStatus: paymentProvider.status(order.payment_code),
  }));
});

// ---------- Order / payment status ----------
pages.get('/order/:orderId', (req, res) => {
  const order = orders.getOrder(req.params.orderId);
  if (!order) return send(res, notFoundPage(), 404);
  send(res, orderPage({
    order,
    events: orders.getOrderEvents(order.order_id),
    game: catalog.getGameBySlug(order.game_slug),
    methodStatus: paymentProvider.status(order.payment_code),
  }));
});

// Sandbox "pay" entry point -> the order page hosts the simulate action.
pages.get('/order/:orderId/sandbox-pay', (req, res) => {
  res.redirect(303, `/order/${encodeURIComponent(req.params.orderId)}`);
});

// ---------- Check order ----------
pages.get('/cek-pesanan', (req, res) => {
  const orderId = String(req.query.order || '').trim();
  const contact = String(req.query.contact || '').trim();
  let result = null;
  if (orderId) result = orders.checkOrder(orderId, contact);
  send(res, checkPage({ orderId, contact, result }));
});

// ---------- Promo ----------
pages.get('/promo', (req, res) => {
  send(res, promoPage({ promos: catalog.getPromos() }));
});

// ---------- Help ----------
pages.get('/bantuan', (req, res) => {
  send(res, helpPage({ faqs: catalog.getFaqs(), settings: catalog.getSettings() }));
});

// ---------- 404 ----------
pages.use((req, res) => send(res, notFoundPage(), 404));
