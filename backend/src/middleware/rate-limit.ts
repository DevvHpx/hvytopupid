// ============================================================
// Rate limiters (express-rate-limit).
// Separate buckets for the public API, order creation, admin auth and
// webhooks so a burst on one surface cannot starve another.
// ============================================================
import rateLimit from 'express-rate-limit';
import { env, isTest } from '../config/env';

const disabled = isTest; // never throttle the test suite

function base(max: number, windowMs: number) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => disabled,
    message: { error: { code: 'RATE_LIMITED', message: 'Terlalu banyak permintaan. Coba lagi nanti.' } },
  });
}

export const apiLimiter = base(env.RATE_LIMIT_MAX, env.RATE_LIMIT_WINDOW_MS);
export const orderLimiter = base(30, env.RATE_LIMIT_WINDOW_MS);
export const authLimiter = base(10, 5 * 60 * 1000);
export const webhookLimiter = base(env.WEBHOOK_RATE_LIMIT_MAX, env.RATE_LIMIT_WINDOW_MS);
