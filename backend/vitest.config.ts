import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Shared Postgres/Redis state → run files sequentially.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgresql://heavyy:heavyy@localhost:5432/heavyy_test?schema=public',
      REDIS_URL: 'redis://localhost:6379/1',
      JWT_SECRET: 'test-jwt-secret-please-change-1234567890',
      COOKIE_SECRET: 'test-cookie-secret',
      PAYMENT_PROVIDER: 'generic-hmac',
      PAYMENT_WEBHOOK_SECRET: 'test-webhook-secret',
      SUPPLIER_DEFAULT: 'custom',
      CUSTOM_SUPPLIER_BASE_URL: 'http://127.0.0.1:4010',
      CUSTOM_SUPPLIER_API_KEY: 'test-supplier-key',
      ADMIN_EMAIL: 'admin@test.local',
      ADMIN_PASSWORD: 'TestPassword123!',
      SANDBOX_ENABLED: 'true',
    },
  },
});
