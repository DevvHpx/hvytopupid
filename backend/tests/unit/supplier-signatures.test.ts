// ============================================================
// Unit tests — supplier / payment provider signatures & registry.
// The signing formulas are the exact ones each provider uses, so a
// regression here would break live integration.
// ============================================================
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { md5Hex } from '../../src/lib/crypto';
import { env } from '../../src/config/env';
import { DigiflazzProvider } from '../../src/suppliers/digiflazz';
import { VipResellerProvider } from '../../src/suppliers/vip-reseller';
import { CustomSupplierProvider } from '../../src/suppliers/custom';
import { MidtransProvider } from '../../src/payments/midtrans';
import { getSupplier, supplierStatus, SUPPLIER_NAMES } from '../../src/suppliers';
import { getPaymentProvider, paymentStatus } from '../../src/payments';

// Reach the (runtime-accessible) private signers via a structural cast.
type DigiSigner = { sign: (refId: string) => string };
type VipSigner = { sign: () => string };
type MidtransSigner = { signature: (orderId: string, statusCode: string, grossAmount: string) => string };

describe('DigiflazzProvider', () => {
  it('signs with md5(username + apiKey + refId)', () => {
    const p = new DigiflazzProvider() as unknown as DigiSigner;
    const refId = 'HVY-261008-ABCDEF-digiflazz';
    const expected = md5Hex(`${env.DIGIFLAZZ_USERNAME}${env.DIGIFLAZZ_API_KEY}${refId}`);
    expect(p.sign(refId)).toBe(expected);
  });

  it('isConfigured() reflects credential presence', () => {
    const p = new DigiflazzProvider();
    expect(p.isConfigured()).toBe(Boolean(env.DIGIFLAZZ_USERNAME && env.DIGIFLAZZ_API_KEY));
  });
});

describe('VipResellerProvider', () => {
  it('signs with md5(apiKey + secret)', () => {
    const p = new VipResellerProvider() as unknown as VipSigner;
    const expected = md5Hex(`${env.VIP_RESELLER_API_KEY}${env.VIP_RESELLER_SECRET}`);
    expect(p.sign()).toBe(expected);
  });
});

describe('MidtransProvider', () => {
  it('signs with sha512(order_id + status_code + gross_amount + server_key)', () => {
    const p = new MidtransProvider() as unknown as MidtransSigner;
    const expected = createHash('sha512')
      .update(`HVY-261008-ABCDEF20020000.00${env.PAYMENT_GATEWAY_SECRET}`)
      .digest('hex');
    expect(p.signature('HVY-261008-ABCDEF', '200', '20000.00')).toBe(expected);
  });
});

describe('CustomSupplierProvider', () => {
  it('is configured in the test environment', () => {
    const p = new CustomSupplierProvider();
    expect(p.isConfigured()).toBe(Boolean(env.CUSTOM_SUPPLIER_BASE_URL && env.CUSTOM_SUPPLIER_API_KEY));
  });
});

describe('supplier registry', () => {
  it('exposes all three providers with config state', () => {
    const status = supplierStatus();
    expect(status.map((s) => s.name).sort()).toEqual([...SUPPLIER_NAMES].sort());
    expect(status.every((s) => typeof s.configured === 'boolean')).toBe(true);
  });

  it('resolves a provider by name and defaults correctly', () => {
    expect(getSupplier('custom').name).toBe('custom');
    expect(getSupplier('digiflazz').name).toBe('digiflazz');
    expect(getSupplier(null).name).toBe(env.SUPPLIER_DEFAULT);
  });

  it('throws for an unknown supplier', () => {
    expect(() => getSupplier('nope')).toThrow(/tidak dikenal/);
  });
});

describe('payment registry', () => {
  it('resolves providers and reports config state', () => {
    expect(getPaymentProvider('generic-hmac').name).toBe('generic-hmac');
    expect(getPaymentProvider('midtrans').name).toBe('midtrans');
    expect(getPaymentProvider().name).toBe(env.PAYMENT_PROVIDER);
    expect(paymentStatus().map((p) => p.name).sort()).toEqual(['generic-hmac', 'midtrans']);
  });
});
