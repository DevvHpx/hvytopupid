// ============================================================
// Typed application errors.
// Every thrown AppError is serialised to a consistent JSON body
// by the central error handler. Internal details are never leaked
// to the client in production.
// ============================================================

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'UNPROCESSABLE'
  | 'NOT_CONFIGURED'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UNPROCESSABLE: 422,
  NOT_CONFIGURED: 503,
  UPSTREAM_ERROR: 502,
  INTERNAL: 500,
};

export interface AppErrorOptions {
  code?: ErrorCode;
  status?: number;
  details?: unknown;
  /** Safe to expose to the client. */
  expose?: boolean;
  cause?: unknown;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details?: unknown;
  public readonly expose: boolean;

  constructor(message: string, opts: AppErrorOptions = {}) {
    super(message);
    this.name = 'AppError';
    this.code = opts.code ?? 'INTERNAL';
    this.status = opts.status ?? STATUS_BY_CODE[this.code];
    this.details = opts.details;
    this.expose = opts.expose ?? this.status < 500;
    if (opts.cause) (this as { cause?: unknown }).cause = opts.cause;
    Error.captureStackTrace?.(this, AppError);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.expose ? this.message : 'Terjadi kesalahan pada server.',
        ...(this.expose && this.details ? { details: this.details } : {}),
      },
    };
  }
}

export const badRequest = (m: string, d?: unknown) =>
  new AppError(m, { code: 'BAD_REQUEST', details: d });
export const validationError = (m: string, d?: unknown) =>
  new AppError(m, { code: 'VALIDATION_ERROR', details: d });
export const unauthorized = (m = 'Autentikasi diperlukan.') =>
  new AppError(m, { code: 'UNAUTHORIZED' });
export const forbidden = (m = 'Akses ditolak.') => new AppError(m, { code: 'FORBIDDEN' });
export const notFound = (m = 'Sumber daya tidak ditemukan.') =>
  new AppError(m, { code: 'NOT_FOUND' });
export const conflict = (m: string, d?: unknown) =>
  new AppError(m, { code: 'CONFLICT', details: d });
export const notConfigured = (m: string) =>
  new AppError(m, { code: 'NOT_CONFIGURED', expose: true });
export const upstreamError = (m: string, d?: unknown) =>
  new AppError(m, { code: 'UPSTREAM_ERROR', details: d, expose: false });
export const internal = (m = 'Terjadi kesalahan pada server.', cause?: unknown) =>
  new AppError(m, { code: 'INTERNAL', expose: false, cause });

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
