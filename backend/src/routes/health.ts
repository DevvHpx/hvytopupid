// ============================================================
// Health & readiness endpoints.
// ============================================================
import { Router } from 'express';
import { prisma } from '../db/prisma';
import { redis } from '../config/redis';
import { asyncHandler } from '../lib/async-handler';
import { supplierStatus } from '../suppliers';
import { paymentStatus } from '../payments';

export const health = Router();

health.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'heavyy-topup-backend', time: new Date().toISOString() });
});

health.get(
  '/readyz',
  asyncHandler(async (_req, res) => {
    const checks: Record<string, boolean> = {};
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }
    try {
      checks.redis = (await redis.ping()) === 'PONG';
    } catch {
      checks.redis = false;
    }
    const ok = Object.values(checks).every(Boolean);
    res.status(ok ? 200 : 503).json({ ok, checks, time: new Date().toISOString() });
  }),
);

health.get('/api/v1/integrations', (_req, res) => {
  res.json({
    ok: true,
    suppliers: supplierStatus(),
    payments: paymentStatus(),
  });
});
