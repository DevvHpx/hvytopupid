// ============================================================
// Unit tests — order state machine, account-field validation and
// server-side pricing.
// ============================================================
import { describe, it, expect } from 'vitest';
import { OrderStatus } from '@prisma/client';
import {
  canTransition,
  assertTransition,
  validateAccountFields,
  composeCustomerNo,
  computePricing,
} from '../../src/services/order-service';

describe('order state machine', () => {
  it('allows the happy path', () => {
    expect(canTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.PAID)).toBe(true);
    expect(canTransition(OrderStatus.PAID, OrderStatus.QUEUED)).toBe(true);
    expect(canTransition(OrderStatus.QUEUED, OrderStatus.PROCESSING)).toBe(true);
    expect(canTransition(OrderStatus.PROCESSING, OrderStatus.SUCCESS)).toBe(true);
  });

  it('allows a PENDING_SUPPLIER order to re-enter PROCESSING (retry)', () => {
    expect(canTransition(OrderStatus.PENDING_SUPPLIER, OrderStatus.PROCESSING)).toBe(true);
    expect(canTransition(OrderStatus.PENDING_SUPPLIER, OrderStatus.SUCCESS)).toBe(true);
    expect(canTransition(OrderStatus.PENDING_SUPPLIER, OrderStatus.FAILED)).toBe(true);
    expect(canTransition(OrderStatus.PENDING_SUPPLIER, OrderStatus.MANUAL_REVIEW)).toBe(true);
  });

  it('treats a no-op transition as valid', () => {
    expect(canTransition(OrderStatus.PAID, OrderStatus.PAID)).toBe(true);
  });

  it('forbids illegal jumps', () => {
    expect(canTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.SUCCESS)).toBe(false);
    expect(canTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.PROCESSING)).toBe(false);
    expect(canTransition(OrderStatus.SUCCESS, OrderStatus.PENDING_PAYMENT)).toBe(false);
    expect(canTransition(OrderStatus.CANCELLED, OrderStatus.PAID)).toBe(false);
    expect(canTransition(OrderStatus.REFUNDED, OrderStatus.PAID)).toBe(false);
  });

  it('SUCCESS / CANCELLED / REFUNDED are terminal', () => {
    for (const to of Object.values(OrderStatus)) {
      if (to === OrderStatus.SUCCESS || to === OrderStatus.CANCELLED || to === OrderStatus.REFUNDED) continue;
      expect(canTransition(OrderStatus.SUCCESS, to)).toBe(false);
      expect(canTransition(OrderStatus.CANCELLED, to)).toBe(false);
      expect(canTransition(OrderStatus.REFUNDED, to)).toBe(false);
    }
  });

  it('assertTransition throws on an illegal move', () => {
    expect(() => assertTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.SUCCESS)).toThrow(/Transisi status tidak valid/);
    expect(() => assertTransition(OrderStatus.PAID, OrderStatus.QUEUED)).not.toThrow();
  });
});

describe('validateAccountFields', () => {
  const schema = [
    { key: 'user_id', label: 'User ID', type: 'number', required: true },
    { key: 'zone_id', label: 'Zone ID', type: 'number', required: true },
  ];

  it('accepts valid numeric fields and trims', () => {
    const { errors, clean } = validateAccountFields(schema, { user_id: ' 12345 ', zone_id: '678' });
    expect(errors).toEqual({});
    expect(clean).toEqual({ user_id: '12345', zone_id: '678' });
  });

  it('flags missing required fields', () => {
    const { errors } = validateAccountFields(schema, { user_id: '123' });
    expect(errors.zone_id).toMatch(/wajib diisi/);
  });

  it('rejects non-numeric values for number fields', () => {
    const { errors } = validateAccountFields(schema, { user_id: 'abc', zone_id: '1' });
    expect(errors.user_id).toMatch(/hanya boleh angka/);
  });

  it('validates select options', () => {
    const sel = [{ key: 'server', label: 'Server', type: 'select', required: true, options: ['Asia', 'Europe'] }];
    expect(validateAccountFields(sel, { server: 'Asia' }).errors).toEqual({});
    expect(validateAccountFields(sel, { server: 'Mars' }).errors.server).toMatch(/tidak valid/);
  });
});

describe('composeCustomerNo', () => {
  it('joins schema-ordered field values', () => {
    const schema = [
      { key: 'user_id', label: 'User ID' },
      { key: 'zone_id', label: 'Zone ID' },
    ];
    expect(composeCustomerNo(schema, { user_id: '123', zone_id: '456' })).toBe('123456');
  });

  it('falls back to concatenating provided values when no schema matches', () => {
    expect(composeCustomerNo([], { a: '1', b: '2' })).toBe('12');
  });
});

describe('computePricing', () => {
  it('computes total = price + admin fee (server-side)', () => {
    const p = computePricing({ name: '86 Diamonds', sku: 'ml:86', price: 20000 }, { feePercent: 0.7, feeFixed: 0 });
    expect(p).toEqual({
      productName: '86 Diamonds',
      productSku: 'ml:86',
      price: 20000,
      adminFee: 140,
      total: 20140,
      currency: 'IDR',
    });
  });

  it('handles a null payment method (no fee)', () => {
    const p = computePricing({ name: 'x', sku: 's', price: 10000 }, null);
    expect(p.adminFee).toBe(0);
    expect(p.total).toBe(10000);
  });
});
