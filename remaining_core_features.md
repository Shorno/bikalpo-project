# Remaining Core Features Analysis

Based on `Bikalpo(B2B + B2C).md` docs vs current codebase.

---

## ✅ Already Implemented (Core)

| Feature | Status |
|---------|--------|
| Auth (Consumer, Shop Owner, Admin roles) | ✅ Done |
| Shop Owner Onboarding & Approval | ✅ Done |
| Product CRUD + Variants (TRADE/RETAIL) | ✅ Done |
| Role-based variant visibility (TRADE→shop, RETAIL→consumer) | ✅ Done |
| B2B Order flow (shop→admin→deliver→OTP) | ✅ Done |
| B2C Order flow (consumer→shop seller→cart→checkout) | ✅ Done |
| TRADE→RETAIL auto conversion on B2B delivery | ✅ Done |
| Stock Ledger (immutable audit trail) | ✅ Done |
| Inventory table (per-variant, per-owner) | ✅ Done |
| Shop subdomain routing | ✅ Done |
| Shop dashboard (products, inventory, orders, pricing) | ✅ Done |
| Consumer storefront (product listing, detail, cart) | ✅ Done |
| Product Sellers (B2C shop selection with price) | ✅ Done |
| Admin dashboard (products, orders, delivery, categories, brands) | ✅ Done |
| Delivery rules & cost calculation | ✅ Done |
| Delivery man & Salesman management | ✅ Done |
| Returns system (basic) | ✅ Done |
| Reviews & ratings | ✅ Done |
| Item requests | ✅ Done |
| Support tickets | ✅ Done |
| Invoices & estimates | ✅ Done |
| Announcements & brand updates | ✅ Done |

---

## 🔴 NOT Implemented — Core Features

### 1. 🏭 Admin/Super Seller Inventory (Variant-Level Stock)
**Priority: CRITICAL**

> The admin stock page uses flat `product.stockQuantity` instead of the `inventory` table with `ownerType = "super_seller"`. Without this, B2B conversion can't deduct from admin stock, and the ledger is incomplete.

**What's needed:**
- Admin stock page → manage per-variant inventory via `inventory` table
- Stock In/Out creates proper `stock_ledger` entries
- Links to B2B conversion (convert_out on admin side)

---

### 2. 🤖 Open Order System
**Priority: HIGH**

> Docs: Consumer places order without specifying a shop → system routes to nearest eligible shop → shop accepts/rejects with timer → OTP negotiation.

**What's needed:**
- Order without `shopId` → "open order"
- Area-based shop matching algorithm
- Shop accept/reject dashboard
- OTP load control (max 2 pending per seller)
- Negotiation timeout
- Auto-reassignment if shop rejects

---

### 3. 📍 Area & Zone Management
**Priority: HIGH**

> Docs: Area polygon manager, service availability zones, seller area permission, radius matching, order-area matching.

**What's needed:**
- Area polygon/zone creation (admin)
- Shop → area assignment
- Consumer location → eligible shops matching
- Order routing based on proximity
- Schema exists ([area.ts](file:///c:/Users/Shorno/WebstormProjects/bikalpo-project/packages/db/src/schema/area.ts)) but no CRUD or matching logic

---

### 4. 💰 Pricing & Margin Control System
**Priority: HIGH**

> Docs: Admin sets base price + min-max bands, shop sets selling price (must be ≥ base + margin), 24h price update requirement, price deviation alerts.

**What's needed:**
- Base price rules (admin)
- Min-max price bands per variant
- Shop price validation (≥ base + margin)
- Daily price update enforcement
- Price deviation alerts
- Shop price change logs (partially exists at `orders/price-changes`)

---

### 5. ♻️ Pack Return & Deposit System
**Priority: MEDIUM**

> Docs: Products can have returnable packs (sacks, cartons). Consumer returns old pack or pays deposit. Pack brand/size validation. Deposit refund on return.

**What's needed:**
- `product_pack_rules` schema exists but no UI/API
- Pack return toggle per product
- Deposit amount configuration
- Consumer checkout pack flow (old pack? → brand/size selection)
- Shop-level pack rule override
- Pack deposit ledger

---

### 6. 🔁 Variant Conversion Rules Manager
**Priority: MEDIUM**

> Docs: Conversion rule manager, conversion monitor, conversion job logs, failed conversion alerts. Currently conversion is hard-coded per variant.

**What's needed:**
- `variant_conversion_map` schema exists but no admin UI
- Admin UI to configure conversion ratios
- Conversion loss percentage editor
- Conversion monitor dashboard
- Failed conversion alerts

---

### 7. 🏪 Product-Shop Assignment & Permission
**Priority: MEDIUM**

> Docs: Admin assigns specific products/variants to specific shops. Shops CANNOT add products manually. Shops can only sell assigned products.

**What's needed:**
- Product → shop assignment admin UI
- Variant → shop availability matrix
- Shop catalog auto-sync
- Product request from shop → admin approval queue
- Currently shops see ALL products (no permission filtering)

---

### 8. 📊 Sales Model System
**Priority: MEDIUM**

> Docs: Sales Model Manager → group products into "models" → assign models to shops. Shops sell only products in their model.

**What's needed:**
- `sales_model` schema exists but no UI/API
- Model CRUD
- Model → product mapping
- Shop → model assignment
- Model performance reports

---

### 9. 🧾 Financial Accounting Module
**Priority: MEDIUM**

> Docs: Financial overview, accounts list, transactions, account statements, expenses, income, balance sheet, trial balance, cash flow.

**What's needed:**
- Full accounting module (double-entry bookkeeping)
- Expense tracking with categories
- Income tracking
- Balance sheet / trial balance / cash flow reports
- Credit note management (for returns)

---

### 10. 🚚 Delivery Man App/Dashboard (Full)
**Priority: MEDIUM**

> Docs: Two types — Platform Delivery (B2B, warehouse→shop) and Shop Delivery (B2C, shop→consumer). Route optimization, trip management, QR scan, photo proof.

**What's needed:**
- Platform delivery man dashboard (B2B deliveries)
- Shop delivery man dashboard (B2C deliveries)
- Route optimization / stop sequence
- Trip start → pickup → deliver flow
- Photo/proof upload
- Return pickup flow
- Currently only basic delivery listing exists

---

### 11. 👨‍💼 SR (Sales Representative) System
**Priority: LOW**

> Docs: Sales Team covers market areas, visits shops, takes orders on behalf of shops, route planning, daily visits, performance reports.

**What's needed:**
- SR route management
- Shop visit tracking
- Order placement on behalf of shops
- SR performance dashboard
- Territory assignment

---

### 12. 🎁 Offers, Coupons & Promotions
**Priority: LOW**

> Docs: Offer template library, offer rule builder, validity scheduler, coupon system, gift cards, seller promotions panel.

**What's needed:**
- Coupon CRUD
- Offer rule engine
- Gift cards
- Seller-level promotion toggle
- Offer impact/performance reports

---

### 13. 📱 SMS Marketing & Notifications
**Priority: LOW**

> Docs: SMS automation, targeted campaigns, automated follow-ups, order notifications.

**What's needed:**
- SMS gateway integration
- Campaign builder
- Automated order status SMS
- Customer retention campaigns

---

### 14. 👥 HRM & Payroll
**Priority: LOW**

> Docs: Employee management, shifts, attendance, leaves, departments, designations.

**What's needed:**
- Employee directory with departments
- Shift management
- Attendance tracking
- Leave management
- Payroll basics

---

## Summary

| Priority | Feature | Effort |
|----------|---------|--------|
| 🔴 CRITICAL | Admin Variant-Level Inventory + Ledger | Medium |
| 🔴 HIGH | Open Order System (auto shop matching) | Large |
| 🔴 HIGH | Area & Zone Management | Large |
| 🔴 HIGH | Pricing & Margin Control | Medium |
| 🟡 MEDIUM | Pack Return & Deposit | Medium |
| 🟡 MEDIUM | Variant Conversion Rules UI | Small |
| 🟡 MEDIUM | Product-Shop Assignment | Medium |
| 🟡 MEDIUM | Sales Model System | Medium |
| 🟡 MEDIUM | Financial Accounting | Large |
| 🟡 MEDIUM | Full Delivery Dashboard | Large |
| 🟢 LOW | SR System | Large |
| 🟢 LOW | Offers & Coupons | Medium |
| 🟢 LOW | SMS Marketing | Medium |
| 🟢 LOW | HRM & Payroll | Large |

**Total: 14 core features remaining** — 4 critical/high, 6 medium, 4 low priority.
