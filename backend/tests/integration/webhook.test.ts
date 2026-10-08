// ============================================================
// Integration tests — payment webhook handling.
//
// Verifies the security gates that must ALL pass before a top-up is
// triggered: signature, merchant/order reference, amount, and
// idempotency (a duplicate webhook must never create a second top-up).
// ============================================================
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../helpers/app';
import { signWebhook, webhookBody } from '../helpers/app';
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

async function createOrder() {
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
  return res.body.orderId as string;
}

function postWebhook(body: string, signature: string | null = signWebhook(body)) {
  let req = request(app)
    .post('/api/v1/webhooks/payment/generic-hmac')
    .set('content-type', 'application/json');
  if (signature !== null) req = req.set('x-signature', signature);
  return req.send(body);
}

describe('payment webhook', () => {
  it('accepts a valid signed webhook and marks the order paid', async () => {
    const orderId = await createOrder();
    const body = webhookBody({ event_id: 'evt_1', order_id: orderId, amount: 20000, status: 'paid' });

    const res = await postWebhook(body);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const order = await prisma.order.findUnique({ where: { orderId } });
    expect(order!.paymentStatus).toBe('PAID');
    expect(order!.status).toBe('PAID');
    expect(order!.paidAt).toBeTruthy();

    // the raw event is stored, sanitised, and flagged processed
    const events = await prisma.webhookEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0]!.signatureValid).toBe(true);
    expect(events[0]!.processed).toBe(true);
    expect(events[0]!.externalId).toBe('evt_1');
  });

  it('rejects a webhook with an invalid signature (401) and does not mark it paid', async () => {
    const orderId = await createOrder();
    const body = webhookBody({ event_id: 'evt_bad', order_id: orderId, amount: 20000, status: 'paid' });

    const res = await postWebhook(body, 'sha256=deadbeef');
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);

    const order = await prisma.order.findUnique({ where: { orderId } });
    expect(order!.paymentStatus).toBe('PENDING');
    expect(order!.status).toBe('PENDING_PAYMENT');
  });

  it('rejects a webhook with a missing signature (401)', async () => {
    const orderId = await createOrder();
    const body = webhookBody({ event_id: 'evt_nosig', order_id: orderId, amount: 20000, status: 'paid' });
    const res = await postWebhook(body, null);
    expect(res.status).toBe(401);
  });

  it('rejects a webhook whose body was tampered with after signing (401)', async () => {
    const orderId = await createOrder();
    const signed = webhookBody({ event_id: 'evt_tamper', order_id: orderId, amount: 20000, status: 'paid' });
    const signature = signWebhook(signed);
    // change the amount but keep the old signature
    const tampered = webhookBody({ event_id: 'evt_tamper', order_id: orderId, amount: 1, status: 'paid' });
    const res = await postWebhook(tampered, signature);
    expect(res.status).toBe(401);
  });

  it('escalates to MANUAL_REVIEW on an amount mismatch (409)', async () => {
    const orderId = await createOrder();
    const body = webhookBody({ event_id: 'evt_amt', order_id: orderId, amount: 15000, status: 'paid' });

    const res = await postWebhook(body);
    expect(res.status).toBe(409);

    const order = await prisma.order.findUnique({ where: { orderId } });
    expect(order!.status).toBe('MANUAL_REVIEW');
    expect(order!.paymentStatus).toBe('PENDING'); // NOT marked paid
    expect(supplier.calls.order).toBe(0);
  });

  it('returns 404 for a validly-signed webhook referencing an unknown order', async () => {
    const body = webhookBody({ event_id: 'evt_unknown', order_id: 'HVY-261008-ZZZZZZ', amount: 20000, status: 'paid' });
    const res = await postWebhook(body);
    expect(res.status).toBe(404);
  });

  it('cancels a pending order on an expired payment event', async () => {
    const orderId = await createOrder();
    const body = webhookBody({ event_id: 'evt_exp', order_id: orderId, amount: 20000, status: 'expired' });
    const res = await postWebhook(body);
    expect(res.status).toBe(200);
    const order = await prisma.order.findUnique({ where: { orderId } });
    expect(order!.status).toBe('CANCELLED');
    expect(order!.paymentStatus).toBe('EXPIRED');
  });

  it('treats a duplicate webhook as idempotent and never creates a second top-up', async () => {
    const orderId = await createOrder();
    const body = webhookBody({ event_id: 'evt_dup', order_id: orderId, amount: 20000, status: 'paid' });

    // first delivery -> paid
    const first = await postWebhook(body);
    expect(first.status).toBe(200);
    expect(first.body.duplicate).toBeUndefined();

    // worker fulfils the order (exactly one supplier call)
    await processOrder(orderId);
    let order = await prisma.order.findUnique({ where: { orderId } });
    expect(order!.status).toBe('SUCCESS');
    expect(supplier.calls.order).toBe(1);

    // duplicate delivery of the SAME event -> ignored
    const second = await postWebhook(body);
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);

    // ...and a third time, to be sure
    const third = await postWebhook(body);
    expect(third.body.duplicate).toBe(true);

    // only one webhook row, still exactly one supplier transaction
    expect(await prisma.webhookEvent.count()).toBe(1);
    order = await prisma.order.findUnique({ where: { orderId } });
    expect(order!.status).toBe('SUCCESS');
    expect(supplier.calls.order).toBe(1);
    expect(await prisma.supplierTransaction.count({ where: { orderId: order!.id } })).toBe(1);
  });

  it('does not create a second top-up when a DIFFERENT event id re-reports the same paid order', async () => {
    const orderId = await createOrder();
    const body1 = webhookBody({ event_id: 'evt_a', order_id: orderId, amount: 20000, status: 'paid' });
    await postWebhook(body1);
    await processOrder(orderId);
    expect(supplier.calls.order).toBe(1);

    // A different gateway event id for the same order (gateways do this).
    const body2 = webhookBody({ event_id: 'evt_b', order_id: orderId, amount: 20000, status: 'paid' });
    const res = await postWebhook(body2);
    expect(res.status).toBe(200);

    const order = await prisma.order.findUnique({ where: { orderId } });
    expect(order!.status).toBe('SUCCESS');
    expect(supplier.calls.order).toBe(1); // markOrderPaid is idempotent on paymentStatus
    expect(await prisma.supplierTransaction.count({ where: { orderId: order!.id } })).toBe(1);
  });
});
