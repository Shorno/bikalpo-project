# Unified Offer System - Implementation Guide

## Overview

The offer system has been unified to support **4 offer types** with products lists, pricing tiers, and all necessary fields in a single table. This consolidates the previous separate "offers" and "combo offers" functionality.

## Offer Types

1. **Weekly Offers** - Time-limited weekly promotions
2. **Combo Deals** - Product bundle deals
3. **Brand Campaigns** - Brand-specific campaigns
4. **More Offers** - General/miscellaneous offers

## Database Schema Updates

### New Columns Added to `offer` Table

```typescript
// /packages/db/src/schema/offer.ts

export const offer = pgTable("offer", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 100 }).default("Weekly Offers").notNull(),
  // NEW: Offer type selector

  discountPercentage: integer("discount_percentage").notNull(),
  originalPrice: integer("original_price"),
  // NEW: Original price before discount

  comboPrice: integer("combo_price"),
  // NEW: Final combo/sale price

  bannerImage: text("banner_image"),
  // NEW: Cloudinary image URL for offer banner

  products: text("products"),
  // NEW: JSON array of product names ["Product 1", "Product 2"]

  targetProducts: text("target_products"),
  // LEGACY: Kept for backward compatibility

  active: boolean("active").default(true),
  startDate: varchar("start_date", { length: 20 }),
  endDate: varchar("end_date", { length: 20 }),
  priority: integer("priority").default(0),
  badge: varchar("badge", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

## API Endpoints Updated

### `/admin/offers` Routes

**GET /admin/offers**

- Returns all offers sorted by priority and creation date
- Supports filtering by type on frontend

**POST /admin/offers** - Create new offer

```json
{
  "title": "String (3+ chars)",
  "description": "String (optional)",
  "type": "Weekly Offers | Combo Deals | Brand Campaigns | More Offers",
  "discountPercentage": 0-100,
  "originalPrice": number,
  "comboPrice": number,
  "bannerImage": "URL string",
  "products": "[\"Product A\", \"Product B\"]",
  "badge": "String (optional)",
  "priority": number,
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "active": boolean
}
```

**PUT /admin/offers/update** - Update existing offer

```json
{
  "id": number,
  "data": { /* same as POST body, all fields optional */ }
}
```

**PATCH /admin/offers/toggle-active** - Toggle offer visibility

```json
{
  "id": number,
  "active": boolean
}
```

**DELETE /admin/offers/delete** - Delete offer

```json
{
  "id": number
}
```

## Frontend Components Updated

### 1. **Offer Form** (`/apps/web/components/admin/offers/offer-form.tsx`)

New form fields added:

- **Type Selector** - Dropdown with 4 offer types
- **Original Price** - Input field (number)
- **Combo Price** - Input field (number)
- **Discount %** - Adjusted to allow 0-100 (was 1-100)
- **Products List** - Textarea with JSON array input
- **Banner Image** - Cloudinary image uploader
- **Badge** - Dropdown selector (New, Hot Deal, Limited Time, etc.)

### 2. **Offer Columns** (`/apps/web/components/admin/offers/offer-columns.tsx`)

New table column added:

- **Type** - Shows offer type as badge (Weekly Offers, Combo Deals, etc.)

Display columns now include:

1. Title & Description
2. **Type** (NEW)
3. Discount %
4. Badge
5. Priority
6. Status (Active/Inactive)
7. Created Date
8. Actions (Edit, Toggle, Delete)

### 3. **Offer Management** (`/apps/web/components/admin/offers/offer-management.tsx`)

- Stats cards show Total/Active/Inactive offers
- Data table displays all offers with new Type column
- Edit/Delete/Toggle functionality
- API integration with React Query

## Migration Steps

### Step 1: Run Database Migration

Option A - Using Drizzle CLI:

```bash
cd packages/db
pnpm db:push
```

Option B - Run SQL manually:

```bash
psql -U your_user -d your_db < migrations/add_offer_types.sql
```

The migration adds:

- `type` column (defaults to "Weekly Offers")
- `original_price` column
- `combo_price` column
- `banner_image` column
- `products` column
- Indices for faster type filtering

### Step 2: Restart Development Server

```bash
pnpm dev
```

### Step 3: Test Admin Dashboard

Navigate to `/dashboard/admin/offers` and:

1. Click "New Offer"
2. Fill in all fields including:
   - Select an Offer Type
   - Enter products as JSON array
   - Upload banner image
   - Set pricing (original, combo, discount)
3. Click Create
4. Verify offer appears in table with Type column
5. Test Edit/Delete functionality

## Form Validation

### Offer Type

- Required field
- One of: "Weekly Offers", "Combo Deals", "Brand Campaigns", "More Offers"

### Products List

- Optional JSON array format
- Example: `["Potato Chips", "Energy Biscuit", "Apple Juice"]`
- Must be valid JSON if provided

### Pricing

- discountPercentage: 0-100
- originalPrice: Any positive number
- comboPrice: Any positive number

### Dates

- startDate/endDate: Optional, ISO format (YYYY-MM-DD)

## Usage Examples

### Create Weekly Offer

```json
{
  "title": "Weekend Special",
  "description": "Get 20% off on snacks",
  "type": "Weekly Offers",
  "discountPercentage": 20,
  "originalPrice": 500,
  "comboPrice": 400,
  "products": "[\"Chips\", \"Biscuits\", \"Juice\"]",
  "badge": "Hot Deal",
  "priority": 1,
  "active": true
}
```

### Create Combo Deal

```json
{
  "title": "Family Combo Bundle",
  "description": "Perfect for family gatherings",
  "type": "Combo Deals",
  "discountPercentage": 35,
  "originalPrice": 2000,
  "comboPrice": 1300,
  "products": "[\"Rice 5kg\", \"Dal 2kg\", \"Oil 2L\", \"Salt 1kg\"]",
  "badge": "Limited Time",
  "priority": 2,
  "active": true
}
```

### Create Brand Campaign

```json
{
  "title": "Local Brands Festival",
  "description": "Support local businesses",
  "type": "Brand Campaigns",
  "discountPercentage": 15,
  "products": "[\"Brand A Products\", \"Brand B Products\"]",
  "badge": "Exclusive",
  "priority": 3,
  "active": true
}
```

## Filtering Offers by Type (Frontend)

When displaying offers to customers, filter by type:

```typescript
// Example: Get all Weekly Offers
const weekly Offers = offers.filter(o => o.type === "Weekly Offers" && o.active);

// Get all Combo Deals
const combos = offers.filter(o => o.type === "Combo Deals" && o.active);

// Get Brand Campaigns
const campaigns = offers.filter(o => o.type === "Brand Campaigns" && o.active);
```

## API Integration (Frontend)

```typescript
import { client } from "@/utils/orpc";

// Fetch all offers
const offers = await client.adminOffer.getAll();

// Create new offer
await client.adminOffer.create({
  title: "New Offer",
  type: "Weekly Offers",
  discountPercentage: 20,
  products: '["Product A", "Product B"]',
  active: true,
  // ... other fields
});

// Update offer
await client.adminOffer.update({
  id: 1,
  data: {
    type: "Combo Deals",
    discountPercentage: 30,
  },
});

// Toggle active status
await client.adminOffer.toggleActive({ id: 1, active: false });

// Delete offer
await client.adminOffer.delete({ id: 1 });
```

## Backward Compatibility

- Old `imageUrl` column renamed to `bannerImage` (legacy support maintained)
- `targetProducts` column kept for legacy data but superseded by `products`
- Existing offers will default type="Weekly Offers"

## Files Modified

1. **Database Schema**
   - `/packages/db/src/schema/offer.ts` - Added type, prices, products columns

2. **API Routers**
   - `/packages/api/src/routers/admin-offer.ts` - Updated input schema and handlers

3. **Frontend Components**
   - `/apps/web/components/admin/offers/offer-form.tsx` - New form with type selector and products
   - `/apps/web/components/admin/offers/offer-columns.tsx` - Added type column to table
   - `/apps/web/components/admin/offers/offer-management.tsx` - No changes (uses updated form/columns)

4. **Migration Script**
   - `/packages/db/migrations/add_offer_types.sql` - SQL migration for adding columns

## No Changes Needed

The following does NOT need changes:

- Customer-facing offer display (will automatically show type-based filtering)
- Combo offers section (now merged into unified offers system)
- Admin sidebar navigation (already set up)

## Troubleshooting

### Issue: "type is not a column" error

**Solution**: Run the database migration:

```bash
cd packages/db && pnpm db:push
```

### Issue: Form won't submit with products

**Solution**: Ensure products is valid JSON:

```json
// ✅ Correct
["Product A", "Product B"]

// ❌ Incorrect
Product A, Product B
```

### Issue: Image not uploading

**Solution**: Ensure `bannerImage` field uses the updated ImageUploader with correct props

## Performance Considerations

- Indices added on `type` and `(active, type)` for faster filtering
- Offers sorted by priority DESC, then createdAt DESC
- Consider pagination for large offer lists (>1000 offers)

## Next Steps After Migration

1. Create sample offers of each type
2. Update customer-facing pages to filter by type
3. Add type-based display sections on homepage
4. Test admin CRUD operations
5. Deploy to production with migration

---

**Last Updated**: March 14, 2026
**Version**: 1.0
