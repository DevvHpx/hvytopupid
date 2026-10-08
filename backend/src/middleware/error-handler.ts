// ============================================================
// Central error handler.
// AppErrors are serialised with their code/status; everything else
// becomes a generic 500 so internal details never leak.
// ============================================================
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, isAppError } from '../lib/errors';
import { logger } from '../config/logger';
import { isProd } from '../config/env';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} tidak ditemukan.` },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid.', details: err.flatten().fieldErrors },
    });
    return;
  }

  if (isAppError(err)) {
    const appErr = err as AppError;
    if (appErr.status >= 500) {
      logger.error({ reqId: req.id, code: appErr.code, err: appErr.message }, 'request failed');
    } else {
      logger.warn({ reqId: req.id, code: appErr.code, err: appErr.message }, 'request rejected');
    }
    res.status(appErr.status).json(appErr.toJSON());
    return;
  }

  const message = err instanceof Error ? err.message : 'unknown error';
  logger.error({ reqId: req.id, err: message, stack: err instanceof Error ? err.stack : undefined }, 'unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: 'Terjadi kesalahan pada server.',
      ...(isProd ? {} : { debug: message }),
    },
  });
}
