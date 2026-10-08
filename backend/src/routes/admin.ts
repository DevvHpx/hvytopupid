// ============================================================
// Admin API — authentication, order management, refunds, monitoring.
// Every mutating action is written to the AuditLog.
// ============================================================
import { Router } from 'express';
import { OrderStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import { asyncHandler } from '../lib/async-handler';
import { badRequest, notFound, unauthorized } from '../lib/errors';
import { validate, adminLoginSchema, adminOrderStatusSchema, adminRefundSchema, orderIdParamSchema } from '../lib/validation';
import {
  clearAuthCookies,
  csrfProtection,
  requireAdmin,
  requireRole,
  setAuthCookies,
  signAdminToken,
  verifyCredentials,
} from '../middleware/auth';
import { authLimiter, apiLimiter } from '../middleware/rate-limit';
import { listOrders, orderStats } from '../services/order-service';
import { processOrder, setOrderStatus } from '../services/order-engine';
import { enqueueProcess, queueHealth } from '../queue/order-queue';
import { supplierStatus } from '../suppliers';

export const admin = Router();

admin.use(apiLimiter);

async function audit(actor: string | undefined, action: string, target: string | undefined, ip: string | undefined, meta?: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: { actor: actor ?? null, action, target: target ?? null, ip: ip ?? null, meta: (meta ?? {}) as object },
  });
}

// ---------- auth ----------
admin.post(
  '/auth/login',
  authLimiter,
  validate(adminLoginSchema, 'body'),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };
    const user = await verifyCredentials(email, password);
    if (!user) throw unauthorized('Email atau password salah.');
    const token = signAdminToken({ sub: user.id, email: user.email, name: user.name, role: user.role as 'admin' | 'operator' | 'viewer' });
    const { csrf } = setAuthCookies(res, token);
    await audit(user.email, 'admin.login', user.id, req.ip);
    res.json({ ok: true, csrfToken: csrf, admin: { email: user.email, name: user.name, role: user.role } });
  }),
);

admin.post(
  '/auth/logout',
  requireAdmin,
  csrfProtection,
  asyncHandler(async (req, res) => {
    clearAuthCookies(res);
    await audit(req.admin?.email, 'admin.logout', req.admin?.sub, req.ip);
    res.json({ ok: true });
  }),
);

admin.get('/me', requireAdmin, (req, res) => {
  res.json({ ok: true, admin: req.admin });
});

// ---------- orders ----------
admin.get(
  '/orders',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const status = String(req.query.status ?? '').trim();
    const limit = Number(req.query.limit) || 50;
    const rows = await listOrders({
      status: (status ? (status as OrderStatus) : undefined),
      limit,
      cursor: req.query.cursor ? String(req.query.cursor) : undefined,
    });
    res.json({ ok: true, orders: rows, stats: await orderStats() });
  }),
);

admin.get(
  '/orders/:orderId',
  requireAdmin,
  validate(orderIdParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { orderId: req.params.orderId!.toUpperCase() },
      include: {
        events: { orderBy: { createdAt: 'asc' } },
        supplierTxns: { orderBy: { createdAt: 'asc' } },
        webhooks: { orderBy: { receivedAt: 'asc' } },
      },
    });
    if (!order) throw notFound('Pesanan tidak ditemukan.');
    res.json({ ok: true, order });
  }),
);

admin.post(
  '/orders/:orderId/status',
  requireAdmin,
  requireRole('admin', 'operator'),
  csrfProtection,
  validate(orderIdParamSchema, 'params'),
  validate(adminOrderStatusSchema, 'body'),
  asyncHandler(async (req, res) => {
    const { status, message } = req.body as { status: OrderStatus; message: string };
    const order = await prisma.order.findUnique({ where: { orderId: req.params.orderId!.toUpperCase() } });
    if (!order) throw notFound('Pesanan tidak ditemukan.');
    const updated = await setOrderStatus(order.orderId, status, message || `Diubah manual oleh ${req.admin?.email}.`);
    await audit(req.admin?.email, 'order.status', order.orderId, req.ip, { to: status });
    res.json({ ok: true, order: updated });
  }),
);

admin.post(
  '/orders/:orderId/requeue',
  requireAdmin,
  requireRole('admin', 'operator'),
  csrfProtection,
  validate(orderIdParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { orderId: req.params.orderId!.toUpperCase() } });
    if (!order) throw notFound('Pesanan tidak ditemukan.');
    if (order.paymentStatus !== 'PAID') throw badRequest('Pesanan belum dibayar — tidak bisa di-requeue.');
    if (order.status === OrderStatus.SUCCESS) throw badRequest('Pesanan sudah sukses.');
    // Reset retry counter so the engine will retry, then process now.
    await prisma.order.update({ where: { id: order.id }, data: { attempts: 0, nextRetryAt: null } });
    await setOrderStatus(order.orderId, OrderStatus.QUEUED, `Requeue manual oleh ${req.admin?.email}.`);
    await enqueueProcess(order.orderId, 'admin_requeue');
    await audit(req.admin?.email, 'order.requeue', order.orderId, req.ip);
    const outcome = await processOrder(order.orderId);
    res.json({ ok: true, outcome });
  }),
);

admin.post(
  '/orders/:orderId/refund',
  requireAdmin,
  requireRole('admin'),
  csrfProtection,
  validate(orderIdParamSchema, 'params'),
  validate(adminRefundSchema, 'body'),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { orderId: req.params.orderId!.toUpperCase() } });
    if (!order) throw notFound('Pesanan tidak ditemukan.');
    if (order.paymentStatus !== 'PAID') throw badRequest('Pesanan belum dibayar \u2014 tidak bisa direfund.');
    if (order.status === OrderStatus.REFUNDED) throw badRequest('Pesanan sudah direfund.');
    const updated = await setOrderStatus(order.orderId, OrderStatus.REFUND_PENDING, `Refund diminta: ${(req.body as { reason: string }).reason}`);
    await audit(req.admin?.email, 'order.refund_request', order.orderId, req.ip, { reason: (req.body as { reason: string }).reason });
    res.json({ ok: true, order: updated });
  }),
);

// ---------- monitoring ----------
admin.get(
  '/stats',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, stats: await orderStats() });
  }),
);

admin.get(
  '/suppliers',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, suppliers: supplierStatus() });
  }),
);

admin.get(
  '/queue',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, queue: await queueHealth() });
  }),
);
