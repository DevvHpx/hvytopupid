// ============================================================
// Unit tests — public order id generator.
// ============================================================
import { describe, it, expect } from 'vitest';
import { makeOrderId, isOrderId } from '../../src/lib/order-id';

describe('order-id', () => {
  it('produces the documented HVY-YYMMDD-XXXXXX shape', () => {
    const id = makeOrderId(new Date('2026-10-08T12:00:00Z'));
    expect(id).toMatch(/^HVY-\d{6}-[A-Z0-9]{6}$/);
    expect(id.startsWith('HVY-261008-')).toBe(true);
  });

  it('avoids ambiguous characters (no I, O, 0, 1)', () => {
    for (let i = 0; i < 200; i += 1) {
      const suffix = makeOrderId().split('-')[2]!;
      expect(suffix).not.toMatch(/[IO01]/);
    }
  });

  it('is (practically) unique across many draws', () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i += 1) set.add(makeOrderId());
    expect(set.size).toBe(1000);
  });

  it('isOrderId validates the format', () => {
    expect(isOrderId(makeOrderId())).toBe(true);
    expect(isOrderId('HVY-261008-ABCDEF')).toBe(true);
    expect(isOrderId('hvy-261008-abcdef')).toBe(false); // lowercase
    expect(isOrderId('HVY-2610-ABCDEF')).toBe(false); // short date
    expect(isOrderId('HVY-261008-ABC')).toBe(false); // short suffix
    expect(isOrderId('ORD-261008-ABCDEF')).toBe(false); // wrong prefix
  });
});
