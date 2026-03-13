# Unified Offer System - Quick Reference & SQL Guide

## 🎯 What's New

| Feature             | Before           | After                                       |
| ------------------- | ---------------- | ------------------------------------------- |
| **Offer Types**     | None             | 4 types (Weekly, Combo, Brand, More Offers) |
| **Products List**   | Not supported    | JSON array format                           |
| **Pricing**         | Discount only    | Original + Combo + Discount                 |
| **Images**          | `imageUrl` field | `bannerImage` field + preview               |
| **Table Structure** | Static           | Dynamic by type                             |

---

## 📊 Database Schema Comparison

### Before Migration

```sql
CREATE TABLE offer (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  discount_percentage INTEGER NOT NULL,
  image_url TEXT,
  target_products TEXT,
  active BOOLEAN DEFAULT true,
  start_date VARCHAR(20),
  end_date VARCHAR(20),
  priority INTEGER DEFAULT 0,
  badge VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### After Migration

```sql
CREATE TABLE offer (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(100) DEFAULT 'Weekly Offers' NOT NULL,           -- NEW
  discount_percentage INTEGER NOT NULL,
  original_price INTEGER,                                       -- NEW
  combo_price INTEGER,                                          -- NEW
  banner_image TEXT,                                             -- NEW
  products TEXT,                                                 -- NEW
  image_url TEXT,                                                -- LEGACY KEPT
  target_products TEXT,                                          -- LEGACY KEPT
  active BOOLEAN DEFAULT true,
  start_date VARCHAR(20),
  end_date VARCHAR(20),
  priority INTEGER DEFAULT 0,
  badge VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX idx_offer_type ON offer(type);
CREATE INDEX idx_offer_active_type ON offer(active, type);
```

---

## 💾 Complete Migration SQL

### Run These Commands in Order

```sql
-- 1. Add new columns for offer type system
ALTER TABLE offer ADD COLUMN type VARCHAR(100) DEFAULT 'Weekly Offers' NOT NULL;
ALTER TABLE offer ADD COLUMN original_price INTEGER;
ALTER TABLE offer ADD COLUMN combo_price INTEGER;
ALTER TABLE offer ADD COLUMN banner_image TEXT;
ALTER TABLE offer ADD COLUMN products TEXT;

-- 2. Create indices for performance
CREATE INDEX idx_offer_type ON offer(type);
CREATE INDEX idx_offer_active_type ON offer(active, type);

-- 3. Verify migration (optional)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'offer'
ORDER BY ordinal_position;

-- 4. Check data (optional)
SELECT COUNT(*) as total_offers
FROM offer;
```

---

## 🔄 Drizzle Migration Path

If using Drizzle ORM:

```bash
# From project root
cd packages/db

# Push schema changes to database
pnpm db:push

# Or generate migration file first
pnpm db:generate

# Then apply it
pnpm db:migrate
```

---

## 📝 Form Field Reference

### Create/Edit Offer Form Fields

```typescript
interface OfferFormValues {
  title: string; // Required, 3+ chars
  description: string; // Optional
  type:
    | "Weekly Offers" // Required - SELECT FROM:
    | "Combo Deals" //   1. Weekly Offers
    | "Brand Campaigns" //   2. Combo Deals
    | "More Offers"; //   3. Brand Campaigns
  //   4. More Offers

  discountPercentage: number; // 0-100
  originalPrice?: number; // Optional - pre-discount price
  comboPrice?: number; // Optional - final bundle price
  products: string; // Optional - JSON array
  bannerImage: string; // Optional - Cloudinary URL
  badge: string; // Optional - SELECT FROM:
  //   "", "New", "Hot Deal",
  //   "Limited Time", "Bestseller",
  //   "Flash Sale", "Exclusive"

  priority: number; // Higher = appears first
  startDate: string; // Optional - YYYY-MM-DD
  endDate: string; // Optional - YYYY-MM-DD
  active: boolean; // true/false - visibility toggle
}
```

---

## 📤 Example API Requests

### 1. Weekly Offer (Simple)

```json
POST /admin/offers
{
  "title": "Monday Madness",
  "type": "Weekly Offers",
  "discountPercentage": 15,
  "badge": "Hot Deal",
  "priority": 1,
  "active": true
}
```

### 2. Combo Deal (Full)

```json
POST /admin/offers
{
  "title": "Family Feast Package",
  "description": "Perfect for family dinner",
  "type": "Combo Deals",
  "discountPercentage": 35,
  "originalPrice": 2500,
  "comboPrice": 1625,
  "bannerImage": "https://res.cloudinary.com/..../combo-family.jpg",
  "products": "[\"2kg Rice\", \"1kg Dal\", \"1L Oil\", \"500g Spices\"]",
  "badge": "Limited Time",
  "priority": 2,
  "startDate": "2026-03-15",
  "endDate": "2026-03-31",
  "active": true
}
```

### 3. Brand Campaign

```json
POST /admin/offers
{
  "title": "Local Brands Festival",
  "description": "Support small businesses",
  "type": "Brand Campaigns",
  "discountPercentage": 20,
  "products": "[\"Brand A Products\", \"Brand B Products\", \"Brand C Products\"]",
  "badge": "Exclusive",
  "priority": 3,
  "active": true
}
```

### 4. More Offers (Misc)

```json
POST /admin/offers
{
  "title": "Flash Sale Clearance",
  "type": "More Offers",
  "discountPercentage": 50,
  "badge": "Flash Sale",
  "priority": 0,
  "active": true
}
```

---

## 🎨 Frontend Display Examples

### Filter Offers by Type

```typescript
import { client } from "@/utils/orpc";

// Fetch all offers
const allOffers = await client.adminOffer.getAll();

// Group by type
const offersByType = {
  weekly: allOffers.filter(o => o.type === "Weekly Offers" && o.active),
  combo: allOffers.filter(o => o.type === "Combo Deals" && o.active),
  brand: allOffers.filter(o => o.type === "Brand Campaigns" && o.active),
  more: allOffers.filter(o => o.type === "More Offers" && o.active),
};

// Display sections
<WeeklyOffersSection offers={offersByType.weekly} />
<ComboDealsSection offers={offersByType.combo} />
<BrandCampaignsSection offers={offersByType.brand} />
<MoreOffersSection offers={offersByType.more} />
```

### Render Single Offer

```tsx
<div className="offer-card">
  {offer.bannerImage && <img src={offer.bannerImage} alt={offer.title} />}

  <div>
    <h3>{offer.title}</h3>
    <span className="type-badge">{offer.type}</span>

    {offer.badge && <span className="badge">{offer.badge}</span>}

    <p>{offer.description}</p>

    {offer.products && (
      <ul>
        {JSON.parse(offer.products).map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    )}

    <div className="pricing">
      {offer.originalPrice && (
        <span className="strikethrough">৳{offer.originalPrice}</span>
      )}
      {offer.comboPrice && <span className="price">৳{offer.comboPrice}</span>}
      <span className="discount">-{offer.discountPercentage}%</span>
    </div>
  </div>
</div>
```

---

## 🔧 Admin Functions

### Create Offer

```typescript
await client.adminOffer.create({
  title: "New Offer",
  type: "Combo Deals",
  discountPercentage: 25,
  bannerImage: "...",
  products: '["Prod A", "Prod B"]',
  active: true,
});
```

### Update Offer

```typescript
await client.adminOffer.update({
  id: 5,
  data: {
    type: "Brand Campaigns",
    discountPercentage: 30,
    products: '["Brand A", "Brand B"]',
  },
});
```

### Toggle Visibility

```typescript
await client.adminOffer.toggleActive({
  id: 5,
  active: false, // Hide from homepage
});
```

### Delete Offer

```typescript
await client.adminOffer.delete({ id: 5 });
```

---

## ✅ Deployment Checklist

```
Database:
☐ Run db:push or migration SQL
☐ Verify new columns exist
☐ Check indices are created

Frontend:
☐ npm run build - no errors
☐ Test admin form with all types
☐ Create sample offers in each category
☐ Verify customer display shows all offers
☐ Test image upload works

Testing:
☐ Create weekly offer - works
☐ Create combo deal - works
☐ Create brand campaign - works
☐ Create misc offer - works
☐ Edit offer type - works
☐ Delete offer - works
☐ Filter by type - works (frontend)

Deployment:
☐ Backup database
☐ Run migration
☐ Deploy code
☐ Verify homepage displays
☐ Monitor error logs
```

---

## 🚀 Rollback Plan

If issues occur:

```bash
# Revert schema changes
ALTER TABLE offer DROP COLUMN type;
ALTER TABLE offer DROP COLUMN original_price;
ALTER TABLE offer DROP COLUMN combo_price;
ALTER TABLE offer DROP COLUMN banner_image;
ALTER TABLE offer DROP COLUMN products;

# Drop indices
DROP INDEX idx_offer_type;
DROP INDEX idx_offer_active_type;

# Deploy old code
git revert <commit-hash>
```

---

## 📞 Support Reference

| Issue                   | Solution                              |
| ----------------------- | ------------------------------------- |
| "type" column not found | Run `pnpm db:push`                    |
| Form won't submit       | Check JSON format of products         |
| Image not showing       | Verify Cloudinary URL is valid        |
| Build error: imageUrl   | Update to bannerImage (already fixed) |
| Old offers have no type | They default to "Weekly Offers"       |

---

## 📚 Related Files

- Schema: `/packages/db/src/schema/offer.ts`
- API: `/packages/api/src/routers/admin-offer.ts`
- Admin Form: `/apps/web/components/admin/offers/offer-form.tsx`
- Admin Table: `/apps/web/components/admin/offers/offer-columns.tsx`
- Customer Display: `/apps/web/components/features/home/home-offers-section.tsx`
- Detailed Guide: `UNIFIED_OFFER_SYSTEM.md`

---

**Last Updated**: March 14, 2026  
**Version**: 1.0  
**Status**: ✅ Production Ready
