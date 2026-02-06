# Bikalpo: B2B → B2B + B2C Development Roadmap

## Project Overview

**Current State:** B2B wholesale platform (~92% complete)  
**Target State:** Hybrid B2B + B2C marketplace with mobile support

### Business Model Change

```
Current:
Admin → Shop Owner (wholesale only)

New:
Admin (Super Seller) → Shop Owner (B2B wholesale)
Shop Owner → Consumer (B2C retail)
```

---

## Architecture Change

The current system uses Next.js server actions (tightly coupled). We need to:

1. Build standalone REST APIs
2. Connect Next.js frontend to these APIs  
3. Make APIs ready for future mobile app (iOS/Android)

---

# Development Phases

---

## PHASE 1: API Layer Setup

### Goal
Create a separate API server that both web and mobile apps can use.

### What We Build
- New API project with proper structure
- User authentication (login, register, logout)
- Token-based security for mobile apps
- API documentation for developers

### Migration Tasks
- Move all existing B2B features to new APIs
- Connect Next.js frontend to use new APIs
- Test all existing functionality works the same

---

## PHASE 2: Complete B2B Features

### Goal
Finish the remaining 8% of B2B features before adding B2C.

### Features to Complete
- **Allowed Devices** — Track and manage devices that can access accounts
- **Audit Logs** — Record all important actions for security
- **Stock Reorder Alerts** — Notify when stock is low
- **Delivery Cost Calculator** — Calculate delivery fees
- **Document Uploads** — Trade license, ID verification for customers

---

## PHASE 3: Database Updates

### Goal
Add new tables and fields needed for B2C functionality.

### New User Fields
- User type (consumer, shop owner, employee, admin)
- Seller status (pending, approved, rejected)
- Shop profile information (logo, description, hours)

### New Tables Needed
| Table | Purpose |
|-------|---------|
| Product Variants | TRADE (wholesale) and RETAIL (consumer) versions |
| Inventory by Owner | Track stock separately for admin and each shop |
| Stock Ledger | History of all stock movements |
| Open Orders | Orders waiting for seller acceptance |
| Sub Orders | Split orders when multiple sellers needed |
| Service Areas | Geographic zones for delivery |
| Seller Permissions | Which areas each seller can serve |

---

## PHASE 4: Product Variant System

### Goal
Create two versions of each product — wholesale and retail.

### How It Works

**TRADE Variants (B2B)**
- Visible only to Shop Owners
- Sold in bulk (cartons, sacks)
- Example: Rice 50kg Carton

**RETAIL Variants (B2C)**  
- Visible only to Consumers
- Sold in small packs
- Example: Rice 5kg Packet

### Auto-Conversion
When shop buys wholesale, system auto-converts to retail units:
- Shop buys: 2 Cartons (50kg each)
- System creates: 20 Retail Packets (5kg each)

---

## PHASE 5: Inventory System

### Goal
Track stock separately for Admin (Super Seller) and each Shop.

### Stock Flow
```
Admin Inventory (wholesale stock)
       ↓ Shop places B2B order
Shop Inventory (auto-converted to retail)
       ↓ Consumer places B2C order
Consumer receives product
```

### Key Features
- Every stock change is recorded in ledger (cannot be edited)
- Stock reservation when order is placed
- OTP verification limits (max 2 pending per seller)

---

## PHASE 6: Pricing System

### Goal
Allow shops to set their own selling prices with rules.

### Price Levels
| Who | Sets What |
|-----|-----------|
| Admin | Base price + minimum margin |
| Shop Owner | Selling price (must be above base + margin) |

### Rules
- Shop must update prices at least once every 24 hours
- Products hidden if prices are stale
- Consumer sees both platform price and shop price

---

## PHASE 7: Consumer Flow

### Goal
Add consumer account type and seller upgrade process.

### Consumer Journey
1. User signs up → automatically becomes Consumer
2. Can browse and buy from shops (B2C)
3. Optional: Apply to become Seller

### Seller Upgrade Process
1. Consumer clicks "Become a Business Seller"
2. Submits documents (trade license, ID, address proof)
3. Admin reviews and approves/rejects
4. If approved, account upgraded to Shop Owner

---

## PHASE 8: B2C Order System

### Goal
Allow consumers to buy from shops with optional price negotiation.

### Order Types

**Direct Order**
- Consumer selects specific shop
- Buys at shop's listed price
- Simple checkout

**Open Order (New Feature)**
1. Consumer places order without selecting shop
2. System broadcasts to nearby eligible sellers
3. First seller to accept "locks" the order
4. Seller has 100 seconds to submit price offer
5. Consumer reviews and accepts/rejects
6. Order confirmed or re-broadcast

### Order Auto-Split
If no single seller has all items:
- System splits into multiple sub-orders
- Each sub-order goes to different seller
- Consumer sees unified order view

### OTP Confirmation
- OTP sent when delivery picks up
- Consumer verifies with OTP
- Sellers limited to 2 pending OTPs

---

## PHASE 9: Seller Store Pages

### Goal
Give each shop owner a public storefront.

### Store Features
- Public URL: `bikalpo.com/store/shop-name`
- QR code for easy sharing
- Products tab with prices
- Offers/promotions tab
- About section (hours, address, policies)
- Customer reviews

### Visibility Rules
Store only visible when:
- Seller is approved and enabled
- Has stock available
- Prices updated within 24 hours
- Serving the customer's area

---

## PHASE 10: Seller Dashboard

### Goal
Add B2C order management for shop owners.

### New Features
- View incoming B2C orders
- Accept/reject open orders
- Set and update retail prices
- View retail inventory (read-only)
- Report damaged stock
- View sales analytics

### Daily Tasks
- Update prices (required every 24h)
- Check open order notifications
- Manage deliveries

---

## PHASE 11: Delivery & Returns

### Goal
Support B2C delivery and unified return system.

### B2C Delivery
- Assign delivery person to B2C orders
- Track pickup and delivery
- Collect COD payments
- Handle pack returns at delivery

### Unified Returns
Both B2B and B2C returns handled in same system:
- Consumer → Shop (B2C return)
- Shop → Admin (B2B return)

### Pack Return Flow
1. Consumer asked if returning old pack
2. If no pack, deposit charged
3. Delivery confirms pack return
4. Deposit refunded or kept

---

## PHASE 12: Area & Permissions

### Goal
Control which shops can serve which areas.

### Features
- Define service areas on map
- Assign areas to each seller
- Optional radius-based permissions
- Filter open orders by seller's area
- Location-based seller discovery

---

## PHASE 13: Admin Enhancements

### Goal
Add tools for managing B2C operations.

### Seller Management
- View all seller applications
- Approve/reject/suspend sellers
- Assign areas to sellers
- Enable/disable seller stores

### Open Order Monitoring
- Live view of open order pool
- Track negotiations in progress
- Reset stuck OTPs
- View expired/failed orders

### Platform Settings
- Negotiation timeout (default 100 sec)
- Max pending OTPs (default 2)
- Price update window (default 24 hours)
- Pack deposit amounts

### New Reports
- B2C sales by area
- Open order conversion rates
- Seller performance metrics
- Area-wise demand analysis

---

# Phase Summary

| Phase | Focus |
|-------|-------|
| 1 | API Layer — Separate backend for web + mobile |
| 2 | B2B Gaps — Complete remaining B2B features |
| 3 | Database — Add new tables for B2C |
| 4 | Variants — Wholesale vs Retail products |
| 5 | Inventory — Owner-based stock tracking |
| 6 | Pricing — Multi-level price management |
| 7 | Consumer — New user type + seller upgrade |
| 8 | B2C Orders — Direct + Open order system |
| 9 | Stores — Public shop pages |
| 10 | Seller App — B2C dashboard for shops |
| 11 | Delivery — B2C delivery + returns |
| 12 | Areas — Geographic permissions |
| 13 | Admin — B2C management tools |

---

# Key Business Rules

### User Roles

| Role | Can Buy | Can Sell |
|------|---------|----------|
| Consumer | ✅ B2C | ❌ |
| Shop Owner | ✅ B2B | ✅ B2C (if approved) |
| Employee | ❌ | ❌ (operations only) |
| Admin | ❌ | ✅ B2B |

### Stock Flow
```
Admin Stock → B2B Sale → Shop Stock → B2C Sale → Consumer
```

### Pricing Chain
```
Admin sets: Base Price + Min Margin
Shop sets: Selling Price (≥ Base + Margin)
Consumer pays: Shop's Selling Price
```

### Open Order Rules
- Max 2 pending OTPs per seller
- 100 second negotiation window
- Auto-expire if no response
- Re-broadcast on rejection
