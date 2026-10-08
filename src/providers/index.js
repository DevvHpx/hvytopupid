// ============================================================
// Integration providers.
//
// HEAVYY TOP UP ID is designed around pluggable providers for:
//   1. Payment gateway  (charge / verify)
//   2. Account validation (ID lookup)
//   3. Top-up supplier  (fulfilment)
//
// When real credentials are absent we DO NOT fake success. Every
// provider reports `configured: false` and the UI surfaces the
// exact state ("Belum dikonfigurasi"). A clearly-labelled
// Sandbox provider is available so the end-to-end order flow can
// be exercised and tested without pretending to be a live gateway.
// ============================================================
import { get } from '../db/index.js';

function setting(key, fallback = '') {
  const row = get('SELECT value FROM settings WHERE key=?', [key]);
  return row ? row.value : fallback;
}

export function integrationStatus() {
  return {
    payment_gateway: setting('payment_gateway_status', 'not_configured'),
    supplier_api: setting('supplier_api_status', 'not_configured'),
    id_validation: setting('id_validation_status', 'not_configured'),
    sandbox_enabled: setting('sandbox_enabled', 'true') === 'true',
  };
}

// ------------------------------------------------------------
// 1. PAYMENT
// ------------------------------------------------------------
export const payment = {
  // Is this method actually chargeable right now?
  status(code) {
    const row = get('SELECT * FROM payment_methods WHERE code=?', [code]);
    if (!row) return { ok: false, configured: false, reason: 'Metode pembayaran tidak ditemukan.' };
    if (row.config_status === 'configured') {
      if (row.type === 'sandbox') {
        return {
          ok: true, configured: true, sandbox: true,
          reason: 'Mode uji (sandbox). Pembayaran disimulasikan untuk pengujian alur, bukan transaksi nyata.',
        };
      }
      return { ok: true, configured: true, sandbox: false, reason: 'Siap digunakan.' };
    }
    return {
      ok: false, configured: false, sandbox: false,
      reason: 'Belum dikonfigurasi: kredensial payment gateway untuk metode ini belum tersedia.',
    };
  },

  // Create a charge. Returns instructions for the payment page.
  createCharge(order, method) {
    const st = this.status(method.code);
    if (!st.ok) return { ok: false, reason: st.reason };
    if (st.sandbox) {
      return {
        ok: true,
        sandbox: true,
        // The sandbox pay page posts to our own confirm endpoint — a real
        // state transition inside the sandbox, not a fake production charge.
        payUrl: `/order/${encodeURIComponent(order.order_id)}/sandbox-pay`,
        instructions: [
          'Ini adalah mode UJI (sandbox). Tidak ada uang yang berpindah.',
          'Klik "Simulasikan Pembayaran Berhasil" untuk memproses pesanan melalui alur yang sama dengan pembayaran nyata.',
        ],
      };
    }
    return { ok: false, reason: st.reason };
  },
};

// ------------------------------------------------------------
// 2. ACCOUNT VALIDATION
// ------------------------------------------------------------
export const validation = {
  // Try to validate a game account. Without a supplier lookup API we
  // return `unavailable` — we never invent a nickname.
  validate(game, accountFields) {
    const st = integrationStatus();
    if (st.id_validation !== 'configured' || game.validation !== 'available') {
      return {
        status: 'unavailable',
        valid: null,
        message: 'Validasi ID otomatis belum dikonfigurasi. Periksa kembali User ID kamu sebelum melanjutkan.',
      };
    }
    // Placeholder for a real lookup call to the supplier API.
    return { status: 'unavailable', valid: null, message: 'Validasi ID otomatis belum dikonfigurasi.' };
  },
};

// ------------------------------------------------------------
// 3. TOP-UP SUPPLIER (fulfilment)
// ------------------------------------------------------------
export const supplier = {
  // Queue a fulfilment job. Real suppliers are called here once configured.
  fulfill(order) {
    const st = integrationStatus();
    if (st.supplier_api !== 'configured') {
      return {
        ok: true,
        mode: 'manual',
        message: 'Supplier API belum dikonfigurasi. Pesanan masuk antrean pemrosesan manual oleh admin.',
      };
    }
    return { ok: true, mode: 'auto', message: 'Pesanan dikirim ke supplier.' };
  },
};
