// ============================================================
// Prisma client singleton.
// Prisma parameterises all queries -> SQL injection safe.
// ============================================================
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// In tests we deliberately trigger unique-constraint errors (idempotency
// paths) and catch them, so keep the client quiet to avoid noisy output.
const prismaLog: ('query' | 'info' | 'warn' | 'error')[] =
  env.NODE_ENV === 'test' ? [] : env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'];

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: prismaLog,
  });

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export type Db = PrismaClient;
