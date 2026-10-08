// ============================================================
// Attach a request id to every request/response for tracing.
// ============================================================
import type { NextFunction, Request, Response } from 'express';
import { randomToken } from '../lib/crypto';

declare module 'express-serve-static-core' {
  interface Request {
    id?: string;
  }
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.get('x-request-id');
  const id = incoming && incoming.length <= 100 ? incoming : randomToken(12);
  req.id = id;
  res.setHeader('x-request-id', id);
  next();
}
