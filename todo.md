# HEAVYY TOP UP ID — Build Plan

## 1. Foundation
- [x] Scaffold project (package.json, deps, folder structure)
- [x] Verify database engine (SQLite) works
- [x] Design database schema (games, categories, products, payment_methods, orders, promos, faqs, settings)

## 2. Backend (Express + SQLite)
- [x] Database module + migrations
- [x] Seed data (games, products, payment methods, promos, faqs)
- [x] Provider interfaces: payment, ID validation, top-up supplier (honest "belum dikonfigurasi" states)
- [x] REST API: games, products, validate-id, orders (create/get/poll), check-order, payment webhook, admin
- [x] SSR page routes

## 3. Frontend (SSR + progressive enhancement)
- [x] Design system CSS (silver/metallic premium theme, mobile-first)
- [x] SVG logo + brand assets
- [x] Home page (navbar, hero, search, categories, popular, digital products, promo, advantages, FAQ, footer)
- [x] Game catalog page (from DB)
- [x] Game detail / top-up page (ID fields, denominations, payment, summary, validation gate)
- [x] Checkout page
- [x] Payment status page (/order/[orderId]) with polling
- [x] Check order page
- [x] Promo + Help pages

## 4. Quality
- [x] Responsive (mobile/tablet/desktop) — verified via screenshots at 390/768/1440px
- [x] Performance (lazy load, optimized assets, minimal JS, Core Web Vitals) — ~18KB HTML, sub-3ms TTFB
- [x] End-to-end flow test (create order -> status transitions) — verified pending_payment→paid→processing→success

## 5. Delivery
- [x] README documentation
- [x] Push to GitHub (DevvHpx/hvytopupid) via branch + PR (#1)
- [x] Static preview deployment (expose-port tunnel unavailable in env; deployed static snapshot instead)
- [x] Final summary + attachments
