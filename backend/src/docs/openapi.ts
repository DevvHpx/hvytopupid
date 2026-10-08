// ============================================================
// OpenAPI 3.1 specification for the HEAVYY TOP UP ID backend.
// Served at GET /api/v1/openapi.json and rendered by /docs.
// ============================================================

export const openapiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'HEAVYY TOP UP ID — Backend API',
    version: '1.0.0',
    description:
      'Production backend for automatic game top-up fulfillment. Payment is confirmed by a verified webhook, then the order is queued and fulfilled via a supplier API (Digiflazz / VIP Reseller / custom).',
  },
  servers: [{ url: '/api/v1' }],
  tags: [
    { name: 'Catalog' },
    { name: 'Orders' },
    { name: 'Webhooks' },
    { name: 'Admin' },
    { name: 'Health' },
  ],
  paths: {
    '/catalog/categories': {
      get: { tags: ['Catalog'], summary: 'List categories', responses: { '200': { description: 'OK' } } },
    },
    '/catalog/games': {
      get: {
        tags: ['Catalog'],
        summary: 'List games (search + filter)',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 100 } },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/catalog/games/{slug}': {
      get: {
        tags: ['Catalog'],
        summary: 'Game detail with products',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' }, '404': { description: 'Not found' } },
      },
    },
    '/catalog/payment-methods': {
      get: { tags: ['Catalog'], summary: 'List payment methods', responses: { '200': { description: 'OK' } } },
    },
    '/orders': {
      post: {
        tags: ['Orders'],
        summary: 'Create an order (server-side pricing)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['slug', 'productId', 'paymentCode'],
                properties: {
                  slug: { type: 'string' },
                  productId: { type: 'string' },
                  fields: { type: 'object', additionalProperties: { type: 'string' } },
                  email: { type: 'string', format: 'email' },
                  whatsapp: { type: 'string' },
                  paymentCode: { type: 'string' },
                  idempotencyKey: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Created' }, '422': { description: 'Validation error' } },
      },
    },
    '/orders/{orderId}': {
      get: {
        tags: ['Orders'],
        summary: 'Get order status (public view)',
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' }, '404': { description: 'Not found' } },
      },
    },
    '/orders/{orderId}/pay': {
      post: {
        tags: ['Orders'],
        summary: 'Create a payment charge for a pending order',
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/orders/check': {
      post: { tags: ['Orders'], summary: 'Look up an order by id + contact', responses: { '200': { description: 'OK' } } },
    },
    '/webhooks/payment/{provider}': {
      post: {
        tags: ['Webhooks'],
        summary: 'Payment gateway webhook (signature verified)',
        parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string', enum: ['midtrans', 'generic-hmac'] } }],
        responses: {
          '200': { description: 'Processed (or duplicate, idempotent)' },
          '401': { description: 'Signature invalid' },
          '409': { description: 'Amount mismatch' },
        },
      },
    },
    '/admin/auth/login': {
      post: { tags: ['Admin'], summary: 'Admin login (sets httpOnly cookie + CSRF token)', responses: { '200': { description: 'OK' } } },
    },
    '/admin/orders': {
      get: { tags: ['Admin'], summary: 'List orders', security: [{ cookieAuth: [] }], responses: { '200': { description: 'OK' } } },
    },
    '/admin/orders/{orderId}/requeue': {
      post: { tags: ['Admin'], summary: 'Requeue a failed/manual-review order', security: [{ cookieAuth: [] }], responses: { '200': { description: 'OK' } } },
    },
    '/admin/orders/{orderId}/refund': {
      post: { tags: ['Admin'], summary: 'Request a refund', security: [{ cookieAuth: [] }], responses: { '200': { description: 'OK' } } },
    },
    '/admin/stats': {
      get: { tags: ['Admin'], summary: 'Order statistics', security: [{ cookieAuth: [] }], responses: { '200': { description: 'OK' } } },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'hv_admin' },
    },
  },
} as const;
