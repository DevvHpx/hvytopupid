// ============================================================
// Shared teardown for integration tests.
// Closes the BullMQ queue, the Redis client and Prisma so the
// vitest worker can exit cleanly.
// ============================================================
import { prisma } from './db';
import { redis } from '../../src/config/redis';
import { getOrderQueue } from '../../src/queue/order-queue';

export async function closeAll(): Promise<void> {
  try {
    await getOrderQueue().close();
  } catch {
    /* ignore */
  }
  try {
    await redis.quit();
  } catch {
    /* ignore */
  }
  try {
    await prisma.$disconnect();
  } catch {
    /* ignore */
  }
}
