// ============================================================
// Integration tests — the "no blind retry" guarantee.
//
// When a supplier request times out (or returns an ambiguous status),
// the engine MUST NOT blindly send a second createTransaction. It
// first INQUIRES about the existing transaction, and only escalates to
// MANUAL_REVIEW once retries are exhausted.
// ============================================================
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../helpers/app';
import { prisma, resetDb, seedTestData, type SeededData } from '../helpers/db';
import { startMockSupplier, type MockSupplier } from '../helpers/mock-supplier';
import { closeAll } from '../helpers/teardown';
import { redis } from '../../src/config/redis';
import { processOrder, reconcileOrder } from '../../src/services/order-engine';
import { env } from '../../src/config/env';

let app: ReturnType<typeof buildApp>;
let supplier: MockSupplier;
let seed: SeededData;

beforeAll(async () => {
  await redis.flushdb();
  app = buildApp();
  supplier = await startMockSupplier(4010);
});

afterAll(async () => {
  await supplier.close();
  await closeAll();
});

beforeEach(async () => {
  await resetDb();
  seed = await seedTestData();
  supplier.calls.order = 0;
  supplier.calls.status = 0;
});

async function paidOrder(): Promise<string> {
  const res = await request(app)
    .post('/api/v1/orders')
    .send({
      slug: 'mobile-legends',
      productId: seed.productId,
      paymentCode: 'sandbox',
      fields: { user_id: '123456789', zone_id: '1234' },
      email: 'buyer@example.com',
    })
    .expect(201);
  const orderId = res.body.orderId as string;
  await request(app).post(`/api/v1/orders/${orderId}/sandbox/confirm`).send({}).expect(200);
  return orderId;
}

describe('no blind retry', () => {
  it('inquiries instead of re-creating, then escalates to MANUAL_REVIEW', async () => {
    const orderId = await paidOrder();
    supplier.setMode('UNKNOWN'); // /order drops the connection, /status returns UNKNOWN

    // Attempt 1 — creates the supplier transaction (ambiguous outcome).
    const first = await processOrder(orderId);
    expect(first.ok).toBe(true);
    expect(supplier.calls.order).toBe(1);
    expect(supplier.calls.status).toBe(0);

    let order = await prisma.order.findUnique({ where: { orderId } });
    expect(order!.status).toBe('PENDING_SUPPLIER');
    expect(order!.attempts).toBe(1);

    // Attempts 2..N — MUST go through the inquiry endpoint, never a
    // second createTransaction.
    for (let i = 2; i <= env.ORDER_MAX_RETRIES; i += 1) {
      await reconcileOrder(orderId);
      order = await prisma.order.findUnique({ where: { orderId } });
      expect(supplier.calls.order).toBe(1); // never a second create
      expect(supplier.calls.status).toBe(i - 1);
    }

    // Retries exhausted -> MANUAL_REVIEW.
    expect(order!.status).toBe('MANUAL_REVIEW');
    expect(order!.attempts).toBe(env.ORDER_MAX_RETRIES);
    expect(supplier.calls.order).toBe(1);
  });

  it('recovers to SUCCESS when a later inquiry reports success', async () => {
    const orderId = await paidOrder();
    supplier.setMode('UNKNOWN');
    await processOrder(orderId); // ambiguous
    expect(supplier.calls.order).toBe(1);

    // The supplier eventually confirms success on inquiry.
    supplier.setMode('SUCCESS');
    await reconcileOrder(orderId);

    const order = await prisma.order.findUnique({ where: { orderId } });
    expect(order!.status).toBe('SUCCESS');
    expect(supplier.calls.order).toBe(1); // still only one create
    expect(supplier.calls.status).toBeGreaterThanOrEqual(1);
  });

  it('records request/response timestamps and sanitised supplier data', async () => {
    const orderId = await paidOrder();
    supplier.setMode('UNKNOWN');
    await processOrder(orderId);

    const order = await prisma.order.findUnique({ where: { orderId } });
    const txn = await prisma.supplierTransaction.findFirst({ where: { orderId: order!.id } });
    expect(txn!.requestAt).toBeTruthy();
    expect(txn!.refId).toBe(`${orderId}-custom`.toUpperCase());
    // requestAt is set before the call so a retry can never re-create it
    expect(txn!.status).toBe('UNKNOWN');
  });

  it('the supplier refId is stable across attempts (idempotency)', async () => {
    const orderId = await paidOrder();
    supplier.setMode('UNKNOWN');
    await processOrder(orderId);
    const body1 = supplier.lastOrderBody;
    await reconcileOrder(orderId);
    // No second /order call, so lastOrderBody is unchanged.
    expect(supplier.lastOrderBody).toEqual(body1);
    expect(supplier.calls.order).toBe(1);
  });
});
