// ============================================================
// Zod request schemas + a validation middleware.
// Every request body / query / param is validated before it reaches
// a handler. Unknown keys are stripped (mass-assignment protection).
// ============================================================
import { z } from 'zod';
import type { NextFunction, Request, Response } from 'express';
import { validationError } from './errors';

// ---------- primitives ----------
export const emailSchema = z.string().trim().email('Format email tidak valid.').max(160);
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(\+?62|0)8[1-9][0-9]{6,11}$/, 'Format nomor WhatsApp tidak valid.');

export const orderIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^HVY-\d{6}-[A-Z0-9]{6}$/, 'Format Order ID tidak valid.');

// Route params are always objects in Express, so a `validate(..., 'params')`
// call needs an object schema wrapping the individual param.
export const orderIdParamSchema = z.object({ orderId: orderIdSchema });

// ---------- create order ----------
export const createOrderSchema = z.object({
  slug: z.string().trim().min(1, 'Game wajib dipilih.').max(80),
  productId: z.string().trim().min(1, 'Produk wajib dipilih.').max(80),
  fields: z.record(z.string().trim().max(120)).default({}),
  email: z.union([emailSchema, z.literal('')]).optional().default(''),
  whatsapp: z.union([phoneSchema, z.literal('')]).optional().default(''),
  paymentCode: z.string().trim().min(1, 'Metode pembayaran wajib dipilih.').max(60),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

// ---------- pay / charge ----------
export const payOrderSchema = z.object({
  email: z.union([emailSchema, z.literal('')]).optional().default(''),
  whatsapp: z.union([phoneSchema, z.literal('')]).optional().default(''),
});

// ---------- check order ----------
export const checkOrderSchema = z.object({
  orderId: orderIdSchema,
  contact: z.string().trim().max(160).optional().default(''),
});

// ---------- admin auth ----------
export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password minimal 8 karakter.').max(200),
});

export const adminOrderStatusSchema = z.object({
  status: z.enum([
    'PAID',
    'QUEUED',
    'PROCESSING',
    'PENDING_SUPPLIER',
    'SUCCESS',
    'FAILED',
    'CANCELLED',
    'REFUND_PENDING',
    'REFUNDED',
    'MANUAL_REVIEW',
  ]),
  message: z.string().trim().max(300).optional().default(''),
});

export const adminRefundSchema = z.object({
  reason: z.string().trim().min(3).max(300),
});

// ---------- helpers ----------
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

type Source = 'body' | 'query' | 'params';

/**
 * Validate one part of the request and replace it with the parsed value.
 * Throws a 422 AppError with field-level details on failure.
 */
export function validate(schema: z.ZodTypeAny, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      return next(
        validationError('Data yang dikirim tidak valid.', parsed.error.flatten().fieldErrors),
      );
    }
    // Express 4 allows reassigning these containers.
    if (source === 'body') req.body = parsed.data;
    else if (source === 'query') Object.assign(req.query, parsed.data);
    else Object.assign(req.params, parsed.data);
    next();
  };
}
