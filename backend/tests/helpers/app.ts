// ============================================================
// Test app + webhook signing helpers.
// ============================================================
import { createApp } from '../../src/app';
import { hmacSha256 } from '../../src/lib/crypto';
import { env } from '../../src/config/env';

export function buildApp() {
  return createApp();
}

/** Sign a raw webhook body the way GenericHmacProvider expects. */
export function signWebhook(rawBody: string, secret = env.PAYMENT_WEBHOOK_SECRET): string {
  return `sha256=${hmacSha256(secret, rawBody)}`;
}

export interface WebhookPayload {
  event_id: string;
  order_id: string;
  amount: number;
  status: string;
  paid_at?: string;
}

export function webhookBody(payload: WebhookPayload): string {
  return JSON.stringify(payload);
}
