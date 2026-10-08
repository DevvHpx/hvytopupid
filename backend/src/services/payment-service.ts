// ============================================================
// Payment service — creates a charge for a pending order.
// The amount is taken from the order's immutable snapshot; the client
// never supplies a price.
// ============================================================
import { prisma } from '../db/prisma';
import { badRequest, notFound } from '../lib/errors';
import { getPaymentProvider } from '../payments';
import { formatIDR } from '../lib/money';
import { sandboxEnabled } from '../config/env';

export async function createChargeForOrder(
  orderId: string,
  contact: { email?: string; whatsapp?: string } = {},
) {
  const order = await prisma.order.findUnique({ where: { orderId: orderId.toUpperCase() } });
  if (!order) throw notFound('Pesanan tidak ditemukan.');
  if (order.status !== 'PENDING_PAYMENT') {
    return { ok: true, already: true, status: order.status };
  }

  if (contact.email || contact.whatsapp) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        contactEmail: contact.email || order.contactEmail,
        contactPhone: contact.whatsapp || order.contactPhone,
      },
    });
  }

  const method = await prisma.paymentMethod.findUnique({ where: { code: order.paymentCode ?? '' } });
  if (!method) throw badRequest('Metode pembayaran tidak valid.');
  if (method.configStatus !== 'configured') {
    throw badRequest('Metode pembayaran ini belum dikonfigurasi. Pilih metode lain.');
  }

  // Clearly-labelled sandbox mode (never active in production).
  if (method.type === 'sandbox') {
    if (!sandboxEnabled) throw badRequest('Mode sandbox tidak aktif pada lingkungan ini.');
    return {
      ok: true,
      already: false,
      charge: {
        provider: 'sandbox',
        sandbox: true,
        redirectUrl: null,
        gatewayRef: null,
        confirmUrl: `/api/v1/orders/${order.orderId}/sandbox/confirm`,
        instructions: [
          'Ini mode UJI (sandbox). Tidak ada uang yang berpindah.',
          `Total: ${formatIDR(order.total)}.`,
          'Kirim POST ke confirmUrl untuk menyimulasikan pembayaran berhasil.',
        ],
        reason: null,
      },
    };
  }

  const provider = getPaymentProvider();
  if (!provider.isConfigured()) {
    throw badRequest('Payment gateway belum dikonfigurasi (PAYMENT_GATEWAY_KEY / SECRET kosong).');
  }

  const charge = await provider.createCharge({
    orderId: order.orderId,
    amount: order.total,
    currency: order.currency,
    paymentCode: order.paymentCode ?? '',
    customerEmail: contact.email || order.contactEmail,
    customerPhone: contact.whatsapp || order.contactPhone,
    items: [
      { name: order.productName, price: order.price, quantity: 1 },
      ...(order.adminFee > 0 ? [{ name: `Biaya ${method.name}`, price: order.adminFee, quantity: 1 }] : []),
    ],
  });

  return {
    ok: charge.ok,
    already: false,
    charge: {
      provider: provider.name,
      redirectUrl: charge.redirectUrl ?? null,
      gatewayRef: charge.gatewayRef ?? null,
      instructions: charge.instructions ?? [`Total pembayaran: ${formatIDR(order.total)}`],
      reason: charge.reason ?? null,
    },
  };
}
