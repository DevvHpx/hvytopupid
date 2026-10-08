// ============================================================
// Environment configuration — validated with Zod.
// The process exits fast if anything required is missing.
// ============================================================
import 'dotenv/config';
import { z } from 'zod';

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? def : v.toLowerCase() === 'true' || v === '1'));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_BASE_URL: z.string().default('http://localhost:4000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  COOKIE_SECRET: z.string().min(8),
  ADMIN_COOKIE_NAME: z.string().default('hv_admin'),
  CORS_ORIGINS: z.string().default(''),

  PAYMENT_PROVIDER: z.string().default('midtrans'),
  PAYMENT_GATEWAY_KEY: z.string().default(''),
  PAYMENT_GATEWAY_SECRET: z.string().default(''),
  PAYMENT_WEBHOOK_SECRET: z.string().default(''),
  PAYMENT_MERCHANT_ID: z.string().default(''),

  DIGIFLAZZ_USERNAME: z.string().default(''),
  DIGIFLAZZ_API_KEY: z.string().default(''),
  DIGIFLAZZ_WEBHOOK_SECRET: z.string().default(''),
  DIGIFLAZZ_BASE_URL: z.string().default('https://api.digiflazz.com/v1'),
  DIGIFLAZZ_TESTING: bool(true),

  VIP_RESELLER_USERNAME: z.string().default(''),
  VIP_RESELLER_API_KEY: z.string().default(''),
  VIP_RESELLER_SECRET: z.string().default(''),
  VIP_RESELLER_BASE_URL: z.string().default(''),

  CUSTOM_SUPPLIER_BASE_URL: z.string().default(''),
  CUSTOM_SUPPLIER_API_KEY: z.string().default(''),

  SUPPLIER_DEFAULT: z.string().default('digiflazz'),

  ORDER_MAX_RETRIES: z.coerce.number().int().min(0).default(4),
  ORDER_RETRY_BASE_MS: z.coerce.number().int().min(100).default(2000),
  ORDER_RETRY_MAX_MS: z.coerce.number().int().min(1000).default(60000),
  ORDER_LOCK_TTL_MS: z.coerce.number().int().min(5000).default(30000),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().default(120),
  WEBHOOK_RATE_LIMIT_MAX: z.coerce.number().int().default(600),

  // Sandbox payment method is a clearly-labelled test mode. It is
  // disabled automatically in production unless explicitly enabled.
  SANDBOX_ENABLED: bool(true),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('✖ Invalid environment configuration:');
    // eslint-disable-next-line no-console
    console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
    process.exit(1);
  }
  return parsed.data;
}

export const env = load();
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
/** Sandbox is never active in production unless explicitly enabled. */
export const sandboxEnabled = env.SANDBOX_ENABLED && !isProd;
export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
