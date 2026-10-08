// ============================================================
// Redis connection (queue + distributed locks).
// ============================================================
import IORedis from 'ioredis';
import { env } from './env';

export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redis.on('error', (err) => {
  // Avoid crashing the process on transient Redis errors.
  // eslint-disable-next-line no-console
  console.error('[redis] error', err.message);
});

/** BullMQ accepts a connection options object. */
export function bullConnection() {
  return { url: env.REDIS_URL };
}
