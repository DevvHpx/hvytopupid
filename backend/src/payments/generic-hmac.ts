// ============================================================
// GenericHmacProvider
//
// For any gateway that signs the raw request body with an
// HMAC-SHA256 shared secret and sends it in a header. The expected
// payload shape is documented below so an operator can point any
// gateway at it via a thin adapter:
//
//   header:  x-signature: sha256=<hex>
//   body:    { event_id, order_id, amount, status, paid_at? }
//   status:  paid | settlement | success | expired | failed | refunded | pending
// ============================================================
import { env } from '../config/env';
import { verifyHmacSignature } from '../lib/crypto';
import { sanitize } from '../lib/sanitize';
import type {
  ChargeRequest,
  ChargeResult,
  GatewayEventStatus,
  PaymentProvider,
  WebhookVerification,
} from './types';

function mapStatus(raw: string | undefined): GatewayEventStatus {
  const s = (raw ?? '').toLowerCase();
  if (['paid', 'settlement', 'success', 'capture', 'berhasil'].includes(s)) return 'PAID';
  if (['pending', 'process', 'processing'].includes(s)) return 'PENDING';
  if (['expired', 'expire', 'kadaluarsa'].includes(s)) return 'EXPIRED';
  if (['failed', 'fail', 'deny', 'cancel', 'gagal'].includes(s)) return 'FAILED';
  if (['refund', 'refunded'].includes(s)) return 'REFUNDED';
  return 'UNKNOWN';
}

export class GenericHmacProvider implements PaymentProvider {
  readonly name = 'generic-hmac';

  isConfigured(): boolean {
    return Boolean(env.PAYMENT_WEBHOOK_SECRET);
  }

  async createCharge(_req: ChargeRequest): Promise<ChargeResult> {
    // A generic HMAC gateway is used for webhook verification only; the
    // charge creation endpoint is operator-specific.
    return {
      ok: false,
      configured: this.isConfigured(),
      reason:
        'Provider "generic-hmac" hanya memverifikasi webhook. Konfigurasikan endpoint charge khusus atau gunakan provider midtrans.',
    };
  }

  async verifyWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<WebhookVerification> {
    const header = headers['x-signature'];
    const provided = Array.isArray(header) ? header[0] : header;

    const signatureValid = verifyHmacSignature({
      secret: env.PAYMENT_WEBHOOK_SECRET,
      rawBody,
      provided,
      algorithm: 'sha256',
    });

    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        reason: 'Body webhook bukan JSON yang valid.',
        signatureValid,
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
    const externalId =
      (typeof body.event_id === 'string' && body.event_id) ||
      (typeof body.transaction_id === 'string' && body.transaction_id) ||
      null;
    const amount = Number.isFinite(Number(body.amount)) ? Math.trunc(Number(body.amount)) : null;
    const status = mapStatus(typeof body.status === 'string' ? body.status : undefined);
    const paidAt = typeof body.paid_at === 'string' ? new Date(body.paid_at) : null;

    const ok = signatureValid && Boolean(orderId) && Boolean(externalId);
    return {
      ok,
      reason: ok
        ? undefined
        : !signatureValid
          ? 'Signature webhook tidak valid.'
          : 'order_id / event_id tidak ditemukan pada payload.',
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
