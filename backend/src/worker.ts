// ============================================================
// Fulfillment worker.
//
// Consumes the BullMQ order queue and runs the order engine. It is a
// separate process from the API so supplier calls never block HTTP.
// A periodic sweeper recovers orders that were paid but never queued.
// ============================================================
import { Worker } from 'bullmq';
import { bullConnection } from './config/redis';
import { logger } from './config/logger';
import { prisma } from './db/prisma';
import { ORDER_QUEUE, type OrderJobData } from './queue/order-queue';
import { processOrder, reconcileOrder, sweepStuckOrders } from './services/order-engine';

const worker = new Worker<OrderJobData>(
  ORDER_QUEUE,
  async (job) => {
    const { orderId } = job.data;
    logger.info({ job: job.name, orderId, jobId: job.id }, 'worker picked job');
    const outcome = job.name === 'reconcile' ? await reconcileOrder(orderId) : await processOrder(orderId);
    logger.info({ job: job.name, orderId, outcome }, 'worker finished job');
    return outcome;
  },
  {
    connection: bullConnection(),
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
  },
);

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, orderId: job?.data.orderId, err: err.message }, 'worker job failed');
});
worker.on('error', (err) => logger.error({ err: err.message }, 'worker error'));

// ---------- sweeper ----------
const SWEEP_INTERVAL_MS = Number(process.env.SWEEP_INTERVAL_MS ?? 60_000);
const sweepTimer = setInterval(async () => {
  try {
    const n = await sweepStuckOrders();
    if (n > 0) logger.warn({ count: n }, 'sweeper re-queued stuck orders');
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : err }, 'sweeper failed');
  }
}, SWEEP_INTERVAL_MS);
sweepTimer.unref();

logger.info('fulfillment worker started');

async function shutdown(signal: string) {
  logger.info({ signal }, 'worker shutting down');
  clearInterval(sweepTimer);
  await worker.close();
  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'worker uncaughtException');
  process.exit(1);
});
