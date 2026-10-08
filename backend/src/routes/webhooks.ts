// ============================================================
// Payment webhook endpoint.
// The raw body is required for signature verification, so app.ts
// captures it via express.json({ verify }).
// ============================================================
import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { getPaymentProvider } from '../payments';
import { handlePaymentWebhook } from '../services/webhook-service';
import { webhookLimiter } from '../middleware/rate-limit';

export const webhooks = Router();

webhooks.post(
  '/payment/:provider',
  webhookLimiter,
  asyncHandler(async (req, res) => {
    const provider = getPaymentProvider(req.params.provider);
    const raw = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body ?? {});
    const outcome = await handlePaymentWebhook(provider, raw, req.headers);
    res.status(outcome.httpStatus).json(outcome.body);
  }),
);

// Convenience alias using the configured default provider.
webhooks.post(
  '/payment',
  webhookLimiter,
  asyncHandler(async (req, res) => {
    const provider = getPaymentProvider();
    const raw = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body ?? {});
    const outcome = await handlePaymentWebhook(provider, raw, req.headers);
    res.status(outcome.httpStatus).json(outcome.body);
  }),
);
