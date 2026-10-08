// ============================================================
// HEAVYY TOP UP ID — application server
// ============================================================
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { migrate, DB_PATH } from './src/db/index.js';
import { pages } from './src/routes/pages.js';
import { api } from './src/routes/api.js';
import { integrationStatus } from './src/providers/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

migrate();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Security headers (no external deps).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

// Static assets with sensible caching.
app.use(express.static(join(__dirname, 'public'), {
  maxAge: '7d',
  setHeaders(res, path) {
    if (/\.(svg|png|jpg|jpeg|webp|css|js)$/.test(path)) res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  },
}));

// Health check.
app.get('/healthz', (req, res) => {
  res.json({ ok: true, service: 'hvytopupid', integrations: integrationStatus() });
});

app.use('/api', api);
app.use('/', pages);

// Error handler.
app.use((err, req, res, next) => {
  console.error(err);
  if (req.path.startsWith('/api')) return res.status(500).json({ ok: false, error: 'Terjadi kesalahan pada server.' });
  res.status(500).type('html').send('<h1>500 — Terjadi kesalahan</h1><p><a href="/">Kembali ke Home</a></p>');
});

app.listen(PORT, () => {
  const st = integrationStatus();
  console.log(`\n  HEAVYY TOP UP ID`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  DB: ${DB_PATH}`);
  console.log(`  Integrations: payment=${st.payment_gateway}, supplier=${st.supplier_api}, id_validation=${st.id_validation}, sandbox=${st.sandbox_enabled}\n`);
});
