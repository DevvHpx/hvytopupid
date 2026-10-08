// ============================================================
// Cryptographic helpers.
//  - HMAC-SHA256 signing / verification (payment webhooks)
//  - MD5 (required by the Digiflazz signature spec)
//  - SHA-256 hashing (idempotency keys, request fingerprints)
//  - timing-safe comparison (never compare secrets with ===)
// ============================================================
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function md5Hex(input: string | Buffer): string {
  return createHash('md5').update(input).digest('hex');
}

export function hmacSha256(secret: string, payload: string | Buffer, encoding: 'hex' | 'base64' = 'hex') {
  return createHmac('sha256', secret).update(payload).digest(encoding);
}

export function hmacSha512(secret: string, payload: string | Buffer, encoding: 'hex' | 'base64' = 'hex') {
  return createHmac('sha512', secret).update(payload).digest(encoding);
}

/**
 * Constant-time string comparison. Returns false when lengths differ
 * (length itself is not secret). Never throws.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  try {
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/** Random URL-safe token (used for lock owners, request ids, nonces). */
export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Verify an HMAC-SHA256 signature provided in a header against the
 * raw request body. Supports `sha256=<hex>` and raw hex/base64 forms.
 */
export function verifyHmacSignature(opts: {
  secret: string;
  rawBody: string | Buffer;
  provided: string | undefined;
  algorithm?: 'sha256' | 'sha512';
  encoding?: 'hex' | 'base64';
}): boolean {
  const { secret, rawBody, provided, algorithm = 'sha256', encoding = 'hex' } = opts;
  if (!secret || !provided) return false;
  const clean = provided.includes('=') ? provided.split('=').slice(1).join('=') : provided;
  const expected =
    algorithm === 'sha512' ? hmacSha512(secret, rawBody, encoding) : hmacSha256(secret, rawBody, encoding);
  return safeEqual(expected, clean.trim());
}
