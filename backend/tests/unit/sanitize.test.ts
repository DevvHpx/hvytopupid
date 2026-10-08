// ============================================================
// Unit tests — payload sanitisation (never store/log secrets).
// ============================================================
import { describe, it, expect } from 'vitest';
import { sanitize, sanitizeHeaders } from '../../src/lib/sanitize';

describe('sanitize', () => {
  it('redacts sensitive keys (case-insensitive)', () => {
    const out = sanitize({
      username: 'buyer',
      password: 'p@ss',
      api_key: 'k',
      apiKey: 'k2',
      signature: 'sig',
      token: 't',
      authorization: 'Bearer x',
      cookie: 'session=1',
      secret: 's',
      private_key: 'pk',
      otp: '123456',
    }) as Record<string, unknown>;

    expect(out.username).toBe('buyer');
    for (const k of ['password', 'api_key', 'apiKey', 'signature', 'token', 'authorization', 'cookie', 'secret', 'private_key', 'otp']) {
      expect(out[k]).toBe('[REDACTED]');
    }
  });

  it('keeps non-sensitive data intact', () => {
    const out = sanitize({ ref_id: 'HVY-1', amount: 20000, ok: true }) as Record<string, unknown>;
    expect(out).toEqual({ ref_id: 'HVY-1', amount: 20000, ok: true });
  });

  it('walks nested objects and arrays', () => {
    const out = sanitize({ data: { nested: { apiKey: 'x', keep: 1 } }, list: [{ token: 'y' }] }) as {
      data: { nested: Record<string, unknown> };
      list: Record<string, unknown>[];
    };
    expect(out.data.nested.apiKey).toBe('[REDACTED]');
    expect(out.data.nested.keep).toBe(1);
    expect(out.list[0]!.token).toBe('[REDACTED]');
  });

  it('truncates very long strings', () => {
    const long = 'a'.repeat(5000);
    const out = sanitize({ note: long }) as { note: string };
    expect(out.note.length).toBeLessThan(5000);
    expect(out.note).toContain('[truncated]');
  });

  it('handles null / primitives without throwing', () => {
    expect(sanitize(null)).toBeNull();
    expect(sanitize(5)).toBe(5);
    expect(sanitize('x')).toBe('x');
    expect(sanitize(true)).toBe(true);
  });

  it('sanitizeHeaders redacts auth + cookie headers', () => {
    const out = sanitizeHeaders({ 'content-type': 'application/json', authorization: 'Bearer secret', cookie: 'a=b' });
    expect(out['content-type']).toBe('application/json');
    expect(out.authorization).toBe('[REDACTED]');
    expect(out.cookie).toBe('[REDACTED]');
  });
});
