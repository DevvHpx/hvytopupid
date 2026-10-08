# HEAVYY TOP UP ID

**Top Up Aman · Tercepat · Terpercaya di Indonesia**

Platform top-up game otomatis dengan pengalaman yang cepat, sederhana, responsif, dan
profesional. Dibangun sebagai aplikasi server-rendered (SSR) yang ringan dengan
progressive enhancement — tanpa framework berat di sisi klien.

> Identitas visual: dominan **silver / putih / abu premium** dengan aksen metalik halus
> dan latar gelap. Semua aset (logo, badge game, banner) adalah **SVG orisinal** yang
> dibuat sendiri, bebas dari elemen berhak cipta pihak lain.

---

## ✨ Fitur Utama

| Halaman | Rute | Deskripsi |
| --- | --- | --- |
| Home | `/` | Hero premium, pencarian game, kategori, game populer, produk digital, promo, keunggulan, FAQ, footer |
| Katalog Game | `/game` | Seluruh game dari database, filter kategori & pencarian |
| Detail / Top Up | `/game/:slug` | Instruksi, field ID dinamis (User ID, Zone/Server), pilih nominal, ringkasan otomatis, metode bayar |
| Checkout | `/checkout/:orderId` | Rincian pesanan, biaya admin, total, metode bayar, kontak opsional, tombol Bayar |
| Status Pembayaran | `/order/:orderId` | Status real-time (polling 4 detik), timeline, aksi bayar/batal |
| Cek Pesanan | `/cek-pesanan` | Lacak pesanan via Order ID (+ kontak bila diisi) |
| Promo | `/promo` | Daftar promo aktif dari database |
| Bantuan & FAQ | `/bantuan` | FAQ, kanal bantuan, alur top-up |

### Alur status pesanan (state machine)

```
pending_payment → paid → processing → success
                     ↘         ↘
                    failed   cancelled / refund
```

Status yang didukung: **Menunggu Pembayaran, Pembayaran Berhasil, Memproses Top-Up,
Top-Up Berhasil, Top-Up Gagal, Dibatalkan, Refund / Perlu Penanganan.**

---

## 🧭 Prinsip Kejujuran (tanpa fitur palsu)

Sesuai permintaan, **tidak ada tombol atau fitur palsu**. Setiap integrasi eksternal
memiliki status jujur **"Belum dikonfigurasi"** sampai kredensial asli diisi:

- **Metode pembayaran** — hanya yang `configured` yang dapat dipakai. Sisanya tampil
  dengan label "Belum dikonfigurasi".
- **Validasi ID otomatis** — menampilkan pesan jujur bila API belum diatur; tidak pernah
  mengarang nickname akun.
- **Supplier top-up** — bila belum dikonfigurasi, pesanan masuk antrean pemrosesan
  manual dan dicatat pada timeline (tidak mengklaim sukses palsu).
- **Mode Sandbox** — tersedia khusus untuk menguji alur end-to-end secara jujur
  (ditandai jelas sebagai sandbox, bukan produksi).

---

## 🏗️ Arsitektur

```
server.js                     Express app, security headers, static, health check
src/
  db/
    schema.sql                Skema SQLite (games, products, orders, events, ...)
    index.js                  Koneksi + migrasi (node:sqlite, WAL, FK)
    seed.js                   Data awal (16 game, 81 produk, 13 metode bayar, ...)
  providers/index.js          Batas integrasi: payment, id validation, supplier
  services/
    catalog.js                Query katalog (kategori, game, produk, promo, faq)
    orders.js                 State machine pesanan, fee, validasi, event log
  routes/
    pages.js                  Rute SSR (HTML)
    api.js                    JSON API (search, validate-id, orders, webhook, admin)
  views/
    layout.js                 Shell HTML + navbar/footer/SEO meta
    components.js             Komponen (game card, status pill, timeline, steps)
    pages/*.js                Tiap halaman
  utils/                      Helper (rupiah, order id, tanggal WIB, esc)
public/
  css/styles.css              Design system (token silver/metalik, mobile-first)
  js/*.js                     Progressive enhancement (tanpa framework)
  img/                        Logo, badge game, banner (SVG orisinal)
scripts/gen-assets.mjs        Generator aset SVG
```

### Teknologi

- **Node.js ≥ 22.5** (memakai modul bawaan `node:sqlite` — tanpa kompilasi native)
- **Express 4** (satu-satunya dependensi runtime)
- **SQLite** dengan WAL + foreign keys
- **SSR** + vanilla JS (progressive enhancement)

---

## 🚀 Menjalankan

```bash
# 1. Install dependensi
npm install

# 2. Isi data awal (seed) — otomatis membuat database
npm run seed

# 3. Jalankan server
npm start
# → http://localhost:3000
```

Perintah lain:

```bash
npm run dev      # mode watch
npm run reset    # seed ulang dari nol (menghapus data lama)
```

### Konfigurasi

Salin `.env.example` menjadi `.env` dan isi kredensial asli untuk mengaktifkan integrasi.
Selama dibiarkan kosong, fitur terkait tetap jujur berstatus **"Belum dikonfigurasi"**.

```bash
cp .env.example .env
```

| Variabel | Fungsi |
| --- | --- |
| `PORT` | Port server (default 3000) |
| `DB_PATH` | Lokasi file SQLite |
| `PAYMENT_PROVIDER` / `PAYMENT_API_KEY` / `PAYMENT_WEBHOOK_SECRET` | Payment gateway |
| `SUPPLIER_API_URL` / `SUPPLIER_API_KEY` | Supplier / fulfilment top-up |
| `ID_VALIDATION_API_URL` / `ID_VALIDATION_API_KEY` | Validasi ID akun game |
| `ADMIN_TOKEN` | Token untuk rute admin |

---

## 🔌 API

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| GET | `/api/search?q=` | Cari game |
| POST | `/api/validate-id` | Validasi ID akun (jujur bila belum dikonfigurasi) |
| POST | `/api/orders` | Buat pesanan |
| GET | `/api/orders/:orderId` | Ambil status pesanan (untuk polling) |
| POST | `/api/orders/:orderId/pay` | Buat tagihan pembayaran |
| POST | `/api/orders/:orderId/sandbox/confirm` | Konfirmasi pembayaran sandbox |
| POST | `/api/orders/:orderId/cancel` | Batalkan pesanan |
| POST | `/api/webhooks/payment` | Webhook payment gateway |
| GET | `/healthz` | Health check + status integrasi |

Rute admin (`/api/admin/*`) dilindungi header `x-admin-token` yang harus sama dengan
`ADMIN_TOKEN`.

---

## ⚡ Performa & Responsif

- **Mobile-first**, breakpoint di 640 / 900 / 1100 px (mobile, tablet, desktop).
- HTML ~18 KB, CSS ~25 KB, JS per-halaman 2–8 KB (dimuat `defer`).
- Gambar `loading="lazy"` + `decoding="async"`, dimensi eksplisit (mencegah CLS),
  `fetchpriority="high"` untuk elemen di atas fold.
- Aset statis di-cache 7 hari (immutable) + cache-busting berbasis mtime.
- Menghormati `prefers-reduced-motion`; gaya cetak disiapkan.
- SSR membuat TTFB sangat rendah dan Core Web Vitals tetap sehat.

---

## 📄 Lisensi

MIT. Nama, logo, dan aset visual HEAVYY TOP UP ID adalah milik proyek ini dan dibuat
secara orisinal — tidak menyalin merek, aset, layout, atau kode pihak lain.
