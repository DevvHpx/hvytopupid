# HEAVYY TOP UP ID — Ringkasan Pengiriman Phase 2

Dokumen ini merangkum dua pekerjaan pada Phase 2:
**(A) Aset** — logo baru + icon game asli, dan
**(B) Backend produksi** — top-up otomatis setelah pembayaran terverifikasi.

---

## A. Aset (logo + icon game asli)

- **Logo** "HV" lama diganti dengan mark yang diunggah (chrome/metallic "H" + batu biru):
  - `public/img/brand/mark.png` (mark transparan)
  - `public/favicon.png`
  - `public/img/brand/og.png` (Open Graph)
  - Lockup header diperbarui (`src/views/layout.js`, `.brand-mark` / `.brand-text` di `public/css/styles.css`).
- **Icon & banner game asli** untuk **16 game** (PNG), bukan logo teks:
  - `public/img/games/*.png` (16 icon resmi)
  - `public/img/banners/*.png` (16 banner)
- File `.svg` placeholder lama dihapus.

Bukti visual: `01-homepage-logo.png`, `02-game-grid-real-icons.png`, `03-brand-mark.png`.

---

## B. Backend produksi (top-up otomatis)

Lokasi: `backend/`. Detail lengkap ada di `backend/README.md`.

### Alur otomatis (tanpa admin)
```
Order PENDING_PAYMENT
  → Payment Gateway
  → Webhook diterima  → verifikasi signature + amount + merchant + idempotency
  → Order PAID → masuk antrean (BullMQ)
  → Worker: lock order → pastikan transaksi supplier belum ada → panggil Supplier API
  → SUCCESS | PENDING_SUPPLIER | FAILED | (UNKNOWN → retry → MANUAL_REVIEW)
```
> Top-up **tidak pernah** diproses hanya karena halaman redirect pembayaran.
> Sumber kebenaran = webhook yang tervalidasi.

### Fitur kunci
- **Order engine**: state machine (11 status), distributed lock Redis, idempotency, **no blind retry** (cek status dulu sebelum retry), exponential backoff, eskalasi `MANUAL_REVIEW`, sweeper order macet.
- **Webhook aman**: verifikasi signature (constant-time), amount, merchant; penyimpanan raw event idempoten (`@@unique([provider, externalId])`); webhook duplikat tidak membuat top-up kedua; logging tersanitasi (tanpa API key/secret).
- **Abstraksi supplier**: `DigiflazzProvider`, `VipResellerProvider`, `CustomSupplierProvider` — bisa ditukar tanpa mengubah order engine. `supplierRef` unik per order.
- **Abstraksi payment**: Midtrans + generic-HMAC.
- **Keamanan**: rate limiting, validasi Zod (body/query/params), admin JWT httpOnly + CSRF double-submit + RBAC (admin/operator/viewer), helmet, CORS allow-list, body limit, **harga dihitung server-side** (harga frontend tidak dipercaya).
- **API**: catalog, orders, webhooks, admin, health, OpenAPI + Swagger UI.
- **Data**: Prisma schema + migrasi + seed (6 kategori, 16 game, 81 produk, 13 metode bayar, admin).
- **Docker**: `Dockerfile` multi-stage + `docker-compose.yml` (postgres, redis, api, worker).
- **Tes**: **108 hijau** (67 unit + 41 integrasi).

### Perbaikan bug yang ditemukan saat pengujian
1. Validasi `params` memakai schema string terhadap objek `req.params` → ditambahkan `orderIdParamSchema` (objek).
2. BullMQ melarang `:` pada custom `jobId` → separator diganti `__`.
3. Order `PENDING_SUPPLIER` tidak men-set `nextRetryAt` → diperbaiki.
4. Route refund bisa direfund walau belum dibayar → ditambah guard (hanya order `PAID`).

---

## C. Pengiriman (GitHub)
- Branch: `feat/heavyy-topup-platform`
- PR: https://github.com/DevvHpx/hvytopupid/pull/1
- Commit Phase 2: `a77cbde` — "feat(phase2): real game assets + production backend (auto top-up fulfillment)"

---

## D. Catatan penting
- **Tidak ada kredensial hard-coded.** Kredensial kosong = integrasi nonaktif (API membalas error "belum dikonfigurasi" yang jujur).
- Docker daemon tidak tersedia di sandbox; validasi = sintaks `docker-compose.yml` (YAML valid, 4 service) + konsistensi `Dockerfile`.
- Mode sandbox (`SANDBOX_ENABLED`) hanya untuk dev/test, mati otomatis di produksi.
