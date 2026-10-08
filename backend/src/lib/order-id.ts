// ============================================================
// Public order reference generator: HVY-YYMMDD-XXXXXX
// Uniqueness is additionally enforced by a UNIQUE constraint on
// Order.orderId, so a rare collision is caught at the DB level.
// ============================================================
import { randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 ambiguity

export function makeOrderId(now = new Date()): string {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  let suffix = '';
  for (let i = 0; i < 6; i += 1) suffix += ALPHABET[randomInt(0, ALPHABET.length)];
  return `HVY-${yy}${mm}${dd}-${suffix}`;
}

const ORDER_ID_RE = /^HVY-\d{6}-[A-Z0-9]{6}$/;

export function isOrderId(value: string): boolean {
  return ORDER_ID_RE.test(value);
}
