// ============================================================
// Idempotency helpers.
//
// Two layers of protection against duplicate processing:
//   1. DB UNIQUE constraints (Order.idempotencyKey, Order.supplierRef,
//      WebhookEvent @@unique([provider, externalId])).
//   2. Redis SETNX guards for hot paths (webhook + supplier dispatch).
//
// A client may send an `Idempotency-Key` header when creating an order.
// The same key always resolves to the same order.
// ============================================================
import { sha256Hex } from './crypto';

/** Derive a deterministic key from a client-supplied idempotency key. */
export function deriveIdempotencyKey(parts: (string | number | undefined | null)[]): string {
  return sha256Hex(parts.map((p) => String(p ?? '')).join('|'));
}

/**
 * Build the unique reference sent to a supplier. It must be stable for
 * an order so that a retry can never create a second supplier transaction.
 */
export function supplierRefFor(orderId: string, supplier: string): string {
  return `${orderId}-${supplier}`.toUpperCase();
}

/** Namespaced Redis key for webhook de-duplication. */
export function webhookGuardKey(provider: string, externalId: string): string {
  return `wh:${provider}:${externalId}`;
}
