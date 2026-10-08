// ============================================================
// Public catalogue API (games, products, payment methods).
// All reads come from the database — nothing is hard-coded.
// ============================================================
import { Router } from 'express';
import { prisma } from '../db/prisma';
import { asyncHandler } from '../lib/async-handler';
import { notFound } from '../lib/errors';
import { apiLimiter } from '../middleware/rate-limit';

export const catalog = Router();

catalog.use(apiLimiter);

catalog.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: { sort: 'asc' },
      include: { _count: { select: { games: true } } },
    });
    res.json({
      ok: true,
      categories: categories.map((c) => ({ slug: c.slug, name: c.name, emoji: c.emoji, count: c._count.games })),
    });
  }),
);

catalog.get(
  '/games',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    const category = String(req.query.category ?? '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);

    const games = await prisma.game.findMany({
      where: {
        status: 'active',
        ...(category ? { category: { slug: category } } : {}),
        ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { publisher: { contains: q, mode: 'insensitive' } }] } : {}),
      },
      orderBy: [{ popular: 'desc' }, { name: 'asc' }],
      take: limit,
      include: { category: { select: { slug: true, name: true } }, _count: { select: { products: true } } },
    });

    res.json({
      ok: true,
      games: games.map((g) => ({
        slug: g.slug,
        name: g.name,
        publisher: g.publisher,
        logo: g.logoUrl,
        banner: g.bannerUrl,
        popular: g.popular,
        category: g.category,
        productCount: g._count.products,
      })),
    });
  }),
);

catalog.get(
  '/games/:slug',
  asyncHandler(async (req, res) => {
    const game = await prisma.game.findUnique({
      where: { slug: req.params.slug! },
      include: {
        category: { select: { slug: true, name: true } },
        products: { where: { status: 'active' }, orderBy: { sort: 'asc' } },
      },
    });
    if (!game || game.status !== 'active') throw notFound('Game tidak ditemukan.');

    res.json({
      ok: true,
      game: {
        slug: game.slug,
        name: game.name,
        publisher: game.publisher,
        logo: game.logoUrl,
        banner: game.bannerUrl,
        idFields: game.idFields,
        category: game.category,
        products: game.products.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          price: p.price,
          badge: p.badge,
        })),
      },
    });
  }),
);

catalog.get(
  '/payment-methods',
  asyncHandler(async (_req, res) => {
    const methods = await prisma.paymentMethod.findMany({
      where: { status: 'active' },
      orderBy: { sort: 'asc' },
    });
    res.json({
      ok: true,
      methods: methods.map((m) => ({
        code: m.code,
        name: m.name,
        type: m.type,
        feePercent: m.feePercent,
        feeFixed: m.feeFixed,
        configured: m.configStatus === 'configured',
      })),
    });
  }),
);
