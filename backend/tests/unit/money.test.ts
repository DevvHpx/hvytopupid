// ============================================================
// Unit tests — money helpers (server-side pricing primitives).
// ============================================================
import { describe, it, expect } from 'vitest';
import { toInt, computeAdminFee, formatIDR, amountsMatch } from '../../src/lib/money';

describe('money', () => {
  describe('toInt', () => {
    it('truncates floats and parses strings', () => {
      expect(toInt(20000)).toBe(20000);
      expect(toInt(20000.9)).toBe(20000);
      expect(toInt('20000')).toBe(20000);
      expect(toInt('20000abc')).toBe(20000);
    });
    it('falls back for junk', () => {
      expect(toInt('abc', 5)).toBe(5);
      expect(toInt(null, 7)).toBe(7);
      expect(toInt(undefined)).toBe(0);
      expect(toInt(Infinity, 3)).toBe(3);
    });
  });

  describe('computeAdminFee', () => {
    it('returns 0 when there is no method', () => {
      expect(computeAdminFee(20000, null)).toBe(0);
      expect(computeAdminFee(20000, undefined)).toBe(0);
    });
    it('applies a percentage fee (rounded)', () => {
      expect(computeAdminFee(20000, { feePercent: 0.7, feeFixed: 0 })).toBe(140);
      expect(computeAdminFee(10000, { feePercent: 2, feeFixed: 0 })).toBe(200);
    });
    it('adds a fixed fee', () => {
      expect(computeAdminFee(20000, { feePercent: 0, feeFixed: 4000 })).toBe(4000);
    });
    it('combines percent + fixed', () => {
      expect(computeAdminFee(20000, { feePercent: 1, feeFixed: 1000 })).toBe(1200);
    });
  });

  describe('formatIDR', () => {
    it('formats with the Rp prefix and thousands separators', () => {
      expect(formatIDR(20000)).toBe('Rp20.000');
      expect(formatIDR(1234567)).toBe('Rp1.234.567');
      expect(formatIDR(0)).toBe('Rp0');
    });
  });

  describe('amountsMatch', () => {
    it('is exact by default', () => {
      expect(amountsMatch(20000, 20000)).toBe(true);
      expect(amountsMatch(20000, 20001)).toBe(false);
    });
    it('honours a tolerance', () => {
      expect(amountsMatch(20000, 20001, 1)).toBe(true);
      expect(amountsMatch(20000, 20002, 1)).toBe(false);
    });
  });
});
