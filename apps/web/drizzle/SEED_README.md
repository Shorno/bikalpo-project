# Seed Script Instructions

## Running the Seed Script

```bash
# From project root
npx tsx drizzle/seed.ts
```

### Expected Output
```
🌱 Starting seed script...
   Environment: development

📁 Seeding categories...
   ✅ 5 categories processed

📦 Seeding products...
   ✅ 50 products processed

🎉 Seed completed successfully!
```

---

## Verifying Seeded Data

### Option 1: Check via Browser
Visit: http://localhost:3000/products

You should see:
- 50 products displayed
- Category filter dropdown with 5 options
- Price filter working

### Option 2: SQL Queries

Connect to your PostgreSQL database and run:

```sql
-- Count products
SELECT COUNT(*) as total_products FROM product;
-- Expected: 50

-- Count categories
SELECT COUNT(*) as total_categories FROM category;
-- Expected: 5

-- View seeded categories
SELECT id, name, slug FROM category ORDER BY display_order;

-- View products by category
SELECT 
  c.name as category,
  COUNT(p.id) as product_count
FROM product p
JOIN category c ON p.category_id = c.id
GROUP BY c.name
ORDER BY c.name;
```

---

## Testing Filters with SQL

### Filter by Category
```sql
-- Products in 'electronics' category
SELECT p.name, p.price, c.slug as category
FROM product p
JOIN category c ON p.category_id = c.id
WHERE c.slug = 'electronics'
ORDER BY p.created_at DESC;
```

### Filter by Price Range
```sql
-- Products between 500 and 2000
SELECT name, price 
FROM product 
WHERE CAST(price AS DECIMAL) >= 500 
  AND CAST(price AS DECIMAL) <= 2000
ORDER BY price;
```

### Combined Filter (Category + Price)
```sql
-- Electronics under 1000
SELECT p.name, p.price, c.slug as category
FROM product p
JOIN category c ON p.category_id = c.id
WHERE c.slug = 'electronics'
  AND CAST(p.price AS DECIMAL) <= 1000
ORDER BY p.price;
```

### Verify "Newest First" Sorting
```sql
-- Check created_at dates
SELECT name, created_at 
FROM product 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## Re-running the Seed

The script is **idempotent** — safe to run multiple times.

```bash
npx tsx drizzle/seed.ts
```

Existing records (matched by slug) are skipped via `ON CONFLICT DO NOTHING`.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot connect to database" | Check `DATABASE_URL` in `.env` |
| "Seed cannot run in production" | Ensure `NODE_ENV !== 'production'` |
| Products not showing | Check category IDs match |
