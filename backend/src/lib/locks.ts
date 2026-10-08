// ============================================================
// Distributed locking (Redis) — prevents race conditions when two
// workers (or a webhook + a cron) try to advance the same order.
//
// Acquire:  SET key <token> NX PX <ttl>
// Release:  atomic compare-and-delete via Lua (only the owner may release)
// ============================================================
import { randomToken } from './crypto';
import { redis } from '../config/redis';

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

export interface LockHandle {
  key: string;
  token: string;
  release: () => Promise<void>;
  extend: (ttlMs: number) => Promise<boolean>;
}

/**
 * Try to acquire a lock. Returns a handle on success, or null when the
 * lock is already held elsewhere.
 */
export async function acquireLock(key: string, ttlMs: number): Promise<LockHandle | null> {
  const token = randomToken(16);
  const res = await redis.set(key, token, 'PX', ttlMs, 'NX');
  if (res !== 'OK') return null;

  return {
    key,
    token,
    async release() {
      await redis.eval(RELEASE_SCRIPT, 1, key, token);
    },
    async extend(extraTtlMs: number) {
      // Only extend if we still own the lock.
      const cur = await redis.get(key);
      if (cur !== token) return false;
      await redis.pexpire(key, extraTtlMs);
      return true;
    },
  };
}

export function orderLockKey(orderId: string): string {
  return `lock:order:${orderId}`;
}

/** Convenience wrapper: run `fn` while holding the order lock. */
export async function withOrderLock<T>(
  orderId: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; reason: 'locked' }> {
  const lock = await acquireLock(orderLockKey(orderId), ttlMs);
  if (!lock) return { ok: false, reason: 'locked' };
  try {
    return { ok: true, value: await fn() };
  } finally {
    await lock.release();
  }
}
