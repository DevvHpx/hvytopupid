// ============================================================
// CustomSupplierProvider
//
// Adapter for a bespoke / private supplier HTTP API. It sends a
// documented JSON contract and expects a documented JSON response,
// so an operator can integrate any supplier without touching the
// order engine:
//
//   POST {CUSTOM_SUPPLIER_BASE_URL}/order
//   Authorization: Bearer {CUSTOM_SUPPLIER_API_KEY}
//   { refId, sku, customerNo, amount, productName, meta }
//   -> { status: "SUCCESS"|"PENDING"|"FAILED", trxId, code, message }
//
//   POST {CUSTOM_SUPPLIER_BASE_URL}/status   (inquiry, no side effects)
//   { refId } -> same shape
// ============================================================
import { env } from '../config/env';
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

interface CustomResponse {
  status?: string;
  trxId?: string;
  code?: string;
  message?: string;
  balance?: number;
}

function mapStatus(raw: string | undefined): SupplierStatus {
  const s = (raw ?? '').toUpperCase();
  if (s === 'SUCCESS' || s === 'SUKSES') return 'SUCCESS';
  if (s === 'PENDING') return 'PENDING';
  if (s === 'FAILED' || s === 'GAGAL') return 'FAILED';
  return 'UNKNOWN';
}

export class CustomSupplierProvider implements SupplierProvider {
  readonly name = 'custom';

  isConfigured(): boolean {
    return Boolean(env.CUSTOM_SUPPLIER_BASE_URL && env.CUSTOM_SUPPLIER_API_KEY);
  }

  private headers(): Record<string, string> {
    return { authorization: `Bearer ${env.CUSTOM_SUPPLIER_API_KEY}` };
  }

  private async call(path: string, payload: Record<string, unknown>): Promise<SupplierResult> {
    const requestAt = new Date();
    if (!this.isConfigured()) {
      return makeResult({
        status: 'UNKNOWN',
        message: 'Custom supplier belum dikonfigurasi (CUSTOM_SUPPLIER_BASE_URL / CUSTOM_SUPPLIER_API_KEY kosong).',
        errorCode: 'NOT_CONFIGURED',
        requestAt,
        responseAt: new Date(),
      });
    }

    const res = await httpRequest<CustomResponse>(`${env.CUSTOM_SUPPLIER_BASE_URL}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: payload,
      timeoutMs: 20000,
    });
    const responseAt = new Date();

    if (!res.ok && !res.data) {
      return makeResult({
        status: res.status === 0 ? 'UNKNOWN' : 'FAILED',
        message: res.error ? `Custom supplier tidak dapat dihubungi: ${res.error}` : `Custom supplier HTTP ${res.status}.`,
        errorCode: res.error ? 'TIMEOUT' : `HTTP_${res.status}`,
        httpStatus: res.status,
        raw: sanitize(res.data ?? res.text),
        requestAt,
        responseAt,
      });
    }

    return makeResult({
      status: mapStatus(res.data?.status),
      supplierTrxId: res.data?.trxId ?? null,
      errorCode: res.data?.code ?? null,
      message: res.data?.message ?? 'Tidak ada pesan dari custom supplier.',
      httpStatus: res.status,
      raw: sanitize(res.data),
      requestAt,
      responseAt,
    });
  }

  async createTransaction(req: SupplierOrderRequest): Promise<SupplierResult> {
    logger.debug({ supplier: this.name, refId: req.refId }, 'custom createTransaction');
    return this.call('/order', {
      refId: req.refId,
      orderId: req.orderId,
      sku: req.sku,
      customerNo: req.customerNo,
      amount: req.amount,
      productName: req.productName,
      meta: req.meta ?? {},
    });
  }

  async checkTransaction(refId: string, req?: Partial<SupplierOrderRequest>): Promise<SupplierResult> {
    logger.debug({ supplier: this.name, refId }, 'custom checkTransaction');
    return this.call('/status', { refId, orderId: req?.orderId ?? refId });
  }

  async balance(): Promise<SupplierBalance> {
    if (!this.isConfigured()) return { ok: false, message: 'Custom supplier belum dikonfigurasi.' };
    const res = await httpRequest<CustomResponse>(`${env.CUSTOM_SUPPLIER_BASE_URL}/balance`, {
      method: 'POST',
      headers: this.headers(),
      body: {},
      timeoutMs: 15000,
    });
    if (!res.ok || !res.data) return { ok: false, message: res.error ?? `HTTP ${res.status}` };
    return { ok: true, balance: res.data.balance ?? 0, message: res.data.message ?? 'OK' };
  }
}
