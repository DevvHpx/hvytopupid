// ============================================================
// Test database helpers.
//   resetDb()       — wipe every table (dependency order).
//   seedTestData()  — insert a small, deterministic catalogue that
//                     mirrors the shape of the production seed.
// The suite runs against the dedicated `heavyy_test` database
// (see vitest.config.ts) so it never touches development data.
// ============================================================
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export const prisma = new PrismaClient();

/** Delete every row. Order matters only for readability (no FK cascade here). */
export async function resetDb(): Promise<void> {
  await prisma.orderEvent.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.supplierTransaction.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.game.deleteMany();
  await prisma.category.deleteMany();
  await prisma.paymentMethod.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.setting.deleteMany();
}

export interface SeededData {
  categoryId: string;
  gameId: string;
  productId: string;
  productSku: string;
  productPrice: number;
  sandboxCode: string;
  unconfiguredCode: string;
}

/**
 * Insert a minimal but realistic catalogue:
 *   - 1 category, 1 game (Mobile Legends) with a 2-field id schema
 *   - 3 products with known integer prices
 *   - 2 payment methods: a configured sandbox + an unconfigured QRIS
 *   - 3 admin users (admin / operator / viewer)
 */
export async function seedTestData(): Promise<SeededData> {
  const category = await prisma.category.create({
    data: { slug: 'moba', name: 'MOBA', emoji: '⚔️', sort: 1 },
  });

  const game = await prisma.game.create({
    data: {
      slug: 'mobile-legends',
      name: 'Mobile Legends: Bang Bang',
      publisher: 'Moonton',
      categoryId: category.id,
      status: 'active',
      popular: true,
      idFields: [
        { key: 'user_id', label: 'User ID', type: 'number', required: true },
        { key: 'zone_id', label: 'Zone ID', type: 'number', required: true },
      ],
    },
  });

  const product = await prisma.product.create({
    data: {
      gameId: game.id,
      sku: 'ml:86',
      name: '86 Diamonds',
      price: 20000,
      cost: 17600,
      supplier: 'custom',
      supplierSku: 'ml:86',
      status: 'active',
      sort: 1,
    },
  });
  await prisma.product.create({
    data: {
      gameId: game.id,
      sku: 'ml:172',
      name: '172 Diamonds',
      price: 40000,
      cost: 35200,
      supplier: 'custom',
      supplierSku: 'ml:172',
      status: 'active',
      sort: 2,
    },
  });

  await prisma.paymentMethod.create({
    data: { code: 'sandbox', name: 'Sandbox (Mode Uji)', type: 'sandbox', configStatus: 'configured', status: 'active', sort: 99 },
  });
  await prisma.paymentMethod.create({
    data: { code: 'qris', name: 'QRIS', type: 'qris', feePercent: 0.7, feeFixed: 0, configStatus: 'not_configured', status: 'active', sort: 1 },
  });

  const hash = await bcrypt.hash('TestPassword123!', 4);
  await prisma.adminUser.create({
    data: { email: 'admin@test.local', name: 'Admin', passwordHash: hash, role: 'admin', status: 'active' },
  });
  await prisma.adminUser.create({
    data: { email: 'operator@test.local', name: 'Operator', passwordHash: hash, role: 'operator', status: 'active' },
  });
  await prisma.adminUser.create({
    data: { email: 'viewer@test.local', name: 'Viewer', passwordHash: hash, role: 'viewer', status: 'active' },
  });

  return {
    categoryId: category.id,
    gameId: game.id,
    productId: product.id,
    productSku: product.sku,
    productPrice: product.price,
    sandboxCode: 'sandbox',
    unconfiguredCode: 'qris',
  };
}
