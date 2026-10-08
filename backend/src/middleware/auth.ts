// ============================================================
// Admin authentication (JWT in an httpOnly cookie) + RBAC.
//
// Roles:
//   admin    — full access (settings, refunds, user management)
//   operator — can advance orders / mark manual review
//   viewer   — read-only
// ============================================================
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env, isProd } from '../config/env';
import { prisma } from '../db/prisma';
import { forbidden, unauthorized } from '../lib/errors';
import { randomToken, safeEqual } from '../lib/crypto';

export type AdminRole = 'admin' | 'operator' | 'viewer';

export interface AdminClaims {
  sub: string;
  email: string;
  name: string;
  role: AdminRole;
}

declare module 'express-serve-static-core' {
  interface Request {
    admin?: AdminClaims;
  }
}

export function signAdminToken(claims: AdminClaims): string {
  return jwt.sign(claims, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

export function verifyAdminToken(token: string): AdminClaims | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === 'string') return null;
    return decoded as unknown as AdminClaims;
  } catch {
    return null;
  }
}

export async function verifyCredentials(email: string, password: string) {
  const user = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.status !== 'active') return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return user;
}

export function setAuthCookies(res: Response, token: string) {
  const csrf = randomToken(16);
  res.cookie(env.ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  });
  // CSRF double-submit token — readable by JS on purpose.
  res.cookie('hv_csrf', csrf, {
    httpOnly: false,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  });
  return { csrf };
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(env.ADMIN_COOKIE_NAME, { path: '/' });
  res.clearCookie('hv_csrf', { path: '/' });
}

function readToken(req: Request): string | null {
  const cookie = (req as Request & { cookies?: Record<string, string> }).cookies?.[env.ADMIN_COOKIE_NAME];
  if (cookie) return cookie;
  const header = req.get('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return null;
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) return next(unauthorized('Sesi admin tidak ditemukan. Silakan login.'));
  const claims = verifyAdminToken(token);
  if (!claims) return next(unauthorized('Sesi admin tidak valid atau kedaluwarsa.'));
  req.admin = claims;
  next();
}

export function requireRole(...roles: AdminRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.admin) return next(unauthorized());
    if (!roles.includes(req.admin.role)) return next(forbidden('Role Anda tidak memiliki akses untuk aksi ini.'));
    next();
  };
}

// ------------------------------------------------------------
// CSRF: double-submit cookie. State-changing admin requests must send
// an `x-csrf-token` header equal to the `hv_csrf` cookie.
// ------------------------------------------------------------
export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const cookie = (req as Request & { cookies?: Record<string, string> }).cookies?.['hv_csrf'];
  const header = req.get('x-csrf-token');
  if (!cookie || !header || !safeEqual(cookie, header)) {
    return next(forbidden('CSRF token tidak valid. Muat ulang halaman dan coba lagi.'));
  }
  next();
}
