// ============================================================
// Supplier registry / factory.
// Providers are looked up by name; the order engine only ever sees
// the SupplierProvider interface, so swapping suppliers is config-only.
// ============================================================
import { env } from '../config/env';
import { notConfigured } from '../lib/errors';
import { DigiflazzProvider } from './digiflazz';
import { VipResellerProvider } from './vip-reseller';
import { CustomSupplierProvider } from './custom';
import type { SupplierProvider } from './types';

export const SUPPLIER_NAMES = ['digiflazz', 'vipreseller', 'custom'] as const;
export type SupplierName = (typeof SUPPLIER_NAMES)[number];

const registry: Record<SupplierName, SupplierProvider> = {
  digiflazz: new DigiflazzProvider(),
  vipreseller: new VipResellerProvider(),
  custom: new CustomSupplierProvider(),
};

export function isSupplierName(name: string): name is SupplierName {
  return (SUPPLIER_NAMES as readonly string[]).includes(name);
}

/** Resolve a provider by name (defaults to SUPPLIER_DEFAULT). */
export function getSupplier(name?: string | null): SupplierProvider {
  const key = (name ?? env.SUPPLIER_DEFAULT).toLowerCase();
  if (!isSupplierName(key)) {
    throw notConfigured(`Supplier "${key}" tidak dikenal. Pilihan: ${SUPPLIER_NAMES.join(', ')}.`);
  }
  return registry[key];
}

/** All providers with their configuration state (for admin/health views). */
export function supplierStatus() {
  return SUPPLIER_NAMES.map((name) => ({
    name,
    configured: registry[name].isConfigured(),
  }));
}

export * from './types';
