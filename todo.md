# HEAVYY TOP UP ID — Phase 2

## 6. Assets (logo + real game icons)  [DONE]
- [x] Fetch real game icons (16) from public sources (Play Store / App Store / Wikipedia / Commons)
- [x] Process icons -> square 256px PNG + generate banners
- [x] Replace "HV" logo with uploaded mark (transparent PNG + favicon + OG image)
- [x] Update frontend (layout, components, seed) to use new assets

## 7. Production Backend (TypeScript + Prisma + PostgreSQL + Redis + Docker)
### 7.1 Foundation
- [x] Scaffold (package.json, tsconfig, env validation with Zod, logger, prisma client, redis)
- [x] Prisma schema (Order, OrderEvent, WebhookEvent, SupplierTransaction, Game, Product, AdminUser, AuditLog)
- [x] Core libs (errors, async-handler, crypto, sanitize, order-id, idempotency, locks, validation, money)
### 7.2 Integrations
- [x] Supplier abstraction (SupplierProvider + DigiflazzProvider + VipResellerProvider + CustomSupplierProvider + factory)
- [x] Payment gateway abstraction + webhook signature/amount/merchant verification
### 7.3 Order engine
- [x] Order engine (state machine, locking, idempotency, no blind retry, exponential backoff, MANUAL_REVIEW)
- [x] Order service (server-side pricing, create/get/list)
- [x] Queue (BullMQ + Redis) + worker
### 7.4 Security & API
- [x] Security middleware (rate limit, Zod validation, admin auth + RBAC, CSRF, secure cookies, sanitization)
- [x] REST API routes (catalog, orders, webhooks, admin, health)
- [x] Error handling + sanitized logging
- [x] OpenAPI docs
### 7.5 Data & quality
- [x] Prisma seed data
- [x] Fix: add missing sandbox/confirm route referenced by payment-service
- [x] Update .env.example (SANDBOX_ENABLED, ADMIN_EMAIL/PASSWORD, CUSTOM_SUPPLIER_*)
- [x] Unit tests (crypto, money, order-id, sanitize, validation, state machine, supplier signatures) — 67 passing
- [x] Integration tests (order lifecycle, webhook signature/amount/idempotency, no-blind-retry, MANUAL_REVIEW, admin auth/RBAC/CSRF) — 41 passing
- [x] Fix: params validation (object schema), BullMQ jobId ':' bug, PENDING_SUPPLIER nextRetryAt, refund guard
- [x] Docker + docker-compose (validated YAML + Dockerfile; daemon unavailable in sandbox)
- [x] README for backend

## 8. Delivery
- [ ] Push to GitHub (branch + PR)
- [ ] Final summary + attachments
