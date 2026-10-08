// ============================================================
// Integration tests — full order lifecycle.
//
//   create (server-side pricing) -> sandbox pay -> confirm ->
//   processOrder (worker) -> supplier API -> SUCCESS
//
// Uses the real Express app (supertest), the real Postgres test DB and
// a mock supplier HTTP server implementing the CustomSupplier contract.
// ============================================================
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../helpers/app';
import { prisma, resetDb, seedTestData, type SeededData } from '../helpers/db';
import { startMockSupplier, type MockSupplier } from '../helpers/mock-supplier';
import { closeAll } from '../helpers/teardown';
import { redis } from '../../src/config/redis';
import { processOrder } from '../../src/services/order-engine';

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
  supplier.setMode('SUCCESS');
  supplier.calls.order = 0;
  supplier.calls.status = 0;
});

const account = { user_id: '123456789', zone_id: '1234' };

async function createOrder(extra: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/v1/orders')
    .send({
      slug: 'mobile-legends',
      productId: seed.productId,
      paymentCode: 'sandbox',
      fields: account,
      email: 'buyer@example.com',
      ...extra,
    });
  return res;
}

describe('order lifecycle', () => {
  it('creates an order with a server-side price snapshot', async () => {
    const res = await createOrder();
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.orderId).toMatch(/^HVY-\d{6}-[A-Z0-9]{6}$/);
    expect(res.body.order.status).toBe('PENDING_PAYMENT');
    expect(res.body.order.paymentStatus).toBe('PENDING');
    expect(res.body.order.price).toBe(20000);
    expect(res.body.order.adminFee).toBe(0); // sandbox has no fee
    expect(res.body.order.total).toBe(20000);
  });

  it('ignores any client-supplied price / total / status', async () => {
    const res = await createOrder({ price: 1, total: 1, adminFee: 0, status: 'SUCCESS' });
    expect(res.status).toBe(201);
    expect(res.body.order.total).toBe(20000);
    expect(res.body.order.status).toBe('PENDING_PAYMENT');
  });

  it('adds the payment-method admin fee server-side', async () => {
    // qris has a 0.7% fee but is not_configured -> must be rejected.
    const res = await createOrder({ paymentCode: 'qris' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects a product that does not belong to the game', async () => {
    const res = await createOrder({ productId: 'does-not-exist' });
    expect(res.status).toBe(400);
  });

  it('rejects incomplete account fields', async () => {
    const res = await createOrder({ fields: { user_id: '123' } });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toBeTruthy();
  });

  it('is idempotent when the client sends an Idempotency-Key', async () => {
    const key = 'client-key-123456';
    const a = await createOrder({ idempotencyKey: key });
    const b = await createOrder({ idempotencyKey: key });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.body.idempotent).toBe(true);
    expect(b.body.orderId).toBe(a.body.orderId);
    expect(await prisma.order.count()).toBe(1);
  });

  it('runs the full lifecycle to SUCCESS via the supplier', async () => {
    const created = await createOrder();
    const orderId = created.body.orderId as string;

    // 1. charge (sandbox) returns a confirm URL
    const pay = await request(app).post(`/api/v1/orders/${orderId}/pay`).send({}).expect(200);
    expect(pay.body.charge.sandbox).toBe(true);
    expect(pay.body.charge.confirmUrl).toContain('/sandbox/confirm');

    // 2. confirm the (sandbox) payment -> PAID
    await request(app).post(`/api/v1/orders/${orderId}/sandbox/confirm`).send({}).expect(200);
    let order = await prisma.order.findUnique({ where: { orderId } });
    expect(order!.status).toBe('PAID');
    expect(order!.paymentStatus).toBe('PAID');

    // 3. worker processes the order
    const outcome = await processOrder(orderId);
    expect(outcome.ok).toBe(true);

    order = await prisma.order.findUnique({ where: { orderId } });
    expect(order!.status).toBe('SUCCESS');
    expect(order!.topupStatus).toBe('success');

    // exactly one supplier transaction, created exactly once
    expect(supplier.calls.order).toBe(1);
    expect(supplier.calls.status).toBe(0);
    const txns = await prisma.supplierTransaction.findMany({ where: { orderId: order!.id } });
    expect(txns).toHaveLength(1);
    expect(txns[0]!.status).toBe('SUCCESS');
    expect(txns[0]!.supplierTrxId).toBeTruthy();
    expect(txns[0]!.requestAt).toBeTruthy();
    expect(txns[0]!.responseAt).toBeTruthy();
  });

  it('never creates a second supplier transaction on a duplicate process call', async () => {
    const created = await createOrder();
    const orderId = created.body.orderId as string;
    await request(app).post(`/api/v1/orders/${orderId}/sandbox/confirm`).send({}).expect(200);

    await processOrder(orderId);
    await processOrder(orderId); // duplicate job
    await processOrder(orderId); // duplicate job

    const order = await prisma.order.findUnique({ where: { orderId } });
    expect(order!.status).toBe('SUCCESS');
    expect(supplier.calls.order).toBe(1); // still exactly one
    expect(await prisma.supplierTransaction.count({ where: { orderId: order!.id } })).toBe(1);
  });

  it('does not process an unpaid order', async () => {
    const created = await createOrder();
    const outcome = await processOrder(created.body.orderId);
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toBe('not_paid');
    expect(supplier.calls.order).toBe(0);
  });

  it('marks the order FAILED when the supplier rejects it', async () => {
    supplier.setMode('FAILED');
    const created = await createOrder();
    const orderId = created.body.orderId as string;
    await request(app).post(`/api/v1/orders/${orderId}/sandbox/confirm`).send({}).expect(200);

    await processOrder(orderId);
    const order = await prisma.order.findUnique({ where: { orderId } });
    expect(order!.status).toBe('FAILED');
    expect(order!.topupStatus).toBe('failed');
  });

  it('moves the order to PENDING_SUPPLIER when the supplier is still processing', async () => {
    supplier.setMode('PENDING');
    const created = await createOrder();
    const orderId = created.body.orderId as string;
    await request(app).post(`/api/v1/orders/${orderId}/sandbox/confirm`).send({}).expect(200);

    await processOrder(orderId);
    const order = await prisma.order.findUnique({ where: { orderId } });
    expect(order!.status).toBe('PENDING_SUPPLIER');
    expect(order!.topupStatus).toBe('pending');
    expect(order!.nextRetryAt).toBeTruthy();
  });

  it('cancels a pending order and refuses to process it', async () => {
    const created = await createOrder();
    const orderId = created.body.orderId as string;
    await request(app).post(`/api/v1/orders/${orderId}/cancel`).send({}).expect(200);
    const order = await prisma.order.findUnique({ where: { orderId } });
    expect(order!.status).toBe('CANCELLED');

    const outcome = await processOrder(orderId);
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toBe('terminal');
  });

  it('lets a customer look up an order by id and contact', async () => {
    const created = await createOrder();
    const orderId = created.body.orderId as string;
    await request(app).post('/api/v1/orders/check').send({ orderId }).expect(200);
    await request(app)
      .post('/api/v1/orders/check')
      .send({ orderId, contact: 'buyer@example.com' })
      .expect(200);
    await request(app)
      .post('/api/v1/orders/check')
      .send({ orderId, contact: 'someone-else@example.com' })
      .expect(404);
  });
});
