// ============================================================
// Order engine — the automatic fulfillment core.
//
// Flow:
//   PENDING_PAYMENT → (webhook verified) → PAID → QUEUED
//     → PROCESSING → supplier API → SUCCESS | PENDING_SUPPLIER | FAILED
//     → (timeout/unknown) → inquiry before retry → ... → MANUAL_REVIEW
//
// Guarantees:
//   * A supplier transaction is created at most once per order
//     (deterministic refId + UNIQUE constraint + Redis lock).
//   * A retry NEVER blindly re-creates a transaction: if a request was
//     already sent, we only INQUIRE about its status.
//   * Duplicate webhooks / jobs cannot create a second top-up.
// ============================================================
import { OrderStatus, Prisma, SupplierTxnStatus, type Order } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../db/prisma';
import { acquireLock, orderLockKey } from '../lib/locks';
import { supplierRefFor } from '../lib/idempotency';
import { sanitize } from '../lib/sanitize';
import { conflict, notFound } from '../lib/errors';
import { getSupplier, type SupplierResult, type SupplierStatus } from '../suppliers';
import { appendEvent, assertTransition, composeCustomerNo } from './order-service';
import { enqueueProcess, enqueueReconcile } from '../queue/order-queue';

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function backoffMs(attempt: number): number {
  const raw = env.ORDER_RETRY_BASE_MS * Math.pow(2, Math.max(0, attempt - 1));
  return Math.min(raw, env.ORDER_RETRY_MAX_MS);
}

function mapTxnStatus(s: SupplierStatus): SupplierTxnStatus {
  switch (s) {
    case 'SUCCESS':
      return SupplierTxnStatus.SUCCESS;
    case 'FAILED':
      return SupplierTxnStatus.FAILED;
    case 'PENDING':
      return SupplierTxnStatus.PENDING;
    default:
      return SupplierTxnStatus.UNKNOWN;
  }
}

/** Apply a validated status transition + append an audit event. */
export async function setOrderStatus(
  orderId: string,
  to: OrderStatus,
  message: string,
  extra: Prisma.OrderUpdateInput = {},
  meta?: Prisma.InputJsonValue,
) {
  const order = await prisma.order.findUnique({ where: { orderId } });
  if (!order) throw notFound('Pesanan tidak ditemukan.');
  assertTransition(order.status, to);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { status: to, ...extra },
    });
    await appendEvent(tx, order.id, `STATUS_${to}`, message, meta);
    return updated;
  });
}

// ------------------------------------------------------------
// Payment confirmed (called by the webhook service, idempotent)
// ------------------------------------------------------------
export interface MarkPaidOptions {
  paymentRef?: string | null;
  paidAmount?: number | null;
  paidAt?: Date | null;
}

export async function markOrderPaid(orderId: string, opts: MarkPaidOptions = {}) {
  const order = await prisma.order.findUnique({ where: { orderId: orderId.toUpperCase() } });
  if (!order) throw notFound('Pesanan tidak ditemukan.');

  // Idempotency: a replayed webhook must not re-process.
  if (order.paymentStatus === 'PAID') {
    return { order, alreadyPaid: true as const };
  }

  // Amount verification — never trust the gateway's word alone.
  if (opts.paidAmount != null && opts.paidAmount !== order.total) {
    await prisma.$transaction(async (tx) => {
      await appendEvent(tx, order.id, 'PAYMENT_AMOUNT_MISMATCH', 'Nominal pembayaran tidak sesuai.', {
        expected: order.total,
        received: opts.paidAmount,
      });
      await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.MANUAL_REVIEW } });
    });
    throw conflict('Nominal pembayaran tidak sesuai dengan total pesanan.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID',
        paidAt: opts.paidAt ?? new Date(),
        paymentRef: opts.paymentRef ?? order.paymentRef,
        status: OrderStatus.PAID,
      },
    });
    await appendEvent(tx, order.id, 'PAYMENT_CONFIRMED', 'Pembayaran terkonfirmasi. Pesanan masuk antrean.', {
      paymentRef: opts.paymentRef ?? null,
      amount: opts.paidAmount ?? order.total,
    });
    return u;
  });

  // Hand off to the queue (async, exactly-once).
  await enqueueProcess(order.orderId, 'payment_confirmed');
  return { order: updated, alreadyPaid: false as const };
}

// ------------------------------------------------------------
// Fulfillment
// ------------------------------------------------------------
export interface ProcessOutcome {
  ok: boolean;
  reason: string;
  status?: OrderStatus;
}

/**
 * Process a single order: lock → ensure paid → ensure not succeeded →
 * ensure a supplier transaction exists (create at most once) → call
 * the supplier (or inquire if a request was already sent) → apply.
 */
export async function processOrder(orderId: string): Promise<ProcessOutcome> {
  const lock = await acquireLock(orderLockKey(orderId), env.ORDER_LOCK_TTL_MS);
  if (!lock) return { ok: false, reason: 'locked' };

  try {
    const order = await prisma.order.findUnique({ where: { orderId: orderId.toUpperCase() } });
    if (!order) return { ok: false, reason: 'not_found' };

    // Terminal / not-ready guards.
    if (order.status === OrderStatus.SUCCESS) return { ok: true, reason: 'already_success', status: order.status };
    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REFUNDED)
      return { ok: false, reason: 'terminal', status: order.status };
    if (order.paymentStatus !== 'PAID') return { ok: false, reason: 'not_paid', status: order.status };

    const supplier = getSupplier(order.supplier);
    const refId = supplierRefFor(order.orderId, supplier.name);

    // Ensure a supplier transaction row exists (idempotent create).
    let txn = await prisma.supplierTransaction.findUnique({ where: { refId } });
    if (!txn) {
      try {
        txn = await prisma.supplierTransaction.create({
          data: { orderId: order.id, supplier: supplier.name, refId, status: SupplierTxnStatus.CREATED },
        });
      } catch {
        // Lost a race — another worker created it. Re-read.
        txn = await prisma.supplierTransaction.findUnique({ where: { refId } });
      }
    }
    if (!txn) return { ok: false, reason: 'txn_create_failed' };

    // Already resolved by a previous attempt.
    if (txn.status === SupplierTxnStatus.SUCCESS) {
      await applySupplierResult(order, txn.id, {
        status: 'SUCCESS',
        message: 'Transaksi supplier sudah sukses (idempotent).',
        supplierTrxId: txn.supplierTrxId,
        requestAt: txn.requestAt ?? new Date(),
        responseAt: new Date(),
      });
      return { ok: true, reason: 'txn_already_success', status: OrderStatus.SUCCESS };
    }

    // Move the order into PROCESSING (PAID/QUEUED/MANUAL_REVIEW → PROCESSING).
    if (order.status !== OrderStatus.PROCESSING) {
      if (order.status === OrderStatus.PAID || order.status === OrderStatus.FAILED) {
        await setOrderStatus(order.orderId, OrderStatus.QUEUED, 'Pesanan masuk antrean pemrosesan otomatis.');
      }
      await setOrderStatus(order.orderId, OrderStatus.PROCESSING, 'Memproses top-up ke supplier.', {
        lockedAt: new Date(),
        lockOwner: lock.token,
      });
    }

    const customerNo = composeCustomerNo(order.accountFields, order.accountFields as Record<string, string>);
    const request = {
      orderId: order.orderId,
      refId,
      sku: order.productSku,
      customerNo,
      amount: order.price,
      productName: order.productName,
    };

    // NO BLIND RETRY: only send a NEW transaction when none was sent yet.
    let result: SupplierResult;
    if (!txn.requestAt) {
      await prisma.supplierTransaction.update({
        where: { id: txn.id },
        data: { requestAt: new Date(), status: SupplierTxnStatus.PENDING },
      });
      logger.info({ orderId: order.orderId, supplier: supplier.name, refId }, 'supplier createTransaction');
      result = await supplier.createTransaction(request);
    } else {
      logger.info({ orderId: order.orderId, supplier: supplier.name, refId }, 'supplier checkTransaction (no blind retry)');
      result = await supplier.checkTransaction(refId, request);
    }

    await applySupplierResult(order, txn.id, result);
    const fresh = await prisma.order.findUnique({ where: { id: order.id } });
    return { ok: true, reason: result.status.toLowerCase(), status: fresh?.status };
  } finally {
    await lock.release();
  }
}

/** Persist a supplier result and advance the order accordingly. */
async function applySupplierResult(order: Order, txnId: string, result: SupplierResult) {
  await prisma.supplierTransaction.update({
    where: { id: txnId },
    data: {
      responseAt: result.responseAt,
      httpStatus: result.httpStatus ?? null,
      status: mapTxnStatus(result.status),
      supplierTrxId: result.supplierTrxId ?? null,
      errorCode: result.errorCode ?? null,
      sanitizedResponse: (sanitize(result.raw) ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    },
  });

  const attempts = order.attempts + 1;

  if (result.status === 'SUCCESS') {
    await setOrderStatus(
      order.orderId,
      OrderStatus.SUCCESS,
      'Top-up berhasil diproses oleh supplier.',
      { topupStatus: 'success', attempts, lockedAt: null, lockOwner: null, nextRetryAt: null },
      { supplierTrxId: result.supplierTrxId ?? null },
    );
    return;
  }

  if (result.status === 'FAILED') {
    await setOrderStatus(
      order.orderId,
      OrderStatus.FAILED,
      `Top-up gagal di supplier: ${result.message}`,
      { topupStatus: 'failed', attempts, lockedAt: null, lockOwner: null, nextRetryAt: null },
      { errorCode: result.errorCode ?? null },
    );
    return;
  }

  if (result.status === 'PENDING') {
    const delay = backoffMs(attempts);
    await setOrderStatus(
      order.orderId,
      OrderStatus.PENDING_SUPPLIER,
      'Supplier masih memproses transaksi. Menunggu konfirmasi.',
      {
        topupStatus: 'pending',
        attempts,
        lockedAt: null,
        lockOwner: null,
        nextRetryAt: new Date(Date.now() + delay),
      },
    );
    await enqueueReconcile(order.orderId, delay, attempts);
    return;
  }

  // UNKNOWN (timeout / ambiguous) — retry via inquiry, then escalate.
  if (attempts >= env.ORDER_MAX_RETRIES) {
    await setOrderStatus(
      order.orderId,
      OrderStatus.MANUAL_REVIEW,
      `Status supplier tidak pasti setelah ${attempts} percobaan. Perlu penanganan manual.`,
      { topupStatus: 'unknown', attempts, lockedAt: null, lockOwner: null, nextRetryAt: null },
    );
    return;
  }

  const delay = backoffMs(attempts);
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: OrderStatus.PENDING_SUPPLIER,
      topupStatus: 'unknown',
      attempts,
      lockedAt: null,
      lockOwner: null,
      nextRetryAt: new Date(Date.now() + delay),
    },
  });
  await prisma.$transaction(async (tx) => {
    await appendEvent(tx, order.id, 'RETRY_SCHEDULED', `Percobaan ulang dalam ${Math.round(delay / 1000)}s (inquiry dulu).`, {
      attempt: attempts,
      delay,
    });
  });
  await enqueueReconcile(order.orderId, delay, attempts);
}

/**
 * Reconcile an order that is PENDING_SUPPLIER / awaiting retry.
 * Always goes through processOrder → which only INQUIRES when a request
 * was already sent (never re-creates a transaction).
 */
export async function reconcileOrder(orderId: string): Promise<ProcessOutcome> {
  const order = await prisma.order.findUnique({ where: { orderId: orderId.toUpperCase() } });
  if (!order) return { ok: false, reason: 'not_found' };
  if (order.status === OrderStatus.SUCCESS) return { ok: true, reason: 'already_success' };
  if (order.status !== OrderStatus.PENDING_SUPPLIER && order.status !== OrderStatus.PROCESSING) {
    return { ok: false, reason: `not_reconcilable:${order.status}` };
  }
  return processOrder(order.orderId);
}

// ------------------------------------------------------------
// Sweeper — recover orders that were paid but never queued
// (e.g. the process crashed between DB write and enqueue).
// ------------------------------------------------------------
export async function sweepStuckOrders(limit = 25): Promise<number> {
  const stuck = await prisma.order.findMany({
    where: {
      paymentStatus: 'PAID',
      status: { in: [OrderStatus.PAID, OrderStatus.QUEUED] },
      updatedAt: { lt: new Date(Date.now() - 60_000) },
    },
    take: limit,
    orderBy: { updatedAt: 'asc' },
  });
  for (const o of stuck) await enqueueProcess(o.orderId, 'sweeper');
  return stuck.length;
}
