// ============================================================
// Payment gateway abstraction.
// The order engine only needs: create a charge, and verify+parse a
// webhook. Signature/amount/merchant checks happen inside the
// provider so they can never be forgotten by a caller.
// ============================================================

export type GatewayEventStatus = 'PAID' | 'EXPIRED' | 'FAILED' | 'PENDING' | 'REFUNDED' | 'UNKNOWN';

export interface ChargeRequest {
  orderId: string;
  amount: number;
  currency: string;
  paymentCode: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  items: { name: string; price: number; quantity: number }[];
}

export interface ChargeResult {
  ok: boolean;
  configured: boolean;
  /** Redirect URL the customer must visit (if the gateway is hosted). */
  redirectUrl?: string | null;
  /** Gateway-side reference / token. */
  gatewayRef?: string | null;
  /** Manual instructions (VA number, QR string, etc.). */
  instructions?: string[];
  /** Raw (sanitised) gateway response. */
  raw?: unknown;
  reason?: string;
}

export interface WebhookVerification {
  /** Signature valid AND merchant/order reference present. */
  ok: boolean;
  /** Machine reason when ok=false. */
  reason?: string;
  signatureValid: boolean;
  provider: string;
  /** Gateway transaction id (used for idempotency). */
  externalId: string | null;
  /** Merchant order reference (our HVY-... id). */
  orderId: string | null;
  amount: number | null;
  status: GatewayEventStatus;
  paidAt: Date | null;
  /** Sanitised payload stored for auditing. */
  raw: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  isConfigured(): boolean;
  createCharge(req: ChargeRequest): Promise<ChargeResult>;
  /** Verify + normalise an incoming webhook. Must not throw. */
  verifyWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): Promise<WebhookVerification>;
}
