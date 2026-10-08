// ============================================================
// Structured logger (pino) with secret redaction.
// API keys / secrets / signatures must never reach the logs.
// ============================================================
import pino from 'pino';
import { env } from './env';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-signature"]',
  'req.headers["x-callback-token"]',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  'password',
  'passwordHash',
  'apiKey',
  'api_key',
  'secret',
  'signature',
  'token',
  'authorization',
  '*.password',
  '*.passwordHash',
  '*.apiKey',
  '*.api_key',
  '*.secret',
  '*.signature',
  '*.token',
  '*.authorization',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'heavyy-topup-backend', env: env.NODE_ENV },
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
