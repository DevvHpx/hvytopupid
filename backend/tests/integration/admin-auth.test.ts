// ============================================================
// Integration tests — admin authentication, RBAC and CSRF.
// ============================================================
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../helpers/app';
import { prisma, resetDb, seedTestData, type SeededData } from '../helpers/db';
import { startMockSupplier, type MockSupplier } from '../helpers/mock-supplier';
import { closeAll } from '../helpers/teardown';
import { redis } from '../../src/config/redis';

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
});

async function loginAs(email: string): Promise<{ agent: ReturnType<typeof request.agent>; csrf: string }> {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/v1/admin/auth/login')
    .send({ email, password: 'TestPassword123!' })
    .expect(200);
  return { agent, csrf: res.body.csrfToken as string };
}

async function createOrder(): Promise<string> {
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

/** Mark an order as paid via the sandbox confirm endpoint (test-only). */
async function payOrder(orderId: string): Promise<void> {
  await request(app).post(`/api/v1/orders/${orderId}/sandbox/confirm`).send({}).expect(200);
}

describe('admin authentication', () => {
  it('logs in with valid credentials and sets auth + csrf cookies', async () => {
    const res = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin@test.local', password: 'TestPassword123!' })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.admin.role).toBe('admin');
    expect(res.body.csrfToken).toBeTruthy();

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('hv_admin='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('hv_csrf='))).toBe(true);
    // the session cookie must be httpOnly
    expect(cookies.find((c) => c.startsWith('hv_admin='))).toMatch(/HttpOnly/i);
  });

  it('rejects invalid credentials (401)', async () => {
    await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin@test.local', password: 'WrongPassword1' })
      .expect(401);
  });

  it('rejects a malformed login payload (422)', async () => {
    await request(app).post('/api/v1/admin/auth/login').send({ email: 'nope', password: 'x' }).expect(422);
  });

  it('protects admin routes when unauthenticated (401)', async () => {
    await request(app).get('/api/v1/admin/me').expect(401);
    await request(app).get('/api/v1/admin/orders').expect(401);
    await request(app).get('/api/v1/admin/stats').expect(401);
  });

  it('returns the current admin for an authenticated session', async () => {
    const { agent } = await loginAs('admin@test.local');
    const res = await agent.get('/api/v1/admin/me').expect(200);
    expect(res.body.admin.email).toBe('admin@test.local');
    expect(res.body.admin.role).toBe('admin');
  });

  it('clears cookies on logout', async () => {
    const { agent, csrf } = await loginAs('admin@test.local');
    await agent.post('/api/v1/admin/auth/logout').set('x-csrf-token', csrf).expect(200);
    await agent.get('/api/v1/admin/me').expect(401);
  });
});

describe('CSRF protection', () => {
  it('rejects a mutating admin request without the csrf header (403)', async () => {
    const orderId = await createOrder();
    const { agent } = await loginAs('admin@test.local');
    await agent
      .post(`/api/v1/admin/orders/${orderId}/status`)
      .send({ status: 'QUEUED' })
      .expect(403);
  });

  it('rejects a mutating admin request with a wrong csrf header (403)', async () => {
    const orderId = await createOrder();
    const { agent } = await loginAs('admin@test.local');
    await agent
      .post(`/api/v1/admin/orders/${orderId}/status`)
      .set('x-csrf-token', 'not-the-token')
      .send({ status: 'QUEUED' })
      .expect(403);
  });

  it('allows a mutating request with a valid csrf header', async () => {
    const orderId = await createOrder();
    const { agent, csrf } = await loginAs('admin@test.local');
    const res = await agent
      .post(`/api/v1/admin/orders/${orderId}/status`)
      .set('x-csrf-token', csrf)
      .send({ status: 'MANUAL_REVIEW', message: 'manual check' })
      .expect(200);
    expect(res.body.order.status).toBe('MANUAL_REVIEW');
  });
});

describe('role-based access control', () => {
  it('blocks a viewer from refunding an order (403)', async () => {
    const orderId = await createOrder();
    const { agent, csrf } = await loginAs('viewer@test.local');
    await agent
      .post(`/api/v1/admin/orders/${orderId}/refund`)
      .set('x-csrf-token', csrf)
      .send({ reason: 'trying my luck' })
      .expect(403);
  });

  it('blocks an operator from refunding an order (403)', async () => {
    const orderId = await createOrder();
    const { agent, csrf } = await loginAs('operator@test.local');
    await agent
      .post(`/api/v1/admin/orders/${orderId}/refund`)
      .set('x-csrf-token', csrf)
      .send({ reason: 'operator attempt' })
      .expect(403);
  });

  it('lets an admin request a refund (200)', async () => {
    const orderId = await createOrder();
    await payOrder(orderId);
    const { agent, csrf } = await loginAs('admin@test.local');
    const res = await agent
      .post(`/api/v1/admin/orders/${orderId}/refund`)
      .set('x-csrf-token', csrf)
      .send({ reason: 'customer requested refund' })
      .expect(200);
    expect(res.body.order.status).toBe('REFUND_PENDING');
  });

  it('lets an operator advance an order status (200)', async () => {
    const orderId = await createOrder();
    const { agent, csrf } = await loginAs('operator@test.local');
    await agent
      .post(`/api/v1/admin/orders/${orderId}/status`)
      .set('x-csrf-token', csrf)
      .send({ status: 'MANUAL_REVIEW' })
      .expect(200);
  });

  it('lets a viewer read orders and stats (200)', async () => {
    await createOrder();
    const { agent } = await loginAs('viewer@test.local');
    await agent.get('/api/v1/admin/orders').expect(200);
    await agent.get('/api/v1/admin/stats').expect(200);
    await agent.get('/api/v1/admin/suppliers').expect(200);
  });

  it('writes an audit log entry for a privileged action', async () => {
    const orderId = await createOrder();
    const { agent, csrf } = await loginAs('admin@test.local');
    await agent
      .post(`/api/v1/admin/orders/${orderId}/status`)
      .set('x-csrf-token', csrf)
      .send({ status: 'MANUAL_REVIEW' })
      .expect(200);
    const logs = await prisma.auditLog.findMany({ where: { action: 'order.status' } });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0]!.actor).toBe('admin@test.local');
  });
});
