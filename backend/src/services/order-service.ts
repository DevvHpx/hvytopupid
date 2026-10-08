// ============================================================
// Order service — creation, pricing and state transitions.
//
// SECURITY: prices are ALWAYS read from the database. Any price sent
// by the client is ignored. The order stores an immutable pricing
// snapshot so a later catalogue change cannot alter a live order.
// ============================================================
import { Prisma, OrderStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import { badRequest, conflict, notFound } from '../lib/errors';
import { computeAdminFee, toInt } from '../lib/money';
import { makeOrderId } from '../lib/order-id';
import { deriveIdempotencyKey } from '../lib/idempotency';
import type { CreateOrderInput } from '../lib/validation';

// ------------------------------------------------------------
// State machine
// ------------------------------------------------------------
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED', 'FAILED', 'MANUAL_REVIEW'],
  PAID: ['QUEUED', 'CANCELLED', 'REFUND_PENDING', 'MANUAL_REVIEW'],
  QUEUED: ['PROCESSING', 'CANCELLED', 'MANUAL_REVIEW'],
  PROCESSING: ['SUCCESS', 'PENDING_SUPPLIER', 'FAILED', 'MANUAL_REVIEW'],
  PENDING_SUPPLIER: ['PROCESSING', 'SUCCESS', 'FAILED', 'MANUAL_REVIEW'],
  FAILED: ['REFUND_PENDING', 'MANUAL_REVIEW', 'QUEUED'],
  REFUND_PENDING: ['REFUNDED', 'MANUAL_REVIEW', 'FAILED'],
  REFUNDED: [],
  SUCCESS: [],
  CANCELLED: [],
  MANUAL_REVIEW: ['QUEUED', 'SUCCESS', 'FAILED', 'REFUND_PENDING', 'CANCELLED'],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw conflict(`Transisi status tidak valid: ${from} → ${to}.`);
  }
}

// ------------------------------------------------------------
// Account-field validation (against the game's idFields schema)
// ------------------------------------------------------------
interface IdField {
  key: string;
  label: string;
  required?: boolean;
  type?: 'text' | 'number' | 'select';
  options?: string[];
}

export function validateAccountFields(idFields: unknown, fields: Record<string, string>) {
  const schema = Array.isArray(idFields) ? (idFields as IdField[]) : [];
  const errors: Record<string, string> = {};
  const clean: Record<string, string> = {};

  for (const f of schema) {
    const raw = fields[f.key];
    const val = raw === undefined || raw === null ? '' : String(raw).trim();
    clean[f.key] = val;
    if (f.required && !val) {
      errors[f.key] = `${f.label} wajib diisi.`;
      continue;
    }
    if (!val) continue;
    if (f.type === 'number' && !/^[0-9]{1,20}$/.test(val)) errors[f.key] = `${f.label} hanya boleh angka.`;
    else if (f.type === 'text' && val.length < 3) errors[f.key] = `${f.label} minimal 3 karakter.`;
    else if (f.type === 'select' && Array.isArray(f.options) && !f.options.includes(val))
      errors[f.key] = `Pilihan ${f.label} tidak valid.`;
  }
  return { errors, clean };
}

/** Compose the supplier-facing customer number from the account fields. */
export function composeCustomerNo(idFields: unknown, fields: Record<string, string>): string {
  const schema = Array.isArray(idFields) ? (idFields as IdField[]) : [];
  const keys = schema.map((f) => f.key).filter((k) => fields[k]);
  if (keys.length === 0) return Object.values(fields).join('');
  return keys.map((k) => fields[k]).join('');
}

// ------------------------------------------------------------
// Pricing
// ------------------------------------------------------------
export interface PricingSnapshot {
  productName: string;
  productSku: string;
  price: number;
  adminFee: number;
  total: number;
  currency: string;
}

export function computePricing(
  product: { name: string; sku: string; price: number },
  method: { feePercent: number; feeFixed: number } | null,
): PricingSnapshot {
  const price = toInt(product.price);
  const adminFee = computeAdminFee(price, method);
  return {
    productName: product.name,
    productSku: product.sku,
    price,
    adminFee,
    total: price + adminFee,
    currency: 'IDR',
  };
}

// ------------------------------------------------------------
// Events
// ------------------------------------------------------------
type Tx = Prisma.TransactionClient;

export async function appendEvent(
  tx: Tx,
  orderId: string,
  type: string,
  message: string,
  meta?: Prisma.InputJsonValue,
) {
  return tx.orderEvent.create({ data: { orderId, type, message, meta: meta ?? Prisma.JsonNull } });
}

// ------------------------------------------------------------
// Create order
// ------------------------------------------------------------
export async function createOrder(input: CreateOrderInput) {
  const game = await prisma.game.findUnique({
    where: { slug: input.slug },
    include: { products: false },
  });
  if (!game) throw notFound('Game tidak ditemukan.');
  if (game.status !== 'active') throw badRequest('Game sedang tidak tersedia.');

  const product = await prisma.product.findFirst({
    where: { id: input.productId, gameId: game.id },
  });
  if (!product) throw badRequest('Produk tidak valid untuk game ini.');
  if (product.status !== 'active') throw badRequest('Produk sedang tidak tersedia.');

  const method = await prisma.paymentMethod.findUnique({ where: { code: input.paymentCode } });
  if (!method) throw badRequest('Metode pembayaran tidak valid.');
  if (method.status !== 'active') throw badRequest('Metode pembayaran sedang tidak tersedia.');
  if (method.configStatus !== 'configured') {
    throw badRequest('Metode pembayaran ini belum dikonfigurasi. Pilih metode lain.');
  }

  const { errors, clean } = validateAccountFields(game.idFields, input.fields);
  if (Object.keys(errors).length) {
    throw badRequest('Data akun belum lengkap.', errors);
  }

  const pricing = computePricing(product, method);

  const idempotencyKey = input.idempotencyKey
    ? deriveIdempotencyKey([input.slug, input.productId, input.paymentCode, input.idempotencyKey])
    : null;

  if (idempotencyKey) {
    const existing = await prisma.order.findUnique({ where: { idempotencyKey } });
    if (existing) return { order: existing, idempotent: true };
  }

  const orderId = makeOrderId();

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderId,
        idempotencyKey,
        gameId: game.id,
        productId: product.id,
        productName: pricing.productName,
        productSku: pricing.productSku,
        price: pricing.price,
        adminFee: pricing.adminFee,
        total: pricing.total,
        currency: pricing.currency,
        accountFields: clean,
        contactEmail: input.email || null,
        contactPhone: input.whatsapp || null,
        paymentCode: method.code,
        paymentStatus: PaymentStatus.PENDING,
        status: OrderStatus.PENDING_PAYMENT,
        supplier: product.supplier,
      },
    });
    await appendEvent(tx, created.id, 'ORDER_CREATED', 'Pesanan dibuat. Menunggu pembayaran.', {
      game: game.slug,
      product: product.sku,
      total: pricing.total,
    });
    return created;
  });

  return { order, idempotent: false };
}

// ------------------------------------------------------------
// Reads
// ------------------------------------------------------------
export async function getOrderByPublicId(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { orderId: orderId.toUpperCase() },
    include: { events: { orderBy: { createdAt: 'asc' } } },
  });
  if (!order) throw notFound('Pesanan tidak ditemukan.');
  return order;
}

export async function findOrderByPublicId(orderId: string) {
  return prisma.order.findUnique({ where: { orderId: orderId.toUpperCase() } });
}

export async function listOrders(opts: { status?: OrderStatus; limit?: number; cursor?: string } = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  return prisma.order.findMany({
    where: opts.status ? { status: opts.status } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
  });
}

export async function orderStats() {
  const [total, success, pendingPayment, processing, failed, manualReview, revenueAgg] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: OrderStatus.SUCCESS } }),
    prisma.order.count({ where: { status: OrderStatus.PENDING_PAYMENT } }),
    prisma.order.count({ where: { status: { in: [OrderStatus.QUEUED, OrderStatus.PROCESSING, OrderStatus.PENDING_SUPPLIER] } } }),
    prisma.order.count({ where: { status: OrderStatus.FAILED } }),
    prisma.order.count({ where: { status: OrderStatus.MANUAL_REVIEW } }),
    prisma.order.aggregate({ _sum: { total: true }, where: { status: OrderStatus.SUCCESS } }),
  ]);
  return {
    total,
    success,
    pendingPayment,
    processing,
    failed,
    manualReview,
    revenue: revenueAgg._sum.total ?? 0,
  };
}
