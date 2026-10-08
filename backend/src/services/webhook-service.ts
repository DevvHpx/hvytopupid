// ============================================================
// Payment webhook service.
//
// A top-up is NEVER triggered by the browser redirect back from the
// payment page. It is triggered ONLY by a verified webhook:
//
//   1. verify signature (provider-specific, constant-time)
//   2. verify merchant / order reference (our HVY-... id must exist)
//   3. verify amount == server-side order total
//   4. idempotency: UNIQUE(provider, externalId) — a duplicate webhook
//      is stored but never processed twice
//   5. persist the raw (sanitised) payload + timestamp + transaction id
//   6. enqueue fulfillment (async, exactly-once)
// ============================================================
import { PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { logger } from '../config/logger';
import { sanitize, sanitizeHeaders } from '../lib/sanitize';
import { sha256Hex } from '../lib/crypto';
import { markOrderPaid, setOrderStatus } from './order-engine';
import type { PaymentProvider, WebhookVerification } from '../payments';

export interface WebhookOutcome {
  httpStatus: number;
  body: Record<string, unknown>;
}

export async function handlePaymentWebhook(
  provider: PaymentProvider,
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
): Promise<WebhookOutcome> {
  const v: WebhookVerification = await provider.verifyWebhook(rawBody, headers);

  // Fallback id so even unverified payloads are de-duplicated.
  const externalId = v.externalId ?? `hash:${sha256Hex(rawBody).slice(0, 40)}`;

  // ---------- 1. persist raw event (idempotent) ----------
  let eventId: string;
  try {
    const ev = await prisma.webhookEvent.create({
      data: {
        provider: provider.name,
        externalId,
        orderId: null,
        signatureValid: v.signatureValid,
        amount: v.amount,
        payloadRaw: (sanitize(v.raw) ?? {}) as Prisma.InputJsonValue,
        headersRaw: sanitizeHeaders(headers) as Prisma.InputJsonValue,
        processed: false,
        processNote: v.ok ? null : v.reason ?? 'unverified',
      },
    });
    eventId = ev.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      logger.warn({ provider: provider.name, externalId }, 'duplicate webhook ignored (idempotent)');
      return { httpStatus: 200, body: { ok: true, duplicate: true } };
    }
    throw err;
  }

  logger.info(
    {
      provider: provider.name,
      externalId,
      orderId: v.orderId,
      signatureValid: v.signatureValid,
      status: v.status,
      amount: v.amount,
      receivedAt: new Date().toISOString(),
    },
    'payment webhook received',
  );

  // ---------- 2. signature / payload gate ----------
  if (!v.ok) {
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { processed: false, processNote: v.reason ?? 'verification_failed', processedAt: new Date() },
    });
    logger.warn({ provider: provider.name, reason: v.reason }, 'webhook rejected');
    return { httpStatus: 401, body: { ok: false, error: v.reason ?? 'Verifikasi webhook gagal.' } };
  }

  // ---------- 3. merchant / order reference gate ----------
  if (!v.orderId) {
    await finish(eventId, false, 'order_reference_missing');
    return { httpStatus: 400, body: { ok: false, error: 'order_id tidak ditemukan.' } };
  }
  const order = await prisma.order.findUnique({ where: { orderId: v.orderId.toUpperCase() } });
  if (!order) {
    await finish(eventId, false, 'order_not_found');
    logger.warn({ orderId: v.orderId }, 'webhook for unknown order');
    return { httpStatus: 404, body: { ok: false, error: 'Pesanan tidak ditemukan.' } };
  }
  await prisma.webhookEvent.update({ where: { id: eventId }, data: { orderId: order.id } });

  // ---------- 4. amount gate ----------
  if (v.status === 'PAID' && v.amount != null && v.amount !== order.total) {
    await finish(eventId, false, 'amount_mismatch');
    await setOrderStatus(order.orderId, 'MANUAL_REVIEW', 'Nominal pembayaran tidak sesuai.', {
      paymentStatus: PaymentStatus.PENDING,
    }, { expected: order.total, received: v.amount });
    logger.error({ orderId: order.orderId, expected: order.total, received: v.amount }, 'webhook amount mismatch');
    return { httpStatus: 409, body: { ok: false, error: 'Nominal pembayaran tidak sesuai.' } };
  }

  // ---------- 5. apply ----------
  try {
    if (v.status === 'PAID') {
      await markOrderPaid(order.orderId, {
        paymentRef: v.externalId,
        paidAmount: v.amount,
        paidAt: v.paidAt,
      });
    } else if (v.status === 'EXPIRED' || v.status === 'FAILED') {
      if (order.status === 'PENDING_PAYMENT') {
        await setOrderStatus(order.orderId, 'CANCELLED', 'Pembayaran kedaluwarsa / gagal.', {
          paymentStatus: v.status === 'EXPIRED' ? PaymentStatus.EXPIRED : PaymentStatus.FAILED,
        });
      }
    } else if (v.status === 'REFUNDED') {
      await setOrderStatus(order.orderId, 'REFUNDED', 'Pembayaran dikembalikan (refund).', {
        paymentStatus: PaymentStatus.REFUNDED,
      });
    } else {
      await finish(eventId, true, `ignored_status_${v.status}`);
      return { httpStatus: 200, body: { ok: true, ignored: true, status: v.status } };
    }

    await finish(eventId, true, 'processed');
    return { httpStatus: 200, body: { ok: true } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    await finish(eventId, false, `error:${message}`);
    logger.error({ orderId: order.orderId, err: message }, 'webhook processing failed');
    // Return 500 so the gateway retries; idempotency keeps it safe.
    return { httpStatus: 500, body: { ok: false, error: 'Gagal memproses webhook.' } };
  }
}

async function finish(eventId: string, processed: boolean, note: string) {
  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: { processed, processNote: note, processedAt: new Date() },
  });
}
