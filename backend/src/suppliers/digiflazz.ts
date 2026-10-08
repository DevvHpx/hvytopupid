// ============================================================
// DigiflazzProvider
//
// API reference (https://api.digiflazz.com/v1):
//   POST /transaction   { username, buyer_sku_code, customer_no,
//                         ref_id, sign, testing }
//   sign = md5(username + apiKey + ref_id)
//   POST /cek-saldo     { cmd:"deposit", username, sign:md5(username+apiKey+"depo") }
//
// Idempotency: the same ref_id always maps to the same Digiflazz
// transaction, so re-sending it never creates a duplicate top-up.
// That property is what makes `checkTransaction` safe here.
// ============================================================
import { env } from '../config/env';
import { md5Hex } from '../lib/crypto';
import { httpRequest } from '../lib/http';
import { sanitize } from '../lib/sanitize';
import { logger } from '../config/logger';
import {
  type SupplierBalance,
  type SupplierOrderRequest,
  type SupplierProvider,
  type SupplierResult,
  type SupplierStatus,
  makeResult,
} from './types';

interface DigiflazzTxn {
  ref_id?: string;
  customer_no?: string;
  buyer_sku_code?: string;
  message?: string;
  status?: string;
  rc?: string;
  sn?: string;
  price?: number;
  buyer_last_balance?: number;
}
interface DigiflazzResponse {
  data?: DigiflazzTxn;
}

function mapStatus(raw: string | undefined): SupplierStatus {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('sukses') || s.includes('success')) return 'SUCCESS';
  if (s.includes('pending')) return 'PENDING';
  if (s.includes('gagal') || s.includes('fail')) return 'FAILED';
  return 'UNKNOWN';
}

export class DigiflazzProvider implements SupplierProvider {
  readonly name = 'digiflazz';

  isConfigured(): boolean {
    return Boolean(env.DIGIFLAZZ_USERNAME && env.DIGIFLAZZ_API_KEY);
  }

  private sign(refId: string): string {
    return md5Hex(`${env.DIGIFLAZZ_USERNAME}${env.DIGIFLAZZ_API_KEY}${refId}`);
  }

  private async call(req: SupplierOrderRequest): Promise<SupplierResult> {
    const requestAt = new Date();
    if (!this.isConfigured()) {
      return makeResult({
        status: 'UNKNOWN',
        message: 'Digiflazz belum dikonfigurasi (DIGIFLAZZ_USERNAME / DIGIFLAZZ_API_KEY kosong).',
        errorCode: 'NOT_CONFIGURED',
        requestAt,
        responseAt: new Date(),
      });
    }

    const body = {
      username: env.DIGIFLAZZ_USERNAME,
      buyer_sku_code: req.sku,
      customer_no: req.customerNo,
      ref_id: req.refId,
      sign: this.sign(req.refId),
      testing: env.DIGIFLAZZ_TESTING,
    };

    const res = await httpRequest<DigiflazzResponse>(`${env.DIGIFLAZZ_BASE_URL}/transaction`, {
      method: 'POST',
      body,
      timeoutMs: 20000,
    });
    const responseAt = new Date();
    const data = res.data?.data;

    if (!res.ok && !data) {
      return makeResult({
        status: res.status === 0 ? 'UNKNOWN' : 'FAILED',
        message: res.error ? `Digiflazz tidak dapat dihubungi: ${res.error}` : `Digiflazz HTTP ${res.status}.`,
        errorCode: res.error ? 'TIMEOUT' : `HTTP_${res.status}`,
        httpStatus: res.status,
        raw: sanitize(res.data ?? res.text),
        requestAt,
        responseAt,
      });
    }

    const status = mapStatus(data?.status);
    return makeResult({
      status,
      supplierTrxId: data?.sn ?? null,
      errorCode: data?.rc ?? null,
      message: data?.message ?? 'Tidak ada pesan dari Digiflazz.',
      httpStatus: res.status,
      raw: sanitize(data),
      requestAt,
      responseAt,
    });
  }

  async createTransaction(req: SupplierOrderRequest): Promise<SupplierResult> {
    logger.debug({ supplier: this.name, refId: req.refId }, 'digiflazz createTransaction');
    return this.call(req);
  }

  /**
   * Digiflazz returns the existing transaction for a repeated ref_id,
   * so this inquiry never creates a second top-up.
   */
  async checkTransaction(refId: string, req?: Partial<SupplierOrderRequest>): Promise<SupplierResult> {
    logger.debug({ supplier: this.name, refId }, 'digiflazz checkTransaction');
    return this.call({
      orderId: req?.orderId ?? refId,
      refId,
      sku: req?.sku ?? '',
      customerNo: req?.customerNo ?? '',
    });
  }

  async balance(): Promise<SupplierBalance> {
    if (!this.isConfigured()) {
      return { ok: false, message: 'Digiflazz belum dikonfigurasi.' };
    }
    const sign = md5Hex(`${env.DIGIFLAZZ_USERNAME}${env.DIGIFLAZZ_API_KEY}depo`);
    const res = await httpRequest<{ data?: { deposit?: number } }>(`${env.DIGIFLAZZ_BASE_URL}/cek-saldo`, {
      method: 'POST',
      body: { cmd: 'deposit', username: env.DIGIFLAZZ_USERNAME, sign },
      timeoutMs: 15000,
    });
    if (!res.ok || !res.data?.data) {
      return { ok: false, message: res.error ?? `HTTP ${res.status}` };
    }
    return { ok: true, balance: res.data.data.deposit ?? 0, message: 'OK' };
  }
}
