// ============================================================
// Payment provider registry.
// PAYMENT_PROVIDER selects the active gateway (midtrans | generic-hmac).
// ============================================================
import { env } from '../config/env';
import { MidtransProvider } from './midtrans';
import { GenericHmacProvider } from './generic-hmac';
import type { PaymentProvider } from './types';

const providers: Record<string, PaymentProvider> = {
  midtrans: new MidtransProvider(),
  'generic-hmac': new GenericHmacProvider(),
};

export function getPaymentProvider(name?: string | null): PaymentProvider {
  const key = (name ?? env.PAYMENT_PROVIDER).toLowerCase();
  return providers[key] ?? providers['generic-hmac']!;
}

export function paymentStatus() {
  return Object.values(providers).map((p) => ({ name: p.name, configured: p.isConfigured() }));
}

export * from './types';
