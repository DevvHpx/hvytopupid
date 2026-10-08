// ============================================================
// Express application wiring.
// ============================================================
import express, { type Request, type RequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env, corsOrigins, isProd } from './config/env';
import { logger } from './config/logger';
import { requestId } from './middleware/request-id';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { health } from './routes/health';
import { catalog } from './routes/catalog';
import { orders } from './routes/orders';
import { webhooks } from './routes/webhooks';
import { admin } from './routes/admin';
import { docs } from './routes/docs';

// Some third-party middleware ship their own (node:http-based) handler
// types that do not structurally match Express's RequestHandler under
// strictFunctionTypes. Casting here keeps the rest of the app fully typed.
const asHandler = (fn: unknown): RequestHandler => fn as RequestHandler;

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // ---------- security headers ----------
  const securityHeaders = helmet({
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://unpkg.com'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            frameAncestors: ["'none'"],
          },
        }
      : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  app.use(asHandler(securityHeaders));

  // ---------- CORS ----------
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        if (corsOrigins.length === 0) return cb(null, true); // dev default
        return cb(null, corsOrigins.includes(origin));
      },
      credentials: true,
    }),
  );

  app.use(cookieParser(env.COOKIE_SECRET));

  // ---------- body parsing (capture raw body for webhook signatures) ----------
  app.use(
    asHandler(
      express.json({
        limit: '256kb',
        verify: (req, _res, buf) => {
          (req as Request & { rawBody?: string }).rawBody = buf.toString('utf8');
        },
      }),
    ),
  );
  app.use(asHandler(express.urlencoded({ extended: false, limit: '256kb' })));

  // ---------- observability ----------
  app.use(requestId);
  app.use(
    asHandler(
      pinoHttp({
        logger,
        genReqId: (req) => (req as Request).id ?? '',
        autoLogging: { ignore: (req) => req.url === '/healthz' || req.url === '/readyz' },
      }),
    ),
  );

  // ---------- routes ----------
  app.use('/', health);
  app.use('/', docs);
  app.use('/api/v1/catalog', catalog);
  app.use('/api/v1/orders', orders);
  app.use('/api/v1/webhooks', webhooks);
  app.use('/api/v1/admin', admin);

  // ---------- fallthrough ----------
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
