// ============================================================
// VipResellerProvider
//
// VIP Reseller exposes a single "game-feature" endpoint that is used
// for ordering and for status inquiries. Requests are signed with
// md5(apiKey + secret) as a shared request signature.
//
//   POST {VIP_RESELLER_BASE_URL}/game-feature
//   body: key, sign, type=order, service=<sku>, data_no=<target>,
//         ref_id=<idempotency ref>
//
// Idempotency: the same ref_id is echoed back; the inquiry type never
// creates a transaction.
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

interface VipResponse {
  result?: boolean;
  data?: {
    trx_id?: string;
    ref_id?: string;
    status?: string;
    note?: string;
    message?: string;
    price?: number;
    balance?: number;
  };
  message?: string;
}

function mapStatus(raw: string | undefined, ok: boolean | undefined): SupplierStatus {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('success') || s.includes('sukses') || s.includes('berhasil')) return 'SUCCESS';
  if (s.includes('pending') || s.includes('proses') || s.includes('process')) return 'PENDING';
  if (s.includes('fail') || s.includes('gagal') || s.includes('error')) return 'FAILED';
  if (ok === true) return 'SUCCESS';
  if (ok === false) return 'FAILED';
  return 'UNKNOWN';
}

export class VipResellerProvider implements SupplierProvider {
  readonly name = 'vipreseller';

  isConfigured(): boolean {
    return Boolean(env.VIP_RESELLER_API_KEY && env.VIP_RESELLER_BASE_URL);
  }

  private sign(): string {
    return md5Hex(`${env.VIP_RESELLER_API_KEY}${env.VIP_RESELLER_SECRET}`);
  }

  private async call(type: 'order' | 'status', req: SupplierOrderRequest): Promise<SupplierResult> {
    const requestAt = new Date();
    if (!this.isConfigured()) {
      return makeResult({
        status: 'UNKNOWN',
        message: 'VIP Reseller belum dikonfigurasi (VIP_RESELLER_API_KEY / VIP_RESELLER_BASE_URL kosong).',
        errorCode: 'NOT_CONFIGURED',
        requestAt,
        responseAt: new Date(),
      });
    }

    const body = {
      key: env.VIP_RESELLER_API_KEY,
      sign: this.sign(),
      type,
      service: req.sku,
      data_no: req.customerNo,
      ref_id: req.refId,
      ...(req.meta ?? {}),
    };

    const res = await httpRequest<VipResponse>(`${env.VIP_RESELLER_BASE_URL}/game-feature`, {
      method: 'POST',
      body,
      contentType: 'form',
      timeoutMs: 20000,
    });
    const responseAt = new Date();
    const data = res.data?.data;

    if (!res.ok && !res.data) {
      return makeResult({
        status: res.status === 0 ? 'UNKNOWN' : 'FAILED',
        message: res.error ? `VIP Reseller tidak dapat dihubungi: ${res.error}` : `VIP Reseller HTTP ${res.status}.`,
        errorCode: res.error ? 'TIMEOUT' : `HTTP_${res.status}`,
        httpStatus: res.status,
        raw: sanitize(res.data ?? res.text),
        requestAt,
        responseAt,
      });
    }

    return makeResult({
      status: mapStatus(data?.status ?? res.data?.message, res.data?.result),
      supplierTrxId: data?.trx_id ?? null,
      errorCode: res.data?.result === false ? 'RESULT_FALSE' : null,
      message: data?.note ?? data?.message ?? res.data?.message ?? 'Tidak ada pesan dari VIP Reseller.',
      httpStatus: res.status,
      raw: sanitize(res.data),
      requestAt,
      responseAt,
    });
  }

  async createTransaction(req: SupplierOrderRequest): Promise<SupplierResult> {
    logger.debug({ supplier: this.name, refId: req.refId }, 'vipreseller createTransaction');
    return this.call('order', req);
  }

  async checkTransaction(refId: string, req?: Partial<SupplierOrderRequest>): Promise<SupplierResult> {
    logger.debug({ supplier: this.name, refId }, 'vipreseller checkTransaction');
    return this.call('status', {
      orderId: req?.orderId ?? refId,
      refId,
      sku: req?.sku ?? '',
      customerNo: req?.customerNo ?? '',
    });
  }

  async balance(): Promise<SupplierBalance> {
    if (!this.isConfigured()) return { ok: false, message: 'VIP Reseller belum dikonfigurasi.' };
    const res = await httpRequest<VipResponse>(`${env.VIP_RESELLER_BASE_URL}/game-feature`, {
      method: 'POST',
      body: { key: env.VIP_RESELLER_API_KEY, sign: this.sign(), type: 'balance' },
      contentType: 'form',
      timeoutMs: 15000,
    });
    if (!res.ok || !res.data?.data) return { ok: false, message: res.error ?? `HTTP ${res.status}` };
    return { ok: true, balance: res.data.data.balance ?? 0, message: 'OK' };
  }
}
