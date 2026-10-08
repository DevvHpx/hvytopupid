// ============================================================
// Payload sanitisation.
// Raw webhook bodies and supplier responses are stored/logged for
// auditing, but secrets, tokens and signatures must be stripped
// first. This module deep-walks an object and redacts any key that
// looks sensitive, and truncates oversized values.
// ============================================================

const SENSITIVE_KEY = /(pass(word)?|secret|api[-_]?key|apikey|signature|token|authorization|auth|cookie|private[-_]?key|credential|pin|otp)/i;
const REDACTED = '[REDACTED]';
const MAX_STRING = 4000;
const MAX_DEPTH = 8;
const MAX_ARRAY = 100;

export function sanitize<T = unknown>(value: T, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[TRUNCATED_DEPTH]';
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…[truncated]` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return '[FUNCTION]';

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY).map((v) => sanitize(v, depth + 1));
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? REDACTED : sanitize(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

/** Headers are sanitised with the same rules (authorization/cookie redacted). */
export function sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = SENSITIVE_KEY.test(k) ? REDACTED : v;
  }
  return out;
}
