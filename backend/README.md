# HEAVYY TOP UP ID — Production Backend

Backend produksi untuk **HEAVYY TOP UP ID**: marketplace top-up game otomatis.
Setelah pembayaran **diverifikasi oleh payment gateway**, sistem **memproses
top-up ke supplier secara otomatis** (tanpa admin memproses manual).

Stack: **TypeScript · Node.js · Express · PostgreSQL · Prisma · Redis + BullMQ · Zod · Vitest**.

> Prinsip utama: **jangan pernah memproses top-up hanya karena halaman redirect
> pembayaran.** Sumber kebenaran pembayaran adalah **webhook yang tervalidasi
> signature-nya**, bukan redirect browser.

---

## 1. Arsitektur singkat

```
Customer ──► Frontend (Next.js/React)
                 │  POST /api/v1/orders            (harga dihitung SERVER-SIDE)
                 ▼
              Backend API (Express)  ──►  PostgreSQL (Prisma)
                 │  POST /api/v1/orders/:id/pay
                 ▼
        Payment Gateway  ──(webhook, signature)──►  POST /api/v1/webhooks/payment/:provider
                                                          │
                                        verifikasi signature + amount + merchant
                                                          │  idempotent (WebhookEvent unique)
                                                          ▼
                                                   Order = PAID
                                                          │  enqueue job (BullMQ)
                                                          ▼
                                              Worker (order-engine.processOrder)
                                                          │  lock (Redis) + idempotency
                                                          ▼
                                             Supplier API (Digiflazz / VIP / Custom)
                                                          │
                              SUCCESS │ PENDING_SUPPLIER │ FAILED │ UNKNOWN→retry→MANUAL_REVIEW
```

Komponen:

| Komponen | Peran |
| --- | --- |
| `src/routes/*` | REST API (catalog, orders, webhooks, admin, health, docs) |
| `src/services/order-service.ts` | State machine + pembuatan order + **harga server-side** |
| `src/services/order-engine.ts` | Eksekusi fulfillment, locking, idempotency, retry/backoff, rekonsiliasi |
| `src/services/webhook-service.ts` | Verifikasi + pemrosesan webhook pembayaran (idempoten) |
| `src/services/payment-service.ts` | Pembuatan charge ke payment gateway |
| `src/suppliers/*` | Abstraksi supplier (swappable) |
| `src/payments/*` | Abstraksi payment gateway (swappable) |
| `src/queue/*` + `src/worker.ts` | Antrean BullMQ + worker |
| `src/lib/*` | Crypto, sanitasi, order-id, idempotency, locks, money, validasi |

---

## 2. Siklus hidup order (state machine)

Status: `PENDING_PAYMENT → PAID → QUEUED → PROCESSING → SUCCESS`
dengan cabang `PENDING_SUPPLIER`, `FAILED`, `CANCELLED`, `REFUND_PENDING`,
`REFUNDED`, `MANUAL_REVIEW`.

```
PENDING_PAYMENT ─► PAID ─► QUEUED ─► PROCESSING ─► SUCCESS
      │              │         │           │
      │              │         │           ├─► PENDING_SUPPLIER ─► PROCESSING (reconcile)
      │              │         │           ├─► FAILED
      │              │         │           └─► MANUAL_REVIEW
      │              │         └─► CANCELLED / MANUAL_REVIEW
      │              ├─► REFUND_PENDING ─► REFUNDED
      └─► CANCELLED / FAILED / MANUAL_REVIEW
```

Transisi tidak sah ditolak (HTTP `409 Conflict`) oleh `assertTransition()`,
sehingga order tidak bisa "melompat" ke `SUCCESS` dari frontend.

**Status top-up supplier** disimpan terpisah (`topupStatus`: `success|pending|failed|unknown`).

---

## 3. Prasyarat

- Node.js ≥ 20.10
- PostgreSQL ≥ 15
- Redis ≥ 7
- (Opsional) Docker + Docker Compose

---

## 4. Setup lokal

```bash
cd backend
cp .env.example .env          # lalu isi kredensial (boleh dikosongkan = integrasi off)
npm install
npm run prisma:generate
npm run prisma:migrate        # prisma migrate deploy
npm run seed                  # kategori, game, produk, metode bayar, admin
```

Menjalankan:

```bash
npm run dev                   # API  (tsx watch, http://localhost:4000)
npm run dev:worker            # worker fulfillment (terminal terpisah)
```

Produksi:

```bash
npm run build                 # tsup -> dist/
npm start                     # node dist/index.js
npm run worker                # node dist/worker.js
```

---

## 5. Docker

```bash
docker compose up --build
```

`docker-compose.yml` menjalankan 4 service: **postgres**, **redis**, **api**, **worker**.
Service `api` otomatis menjalankan `prisma migrate deploy` sebelum start.

> Catatan: build image memerlukan Docker daemon. Pada sandbox pengembangan
> ini Docker tidak tersedia, jadi validasi yang dilakukan adalah validasi
> sintaks `docker-compose.yml` (YAML valid, 4 service) dan konsistensi
> `Dockerfile` (multi-stage: build → runtime, `prisma generate` di keduanya).

---

## 6. Referensi API

Base: `/api/v1`. Semua respons JSON. Error: `{ "error": { "code", "message", "details?" } }`.

### Catalog (publik)
| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/catalog/categories` | Daftar kategori |
| GET | `/catalog/games` | Daftar game (filter kategori, pencarian) |
| GET | `/catalog/games/:slug` | Detail game + produk + skema field akun |
| GET | `/catalog/payment-methods` | Metode pembayaran + `configStatus` |

### Orders (publik)
| Method | Path | Keterangan |
| --- | --- | --- |
| POST | `/orders` | Buat order. **Harga dihitung server-side** dari DB. Mendukung `idempotencyKey`. |
| POST | `/orders/check` | Lacak order (orderId + kontak opsional) |
| GET | `/orders/:orderId` | Detail order publik |
| POST | `/orders/:orderId/pay` | Buat charge ke payment gateway |
| POST | `/orders/:orderId/sandbox/confirm` | **Hanya dev/test** — simulasikan webhook sukses (rute sama dengan `markOrderPaid`) |
| POST | `/orders/:orderId/cancel` | Batalkan order yang belum dibayar |

### Webhooks
| Method | Path | Keterangan |
| --- | --- | --- |
| POST | `/webhooks/payment/:provider` | Webhook gateway (verifikasi signature + amount + merchant, idempoten) |
| POST | `/webhooks/payment` | Alias provider default |

### Admin (butuh auth + CSRF)
| Method | Path | Role | Keterangan |
| --- | --- | --- | --- |
| POST | `/admin/auth/login` | — | Login → set cookie `hv_admin` (httpOnly) + `hv_csrf` |
| POST | `/admin/auth/logout` | admin/operator/viewer | Logout |
| GET | `/admin/me` | semua | Profil admin |
| GET | `/admin/orders` | semua | Daftar order + filter |
| GET | `/admin/orders/:orderId` | semua | Detail order |
| POST | `/admin/orders/:orderId/status` | admin/operator | Ubah status (transisi divalidasi) |
| POST | `/admin/orders/:orderId/requeue` | admin/operator | Proses ulang manual |
| POST | `/admin/orders/:orderId/refund` | admin | Ajukan refund (hanya order PAID) |
| GET | `/admin/stats` | semua | Statistik order |
| GET | `/admin/suppliers` | semua | Status konfigurasi supplier |
| GET | `/admin/queue` | semua | Kesehatan antrean |

### Ops & docs
| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/healthz` | Liveness |
| GET | `/readyz` | Readiness (DB + Redis) |
| GET | `/api/v1/integrations` | Status integrasi (configured / not) |
| GET | `/openapi.json` | Spesifikasi OpenAPI |
| GET | `/docs` | Swagger UI |

---

## 7. Integrasi supplier (swappable)

`SupplierProvider` (interface) diimplementasikan oleh:

- **`DigiflazzProvider`** — `https://api.digiflazz.com/v1`, signature `md5(username + apiKey + refId)`, mode testing.
- **`VipResellerProvider`** — form-urlencoded, `sign = md5(apiKey + secret)`, endpoint `/game-feature`.
- **`CustomSupplierProvider`** — JSON + `Authorization: Bearer`, endpoint `/order`, `/status`, `/balance`.

Menambah supplier baru **tidak mengubah order engine** — cukup implement
interface dan daftarkan di `src/suppliers/index.ts`.

Setiap order memakai **`supplierRef` unik** (`<ORDERID>-<SUPPLIER>` uppercase)
sebagai idempotency key ke supplier.

---

## 8. Keamanan webhook

1. Simpan **raw event** (idempoten via `@@unique([provider, externalId])`).
2. Verifikasi **signature** (constant-time compare).
3. Verifikasi **amount** = `order.total`.
4. Verifikasi **merchant / order reference**.
5. Idempotensi: webhook duplikat **tidak** membuat top-up kedua.
6. Log aman: timestamp, transaction id, HTTP status, kode error — **tanpa** API key/secret (redacted).

---

## 9. Retry tanpa "blind retry"

- Timeout **tidak** langsung membuat transaksi baru.
- Sebelum retry: **cek status** ke endpoint inquiry supplier.
- **Exponential backoff** (`ORDER_RETRY_BASE_MS` × 2^n, dibatasi `ORDER_RETRY_MAX_MS`).
- Setelah `ORDER_MAX_RETRIES` → **`MANUAL_REVIEW`** (bukan retry buta).
- `sweepStuckOrders()` menangani order yang macet.

---

## 10. Keamanan

- Rate limiting per-rute (api/order/auth/webhook).
- Validasi **Zod** untuk body/query/params (unknown keys dibuang).
- Prisma → terlindung dari SQL injection.
- Auth admin: JWT di cookie **httpOnly** + **CSRF double-submit** (`hv_csrf` + header `x-csrf-token`).
- **RBAC**: `admin` / `operator` / `viewer`.
- Helmet (security headers), CORS allow-list, body limit 256kb.
- **Harga selalu dihitung server-side** — harga dari frontend tidak pernah dipercaya.
- `SUCCESS` hanya di-set dari respons supplier, **bukan** dari respons frontend.

---

## 11. Testing

```bash
npm run typecheck     # tsc --noEmit
npm test              # vitest run  (unit + integration)
```

- **Unit (67)**: crypto, money, order-id, sanitize, validation, state machine, supplier signatures.
- **Integration (41)**: siklus order penuh, webhook (signature/amount/idempotency), no-blind-retry, admin auth/RBAC/CSRF — memakai Postgres test + mock supplier HTTP.

Total: **108 test hijau**.

---

## 12. Variabel lingkungan

Lihat `.env.example`. Ringkas:

| Variabel | Fungsi |
| --- | --- |
| `DATABASE_URL` | Koneksi PostgreSQL |
| `REDIS_URL` | Redis (queue + lock) |
| `JWT_SECRET`, `COOKIE_SECRET` | Sesi admin |
| `PAYMENT_PROVIDER`, `PAYMENT_GATEWAY_KEY`, `PAYMENT_GATEWAY_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `PAYMENT_MERCHANT_ID` | Payment gateway |
| `DIGIFLAZZ_USERNAME`, `DIGIFLAZZ_API_KEY`, `DIGIFLAZZ_WEBHOOK_SECRET` | Supplier Digiflazz |
| `VIP_RESELLER_USERNAME`, `VIP_RESELLER_API_KEY`, `VIP_RESELLER_SECRET` | Supplier VIP Reseller |
| `CUSTOM_SUPPLIER_BASE_URL`, `CUSTOM_SUPPLIER_API_KEY` | Supplier custom |
| `SUPPLIER_DEFAULT` | Supplier default |
| `ORDER_MAX_RETRIES`, `ORDER_RETRY_BASE_MS`, `ORDER_RETRY_MAX_MS`, `ORDER_LOCK_TTL_MS` | Order engine |
| `RATE_LIMIT_*` | Rate limiting |
| `SANDBOX_ENABLED` | Mode uji (mati otomatis di produksi) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Seed admin |

**Tidak ada kredensial hard-coded.** Kredensial kosong = integrasi nonaktif
(API membalas error "belum dikonfigurasi" yang jujur).

---

## 13. Struktur proyek

```
backend/
├── prisma/
│   ├── schema.prisma          # model + enum
│   ├── migrations/            # SQL migrasi
│   └── seed.ts                # data awal
├── src/
│   ├── config/                # env (Zod), logger, redis
│   ├── db/prisma.ts
│   ├── lib/                   # crypto, sanitize, order-id, idempotency, locks, money, validation, http, errors
│   ├── middleware/            # request-id, error-handler, rate-limit, auth
│   ├── payments/              # midtrans, generic-hmac, factory
│   ├── suppliers/             # digiflazz, vip-reseller, custom, factory
│   ├── services/              # order-service, order-engine, webhook-service, payment-service
│   ├── queue/                 # BullMQ
│   ├── routes/                # catalog, orders, webhooks, admin, health, docs
│   ├── docs/openapi.ts
│   ├── app.ts                 # wiring Express
│   ├── index.ts               # entry API
│   └── worker.ts              # entry worker
├── tests/                     # unit + integration + helpers
├── Dockerfile
├── docker-compose.yml
└── .env.example
```
