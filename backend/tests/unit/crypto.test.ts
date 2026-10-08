// ============================================================
// Unit tests — cryptographic helpers.
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  sha256Hex,
  md5Hex,
  hmacSha256,
  hmacSha512,
  safeEqual,
  randomToken,
  verifyHmacSignature,
} from '../../src/lib/crypto';

describe('crypto', () => {
  it('sha256Hex matches the known digest', () => {
    // echo -n "abc" | sha256sum
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('md5Hex matches the known digest (Digiflazz signature primitive)', () => {
    expect(md5Hex('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(md5Hex('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });

  it('hmacSha256 is deterministic and secret-dependent', () => {
    const a = hmacSha256('secret', 'payload');
    const b = hmacSha256('secret', 'payload');
    const c = hmacSha256('other', 'payload');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(64); // hex
  });

  it('hmacSha512 returns a 128-char hex digest', () => {
    expect(hmacSha512('secret', 'payload')).toHaveLength(128);
  });

  it('safeEqual is true only for identical strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false); // length mismatch, no throw
    expect(safeEqual('', '')).toBe(true);
  });

  it('randomToken returns hex of the requested byte length', () => {
    expect(randomToken(16)).toHaveLength(32);
    expect(randomToken(24)).toHaveLength(48);
    expect(randomToken(16)).not.toBe(randomToken(16));
  });

  describe('verifyHmacSignature', () => {
    const secret = 'test-secret';
    const body = JSON.stringify({ hello: 'world' });

    it('accepts a `sha256=<hex>` header', () => {
      const sig = hmacSha256(secret, body);
      expect(verifyHmacSignature({ secret, rawBody: body, provided: `sha256=${sig}` })).toBe(true);
    });

    it('accepts a raw hex header', () => {
      const sig = hmacSha256(secret, body);
      expect(verifyHmacSignature({ secret, rawBody: body, provided: sig })).toBe(true);
    });

    it('rejects a wrong signature', () => {
      expect(verifyHmacSignature({ secret, rawBody: body, provided: 'sha256=deadbeef' })).toBe(false);
    });

    it('rejects when the body was tampered with', () => {
      const sig = hmacSha256(secret, body);
      expect(verifyHmacSignature({ secret, rawBody: `${body} `, provided: `sha256=${sig}` })).toBe(false);
    });

    it('rejects a missing secret or header', () => {
      expect(verifyHmacSignature({ secret: '', rawBody: body, provided: 'x' })).toBe(false);
      expect(verifyHmacSignature({ secret, rawBody: body, provided: undefined })).toBe(false);
    });
  });
});
