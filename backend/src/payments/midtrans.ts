// ============================================================
// MidtransProvider (Snap / Core API style)
//
// Webhook signature (Midtrans spec):
//   signature_key = sha512(order_id + status_code + gross_amount + server_key)
// The notification body also carries order_id, transaction_id,
// gross_amount, transaction_status, fraud_status and settlement_time.
//
// Verification performed here:
//   1. signature_key matches (constant-time compare)
//   2. transaction_id present (idempotency key)
//   3. order_id present (merchant reference)
//   4. amount parsed (amount check is done by the caller against the
//      server-side order total)
// ============================================================
import { createHash } from 'node:crypto';
import { env } from '../config/env';
import { safeEqual } from '../lib/crypto';
import { sanitize } from '../lib/sanitize';
import { httpRequest } from '../lib/http';
import type {
  ChargeRequest,
  ChargeResult,
  GatewayEventStatus,
  PaymentProvider,
  WebhookVerification,
} from './types';

function mapStatus(transactionStatus: string | undefined, fraudStatus: string | undefined): GatewayEventStatus {
  const t = (transactionStatus ?? '').toLowerCase();
  const f = (fraudStatus ?? '').toLowerCase();
  if (t === 'capture') return f === 'accept' ? 'PAID' : 'PENDING';
  if (t === 'settlement') return 'PAID';
  if (t === 'pending') return 'PENDING';
  if (t === 'expire') return 'EXPIRED';
  if (t === 'cancel' || t === 'deny') return 'FAILED';
  if (t === 'refund' || t === 'partial_refund') return 'REFUNDED';
  return 'UNKNOWN';
}

export class MidtransProvider implements PaymentProvider {
  readonly name = 'midtrans';

  isConfigured(): boolean {
    return Boolean(env.PAYMENT_GATEWAY_KEY && env.PAYMENT_GATEWAY_SECRET);
  }

  private signature(orderId: string, statusCode: string, grossAmount: string): string {
    return createHash('sha512')
      .update(`${orderId}${statusCode}${grossAmount}${env.PAYMENT_GATEWAY_SECRET}`)
      .digest('hex');
  }

  async createCharge(req: ChargeRequest): Promise<ChargeResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        configured: false,
        reason: 'Belum dikonfigurasi: PAYMENT_GATEWAY_KEY / PAYMENT_GATEWAY_SECRET kosong.',
      };
    }

    const res = await httpRequest<{ token?: string; redirect_url?: string }>(
      `${env.PAYMENT_GATEWAY_KEY.startsWith('SB-') ? 'https://app.sandbox.midtrans.com' : 'https://app.midtrans.com'}/snap/v1/transactions`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${env.PAYMENT_GATEWAY_KEY}:`).toString('base64')}`,
        },
        body: {
          transaction_details: { order_id: req.orderId, gross_amount: req.amount },
          item_details: req.items,
          customer_details: { email: req.customerEmail ?? undefined, phone: req.customerPhone ?? undefined },
        },
        timeoutMs: 15000,
      },
    );

    if (!res.ok || !res.data) {
      return {
        ok: false,
        configured: true,
        reason: res.error ?? `Payment gateway HTTP ${res.status}`,
        raw: sanitize(res.data ?? res.text),
      };
    }
    return {
      ok: true,
      configured: true,
      redirectUrl: res.data.redirect_url ?? null,
      gatewayRef: res.data.token ?? null,
      instructions: ['Selesaikan pembayaran pada halaman payment gateway.'],
      raw: sanitize(res.data),
    };
  }

  async verifyWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<WebhookVerification> {
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        reason: 'Body webhook bukan JSON yang valid.',
        signatureValid: false,
        provider: this.name,
        externalId: null,
        orderId: null,
        amount: null,
        status: 'UNKNOWN',
        paidAt: null,
        raw: null,
      };
    }

    const orderId = typeof body.order_id === 'string' ? body.order_id : null;
    const statusCode = String(body.status_code ?? '');
    const grossAmount = String(body.gross_amount ?? '');
    const providedSig = String(body.signature_key ?? '');

    const signatureValid =
      Boolean(env.PAYMENT_GATEWAY_SECRET && orderId && providedSig) &&
      safeEqual(this.signature(orderId as string, statusCode, grossAmount), providedSig);

    const externalId = typeof body.transaction_id === 'string' ? body.transaction_id : null;
    const amount = Number.isFinite(Number(grossAmount)) ? Math.trunc(Number(grossAmount)) : null;
    const status = mapStatus(
      typeof body.transaction_status === 'string' ? body.transaction_status : undefined,
      typeof body.fraud_status === 'string' ? body.fraud_status : undefined,
    );
    const paidAtRaw = body.settlement_time ?? body.transaction_time;
    const paidAt = typeof paidAtRaw === 'string' ? new Date(paidAtRaw) : null;

    const ok = signatureValid && Boolean(orderId) && Boolean(externalId);
    return {
      ok,
      reason: ok
        ? undefined
        : !signatureValid
          ? 'Signature webhook tidak valid.'
          : 'order_id / transaction_id tidak ditemukan pada payload.',
      signatureValid,
      provider: this.name,
      externalId,
      orderId,
      amount,
      status,
      paidAt: paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt : null,
      raw: sanitize(body),
    };
  }
}
