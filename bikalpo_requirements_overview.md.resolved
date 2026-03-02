# Bikalpo.com — B2B + B2C Requirements Overview & Phased Plan

## 🎯 Platform Summary

**Bikalpo.com** is a **Location-Based Multi-Vendor Marketplace** with a hybrid B2B + B2C model:

```
Dealer (Admin / Super Seller) → Shop Owner (B2B)
            Shop Owner → Consumer (B2C)
```

---

## 👥 User Roles & Capabilities

| Role | Can Buy | Can Sell | Key Responsibilities |
|------|---------|----------|---------------------|
| **Admin (Super Seller)** | ❌ | ✅ B2B only | Platform control, product management, pricing, seller approval, B2B sales to shop owners |
| **Shop Owner (Seller)** | ✅ B2B | ✅ B2C | Buy from Admin, sell to Consumers, manage store, set retail prices |
| **Shop Owner (Buyer-only)** | ✅ B2B | ❌ | Restaurant type — wholesale purchasing only |
| **Consumer** | ✅ B2C | ❌ | Browse, order from shops, track delivery |
| **Employee** | ❌ | ❌ | Operational only (salesman, delivery roles) |

### Account Creation Flow

- **Consumer**: Sign Up → Auto Consumer account → Home Screen (no role selection)
- **Shop Owner**: Sign Up as Consumer → Apply "Become a Business Seller" → Admin Approval → Role upgraded
- **Employee**: Admin creates → SMS invite → Login → Auto role assigned

---

## 📦 Product, Variant & Pack System

### Architecture

- **Products** are global master data — same for all users
- **Variants** define pack type, order type, pricing, and are shared across all inventory owners
- **SKU is globally unique** across Super Seller and Shop Owner inventories

### Variant Types

| Type | Pack Example | Order Type | Visibility | Stock Source |
|------|-------------|-----------|-----------|-------------|
| **TRADE** (V1) | Sack 50kg | B2B | Shop Owner | Super Seller |
| **TRADE** (V2) | Carton (10×5kg inside) | B2B | Shop Owner | Super Seller |
| **RETAIL** (V3) | Packet 5kg | B2C | Consumer | Shop |
| **RETAIL** (V4) | Loose KG | B2C | Consumer | Shop |

### Key Rules

- Shop Owners can sell **only** Admin-assigned products within their assigned model
- Shop Owners **cannot** add products manually (can only request new ones)
- Pricing: `shop_selling_price >= base_price + min_margin`
- Prices must be updated at least once every 24h
- Pack return system with deposit handling and seller-overridable rules

---

## 🔁 Inventory & Auto-Conversion System

### Stock Flow Chain

```
Super Seller Inventory (TRADE)
        ↓  B2B Sale
Shop Trade Inventory
        ↓  Auto Conversion
Shop Retail Inventory (RETAIL)
        ↓  B2C Sale
Consumer
```

### Core Tables

- **`inventories`** — Live snapshot (owner_type, variant_id, available_qty, reserved_qty)
- **`stock_ledger`** — Immutable audit trail (IN/OUT/CONVERT_IN/CONVERT_OUT/DAMAGE/RETURN/ADJUST)
- **`variant_conversion_map`** — Maps TRADE → RETAIL variants with conversion ratios

### Conversion Example

```
Shop buys 2 Cartons → Super Seller: -2 Carton (OUT)
→ Shop Trade: +2 Carton (IN) → Auto Convert → Shop Retail: +20 Packs (CONVERT_IN)
→ Shop Trade: -2 Carton (CONVERT_OUT)
```

---

## 🛒 Order System (Auto-Split + Open Order + Negotiation)

### Order Types

1. **B2B Direct**: Shop Owner buys from Admin (Super Seller)
2. **B2C Direct**: Consumer buys from specific Shop Owner
3. **Open Order**: Consumer places order → System broadcasts to eligible sellers → Negotiation

### Auto-Split Engine

- Consumer sees **one Master Order**
- System splits into **Sub-Orders per Seller** based on product availability, area, and stock
- Each sub-order has independent OTP, delivery, and invoicing

### Open Order Negotiation Flow

```
Consumer places order → Broadcast to eligible sellers → First seller LOCKS order
→ Seller submits price within 100sec → Consumer reviews offers → Accept/Reject
→ Confirmed → OTP generated → Delivery initiated
```

### Seller Eligibility for Open Orders

- `seller_status = approved` + `can_accept_open_order = true`
- Area permission matched
- Product model matched
- Stock available
- `pending_otp < 2` (OTP load control)

---

## 🏪 Discovery, Store & Search

- **Homepage**: Product cards with seller count, base price, "View Sellers" option
- **Search**: Unified search across Products, Sellers, and Categories (tabbed results)
- **Seller Public Store Page**: `bikalpo.com/store/{shop-slug}` with Products, Offers, About, Reviews tabs
- **Visibility Rules**: Products visible only if Admin-approved, model-matched, stock available, price updated within 24h

---

## 🚚 Delivery System

| Role | For | Controlled By |
|------|-----|--------------|
| **Platform Delivery Man** | B2B (Super Seller → Shop) | Admin |
| **Shop Delivery Man** | B2C (Shop → Consumer) | Shop Owner |
| **Courier Integration** | B2C (Pathao/Steadfast) | API |

---

## 📊 What's Already Built (Existing Admin)

Based on analysis of the current codebase (`apps/web/app/(dashboard)/dashboard/admin/`):

### Existing 38 Admin Pages across 22 Sections

| Section | Status | Pages |
|---------|--------|-------|
| Dashboard | ✅ Built | Stats, quick actions, recent orders |
| Orders | ✅ Built | List, detail, price changes |
| Invoices | ✅ Built | List, detail, partial invoicing |
| Delivery | ✅ Built | List, detail (delivery groups) |
| Customers | ✅ Built | List, detail |
| Products | ✅ Built | List, create, edit, detail |
| Estimates | ✅ Built | List, create, edit |
| Returns | ✅ Built | List, detail |
| Stock | ✅ Built | Stock page |
| Deliverymen | ✅ Built | List, detail |
| Salesmen | ✅ Built | List, detail |
| Seller Applications | ✅ Built | List with approve/reject |
| Categories | ✅ Built | List, detail |
| Brands | ✅ Built | List |
| Employee Performance | ✅ Built | Performance dashboard |
| Sales Reports | ✅ Built | Reports pages |
| Tickets | ✅ Built | List, detail |
| Item Requests | ✅ Built | List |
| Announcements | ✅ Built | Management |
| Audit | ✅ Built | Audit page |
| Brand Updates | ✅ Built | Updates page |
| Delivery Rules | ✅ Built | Rules page |

### Existing DB Schema (26 files)

Products, variants, orders, deliveries, invoices, estimates, returns, payments, carts, reviews, support tickets, categories, brands, seller applications, stock change logs, user profiles, addresses, etc.

---

## 🚀 Gap Analysis: New Requirements vs Existing System

### 🔴 Major New Systems (Not Yet Built)

| System | Description | Complexity |
|--------|------------|-----------|
| **B2B Order Flow** | Admin → Shop Owner ordering with wholesale variants | High |
| **Variant TRADE/RETAIL Split** | Variant types, visibility rules, conversion links | High |
| **Auto-Conversion Engine** | TRADE → RETAIL stock conversion on B2B purchase | High |
| **Immutable Stock Ledger** | Full audit trail replacing simple stock changes | High |
| **Open Order + Negotiation** | Broadcasting, seller lock, 100s timer, price negotiation | Very High |
| **Order Auto-Split** | Cart → multiple sub-orders per seller | High |
| **Area/Zone Management** | Polygon areas, seller area mapping, radius matching | High |
| **Consumer Discovery** | Public store pages, product search, seller listing | Medium |
| **Pack Return System** | Deposit handling, pack collection at delivery | Medium |
| **Pricing/Margin Control** | Base price + margin rules + 24h update enforcement | Medium |
| **Product Model Assignment** | Sales models, shop-product mapping, permission control | Medium |

### 🟡 Enhancements to Existing Systems

| System | Enhancement Needed |
|--------|-------------------|
| **Product Schema** | Add `is_returnable_pack`, `allowed_pack_brands/sizes`, pack deposit |
| **Variant Schema** | Add `variant_type`, `pack_type`, `linked_retail_variant_id`, `conversion_ratio`, `visibility_role`, `is_open_order_allowed`, `negotiation_timeout_sec` |
| **Order Schema** | Add `master_order_id`, `sub_order` support, `seller_id` assignment, negotiation tracking |
| **Inventory Schema** | Add `owner_type/owner_id`, `reserved_qty`, remove `damaged_qty` |
| **User/Role System** | Add `seller_status`, `can_accept_open_order`, area permissions, capability flags |
| **Delivery Schema** | Split into platform vs shop delivery man types |

---

## 📋 Phased Implementation Plan

### Phase 1: Foundation & Data Model (2-3 weeks)
> **Goal**: Update schemas + core product/variant architecture

- [ ] Update `product` schema — add pack return fields, model assignment
- [ ] Enhance `product-variant` schema — add TRADE/RETAIL types, conversion links, visibility rules
- [ ] Create `variant_conversion_map` table
- [ ] Create `product_pack_rules` table
- [ ] Update `inventories` schema — add `owner_type/owner_id`, remove `damaged_qty`
- [ ] Create immutable `stock_ledger` table
- [ ] Update user schema — add seller capability flags, area permissions
- [ ] Create `area/zone` management tables
- [ ] Create `sales_model` and `product_model_mapping` tables
- [ ] Admin UI: Product variant management (TRADE/RETAIL creation)
- [ ] Admin UI: Conversion rule manager

### Phase 2: B2B Order Flow (2-3 weeks)
> **Goal**: Super Seller → Shop Owner ordering

- [ ] B2B variant visibility (shop owners see only TRADE variants)
- [ ] B2B ordering flow for shop owners
- [ ] Auto-conversion engine (TRADE → RETAIL on B2B purchase)
- [ ] Stock ledger integration for all stock movements
- [ ] Stock reservation/locking system
- [ ] Admin: Stock ledger viewer
- [ ] Admin: Inventory reservation monitor
- [ ] Admin: Conversion job logs

### Phase 3: Enhanced Pricing & Product Control (1-2 weeks)
> **Goal**: Pricing rules + product assignment system

- [ ] Base price + minimum margin system
- [ ] Shop selling price management with 24h update enforcement
- [ ] Product model assignment to shops
- [ ] Product sell permission validation
- [ ] Admin: Price deviation alerts
- [ ] Admin: Product assignment panel

### Phase 4: Consumer Discovery & Store Pages (2-3 weeks)
> **Goal**: B2C shopping experience

- [ ] Consumer product discovery (homepage with seller counts)
- [ ] B2C variant visibility (consumers see only RETAIL variants)
- [ ] Seller public store pages (`/store/{slug}`)
- [ ] Unified search (Products, Sellers, Categories tabs)
- [ ] Area-based product/seller filtering
- [ ] Store offers tab

### Phase 5: Open Order + Negotiation System (3-4 weeks)
> **Goal**: The most complex new feature

- [ ] Open order broadcasting to eligible sellers
- [ ] Seller lock/pick mechanism
- [ ] 100-second negotiation timer
- [ ] Consumer offer review (multi-seller comparison)
- [ ] Order auto-split engine (cart → sub-orders)
- [ ] Master order + sub-order relationship
- [ ] OTP load control (max 2 pending per seller)
- [ ] Admin: Open order pool (live feed)
- [ ] Admin: Negotiation window monitor

### Phase 6: Pack Return & Delivery Enhancement (1-2 weeks)
> **Goal**: Pack deposit handling + delivery improvements

- [ ] Pack return configuration (admin defaults + seller override)
- [ ] Consumer order-time pack flow (old pack info / new deposit)
- [ ] Delivery confirmation with pack return check
- [ ] Platform vs shop delivery man distinction
- [ ] Admin: Pack deposit ledger

### Phase 7: Area Management & Compliance (1-2 weeks)
> **Goal**: Geo-based permissions and monitoring

- [ ] Area polygon manager
- [ ] Seller area mapping
- [ ] Order-area matching validation
- [ ] Seller compliance monitoring
- [ ] Admin: Area violation reports

### Phase 8: Advanced Reports & Analytics (1-2 weeks)
> **Goal**: Business intelligence

- [ ] Open order conversion rate
- [ ] B2B cart value analytics
- [ ] Pack return rates
- [ ] Seller performance reports
- [ ] Damage trend reports
- [ ] Price deviation analytics

---

> [!IMPORTANT]
> **Recommended approach**: Start with **Phase 1** (schema updates) since everything else depends on the data model. Then proceed with **Phase 2** (B2B flow) as the core business value. Phases can overlap once foundations are stable.

> [!NOTE]
> The existing admin already has a solid foundation with 38 pages. The main work is **extending schemas**, **adding new business logic** (conversion engine, negotiation, auto-split), and **building consumer-facing features** (store pages, discovery).
