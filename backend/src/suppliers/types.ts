// ============================================================
// SupplierProvider abstraction.
//
// The order engine depends ONLY on this interface. Adding a new
// supplier means implementing SupplierProvider and registering it in
// the factory — the order engine never changes.
//
//   SupplierProvider
//     ├── DigiflazzProvider
//     ├── VipResellerProvider
//     └── CustomSupplierProvider
// ============================================================

export type SupplierStatus = 'SUCCESS' | 'PENDING' | 'FAILED' | 'UNKNOWN';

export interface SupplierOrderRequest {
  /** Public order reference (HVY-YYMMDD-XXXXXX). */
  orderId: string;
  /** Unique, stable reference sent to the supplier (idempotency). */
  refId: string;
  /** Supplier SKU (falls back to the product SKU). */
  sku: string;
  /** Target account number / user id (may be a composed string). */
  customerNo: string;
  /** Optional denomination / amount hint. */
  amount?: number;
  /** Human-readable product name (for supplier-side logs). */
  productName?: string;
  /** Extra supplier-specific fields (e.g. server id, zone). */
  meta?: Record<string, string>;
}

export interface SupplierResult {
  status: SupplierStatus;
  /** Supplier-side transaction id (SN / trx id), when returned. */
  supplierTrxId?: string | null;
  /** Supplier error / response code. */
  errorCode?: string | null;
  /** Human-readable, already-sanitised message. */
  message: string;
  httpStatus?: number | null;
  /** Sanitised raw response (never contains secrets). */
  raw?: unknown;
  requestAt: Date;
  responseAt: Date;
}

export interface SupplierBalance {
  ok: boolean;
  balance?: number;
  message: string;
}

export interface SupplierProvider {
  readonly name: string;
  /** True only when all required credentials are present. */
  isConfigured(): boolean;
  /** Create (or idempotently re-fetch) a top-up transaction. */
  createTransaction(req: SupplierOrderRequest): Promise<SupplierResult>;
  /**
   * Inquiry: check the status of an existing transaction WITHOUT
   * creating a new one. Used before any retry (no blind retry).
   */
  checkTransaction(refId: string, req?: Partial<SupplierOrderRequest>): Promise<SupplierResult>;
  /** Optional balance lookup. */
  balance?(): Promise<SupplierBalance>;
}

export function makeResult(partial: Partial<SupplierResult> & { status: SupplierStatus; message: string }): SupplierResult {
  const now = new Date();
  return {
    supplierTrxId: null,
    errorCode: null,
    httpStatus: null,
    raw: null,
    requestAt: now,
    responseAt: now,
    ...partial,
  };
}
