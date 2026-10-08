// ============================================================
// Unit tests — Zod request schemas (input validation + hardening).
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  createOrderSchema,
  checkOrderSchema,
  adminLoginSchema,
  adminOrderStatusSchema,
  adminRefundSchema,
  phoneSchema,
  emailSchema,
  orderIdSchema,
} from '../../src/lib/validation';

describe('createOrderSchema', () => {
  const base = { slug: 'mobile-legends', productId: 'p1', paymentCode: 'sandbox' };

  it('accepts a minimal valid payload and applies defaults', () => {
    const parsed = createOrderSchema.parse(base);
    expect(parsed.fields).toEqual({});
    expect(parsed.email).toBe('');
    expect(parsed.whatsapp).toBe('');
  });

  it('strips unknown keys (mass-assignment protection)', () => {
    const parsed = createOrderSchema.parse({ ...base, price: 1, total: 1, status: 'SUCCESS' }) as Record<string, unknown>;
    expect(parsed.price).toBeUndefined();
    expect(parsed.total).toBeUndefined();
    expect(parsed.status).toBeUndefined();
  });

  it('rejects a missing slug / product / payment method', () => {
    expect(createOrderSchema.safeParse({ productId: 'p', paymentCode: 'c' }).success).toBe(false);
    expect(createOrderSchema.safeParse({ slug: 's', paymentCode: 'c' }).success).toBe(false);
    expect(createOrderSchema.safeParse({ slug: 's', productId: 'p' }).success).toBe(false);
  });

  it('validates optional email / whatsapp when provided', () => {
    expect(createOrderSchema.safeParse({ ...base, email: 'bad' }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...base, email: 'a@b.com' }).success).toBe(true);
    expect(createOrderSchema.safeParse({ ...base, whatsapp: '0812345678' }).success).toBe(true);
    expect(createOrderSchema.safeParse({ ...base, whatsapp: '123' }).success).toBe(false);
  });
});

describe('phoneSchema', () => {
  it('accepts Indonesian mobile formats', () => {
    for (const p of ['08123456789', '+628123456789', '0812345678']) {
      expect(phoneSchema.safeParse(p).success).toBe(true);
    }
  });
  it('rejects invalid numbers', () => {
    for (const p of ['12345', '0812', 'abc', '62812']) {
      expect(phoneSchema.safeParse(p).success).toBe(false);
    }
  });
});

describe('emailSchema', () => {
  it('accepts and normalises', () => {
    expect(emailSchema.parse('  a@b.com ')).toBe('a@b.com');
  });
  it('rejects invalid emails', () => {
    expect(emailSchema.safeParse('nope').success).toBe(false);
  });
});

describe('orderIdSchema', () => {
  it('uppercases and validates', () => {
    expect(orderIdSchema.parse('hvy-261008-abcdef')).toBe('HVY-261008-ABCDEF');
  });
  it('rejects malformed ids', () => {
    expect(orderIdSchema.safeParse('HVY-1-2').success).toBe(false);
  });
});

describe('checkOrderSchema', () => {
  it('requires a valid order id', () => {
    expect(checkOrderSchema.safeParse({ orderId: 'HVY-261008-ABCDEF' }).success).toBe(true);
    expect(checkOrderSchema.safeParse({ orderId: 'nope' }).success).toBe(false);
  });
});

describe('admin schemas', () => {
  it('adminLoginSchema enforces email + min password length', () => {
    expect(adminLoginSchema.safeParse({ email: 'a@b.com', password: 'short' }).success).toBe(false);
    expect(adminLoginSchema.safeParse({ email: 'a@b.com', password: 'longenough1' }).success).toBe(true);
  });

  it('adminOrderStatusSchema only accepts known statuses', () => {
    expect(adminOrderStatusSchema.safeParse({ status: 'SUCCESS' }).success).toBe(true);
    expect(adminOrderStatusSchema.safeParse({ status: 'PAID' }).success).toBe(true);
    expect(adminOrderStatusSchema.safeParse({ status: 'NONSENSE' }).success).toBe(false);
  });

  it('adminRefundSchema requires a reason', () => {
    expect(adminRefundSchema.safeParse({ reason: 'ok' }).success).toBe(false);
    expect(adminRefundSchema.safeParse({ reason: 'customer request' }).success).toBe(true);
  });
});
