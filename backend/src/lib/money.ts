// ============================================================
// Money helpers. All amounts are integer rupiah (no floats) to
// avoid rounding drift. Prices are ALWAYS computed server-side from
// the database — the client-supplied price is ignored entirely.
// ============================================================

export function toInt(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export interface FeeRule {
  feePercent?: number | null;
  feeFixed?: number | null;
}

/** Compute the admin fee for a payment method on a given base price. */
export function computeAdminFee(price: number, method: FeeRule | null | undefined): number {
  if (!method) return 0;
  const pct = Math.round((price * (Number(method.feePercent) || 0)) / 100);
  return pct + (Number(method.feeFixed) || 0);
}

export function formatIDR(amount: number): string {
  return `Rp${new Intl.NumberFormat('id-ID').format(Math.trunc(amount))}`;
}

/** Compare two integer amounts with a tolerance (default: exact). */
export function amountsMatch(a: number, b: number, tolerance = 0): boolean {
  return Math.abs(toInt(a) - toInt(b)) <= tolerance;
}
