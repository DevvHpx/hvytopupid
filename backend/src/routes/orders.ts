// ============================================================
// Public order API.
// ============================================================
import { Router } from 'express';
import type { Order } from '@prisma/client';
import { asyncHandler } from '../lib/async-handler';
import { badRequest, notFound } from '../lib/errors';
import { validate, createOrderSchema, payOrderSchema, checkOrderSchema, orderIdParamSchema } from '../lib/validation';
import { createOrder, findOrderByPublicId, getOrderByPublicId } from '../services/order-service';
import { createChargeForOrder } from '../services/payment-service';
import { markOrderPaid } from '../services/order-engine';
import { apiLimiter, orderLimiter } from '../middleware/rate-limit';
import { prisma } from '../db/prisma';
import { sandboxEnabled } from '../config/env';

export const orders = Router();

orders.use(apiLimiter);

/** Strip anything the customer must not see. */
function publicOrder(order: Order & { events?: { type: string; message: string; createdAt: Date }[] }) {
  return {
    orderId: order.orderId,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentCode: order.paymentCode,
    gameId: order.gameId,
    productName: order.productName,
    price: order.price,
    adminFee: order.adminFee,
    total: order.total,
    currency: order.currency,
    accountFields: order.accountFields,
    topupStatus: order.topupStatus,
    note: order.note,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    paidAt: order.paidAt,
    events: order.events?.map((e) => ({ type: e.type, message: e.message, at: e.createdAt })),
  };
}

orders.post(
  '/',
  orderLimiter,
  validate(createOrderSchema, 'body'),
  asyncHandler(async (req, res) => {
    const { order, idempotent } = await createOrder(req.body);
    res.status(201).json({
      ok: true,
      idempotent,
      orderId: order.orderId,
      order: publicOrder(order),
    });
  }),
);

orders.post(
  '/check',
  validate(checkOrderSchema, 'body'),
  asyncHandler(async (req, res) => {
    const { orderId, contact } = req.body as { orderId: string; contact: string };
    const order = await getOrderByPublicId(orderId);
    if (contact) {
      const c = contact.trim().toLowerCase();
      const emailMatch = order.contactEmail?.toLowerCase() === c;
      const phoneMatch = order.contactPhone?.replace(/\D/g, '').endsWith(c.replace(/\D/g, ''));
      if (!emailMatch && !phoneMatch) throw notFound('Kontak tidak cocok dengan pesanan ini.');
    }
    res.json({ ok: true, order: publicOrder(order) });
  }),
);

orders.get(
  '/:orderId',
  validate(orderIdParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const order = await getOrderByPublicId(req.params.orderId!);
    res.json({ ok: true, order: publicOrder(order) });
  }),
);

orders.post(
  '/:orderId/pay',
  orderLimiter,
  validate(orderIdParamSchema, 'params'),
  validate(payOrderSchema, 'body'),
  asyncHandler(async (req, res) => {
    const order = await findOrderByPublicId(req.params.orderId!);
    if (!order) throw notFound('Pesanan tidak ditemukan.');
    const result = await createChargeForOrder(order.orderId, req.body);
    res.json(result);
  }),
);

/**
 * Sandbox payment confirmation — a clearly-labelled TEST endpoint that
 * simulates a successful gateway webhook. It is disabled outside
 * development/test (never available in production) and routes through
 * the exact same `markOrderPaid` path as a real webhook, so the order
 * still flows PAID -> QUEUED -> PROCESSING -> supplier.
 */
orders.post(
  '/:orderId/sandbox/confirm',
  validate(orderIdParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    if (!sandboxEnabled) throw badRequest('Mode sandbox tidak aktif pada lingkungan ini.');
    const order = await findOrderByPublicId(req.params.orderId!);
    if (!order) throw notFound('Pesanan tidak ditemukan.');
    const { alreadyPaid } = await markOrderPaid(order.orderId, {
      paymentRef: 'sandbox',
      paidAmount: order.total,
      paidAt: new Date(),
    });
    res.json({ ok: true, sandbox: true, alreadyPaid, orderId: order.orderId });
  }),
);

orders.post(
  '/:orderId/cancel',
  validate(orderIdParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const order = await findOrderByPublicId(req.params.orderId!);
    if (!order) throw notFound('Pesanan tidak ditemukan.');
    if (!['PENDING_PAYMENT', 'PAID'].includes(order.status)) {
      throw badRequest('Pesanan sudah diproses dan tidak dapat dibatalkan.');
    }
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'CANCELLED', paymentStatus: 'FAILED' },
    });
    await prisma.orderEvent.create({
      data: { orderId: order.id, type: 'STATUS_CANCELLED', message: 'Dibatalkan oleh pengguna.' },
    });
    res.json({ ok: true, order: publicOrder(updated) });
  }),
);
