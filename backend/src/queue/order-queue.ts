// ============================================================
// BullMQ order queue.
//
// The webhook only enqueues a job — it never calls the supplier
// synchronously. That keeps webhook latency low and guarantees the
// supplier call happens exactly once per order (guarded by a Redis
// lock + DB unique constraints inside the engine).
//
// Retries are managed by the engine itself (check-status-before-retry,
// exponential backoff) so BullMQ attempts are pinned to 1.
// ============================================================
import { Queue } from 'bullmq';
import { bullConnection } from '../config/redis';
import { logger } from '../config/logger';

export const ORDER_QUEUE = 'order-fulfillment';
export type OrderJobName = 'process' | 'reconcile';

export interface OrderJobData {
  orderId: string;
  reason?: string;
}

let queue: Queue<OrderJobData> | null = null;

export function getOrderQueue(): Queue<OrderJobData> {
  if (!queue) {
    queue = new Queue<OrderJobData>(ORDER_QUEUE, {
      connection: bullConnection(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86400, count: 5000 },
      },
    });
  }
  return queue;
}

/** Enqueue immediate fulfillment (after payment is confirmed). */
export async function enqueueProcess(orderId: string, reason = 'payment_confirmed') {
  const job = await getOrderQueue().add(
    'process',
    { orderId, reason },
    // NOTE: BullMQ forbids ':' in custom job ids, so use '__' as separator.
    { jobId: `process__${orderId}`, delay: 0 },
  );
  logger.info({ orderId, jobId: job.id, reason }, 'enqueued order processing');
  return job;
}

/**
 * Enqueue a delayed reconcile (for PENDING_SUPPLIER or a retry).
 * The jobId includes the attempt so BullMQ does not collapse retries.
 */
export async function enqueueReconcile(orderId: string, delayMs: number, attempt: number) {
  const job = await getOrderQueue().add(
    'reconcile',
    { orderId, reason: `attempt_${attempt}` },
    { jobId: `reconcile__${orderId}__${attempt}`, delay: Math.max(0, delayMs) },
  );
  logger.info({ orderId, jobId: job.id, delayMs, attempt }, 'enqueued order reconcile');
  return job;
}

export async function queueHealth() {
  const q = getOrderQueue();
  const [waiting, active, delayed, failed, completed] = await Promise.all([
    q.getWaitingCount(),
    q.getActiveCount(),
    q.getDelayedCount(),
    q.getFailedCount(),
    q.getCompletedCount(),
  ]);
  return { waiting, active, delayed, failed, completed };
}
