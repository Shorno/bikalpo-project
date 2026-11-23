-- Client Create Product layout: Inventory Unit, Conversion text, the two
-- variant attributes (with the client's option lists), Delivery Cost
-- Counting and Unlisted visibility.
ALTER TYPE "product_visibility" ADD VALUE IF NOT EXISTS 'unlisted';--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "inventory_unit" varchar(20);--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "conversion_rule" varchar(60);--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "variant_attr_1" varchar(50);--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "variant_attr_2" varchar(50);--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "delivery_cost_method" varchar(30);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "variant_attribute" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(50) NOT NULL,
  "options" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "variant_attribute_name_unique" UNIQUE("name")
);--> statement-breakpoint
INSERT INTO "variant_attribute" ("name", "options", "sort_order") VALUES
('Type', '["New","Exchange","Refill","Regular","Premium","Standard"]'::jsonb, 0),
  ('Size', '["XS","S","M","L","XL","XXL","XXXL","28","30","32","34","36","38","39","40","41","42","43","44","12 KG","16 KG","30 KG","33 KG"]'::jsonb, 1),
  ('Weight', '["50g","100g","250g","500g","750g","1KG","2KG","5KG","10KG","15KG","20KG","25KG","30KG","50KG"]'::jsonb, 2),
  ('Pack', '["1 Pack","2 Pack","24 Pack","Single Pack","Family Pack","Combo Pack"]'::jsonb, 3),
  ('Brand', '["ACI","PRAN","Unilever","Bashundhara","Omera","Jamuna","Fresh","RFL","Walton","Samsung","Apple","Local Brand"]'::jsonb, 4),
  ('Colour', '["Black","White","Red","Blue","Green","Yellow","Brown","Grey","Pink","Purple","Orange","Navy Blue","Silver","Golden"]'::jsonb, 5),
  ('Model', '["Custom Model"]'::jsonb, 6),
  ('Storage', '["4/64GB","4/128GB","6/128GB","8/128GB","8/256GB","12/256GB","12/512GB","16/512GB","1TB"]'::jsonb, 7),
  ('Capacity', '["1L","2L","5L","10L","20L"]'::jsonb, 8),
  ('Quality', '["Premium","Standard","Regular","Grade A","Grade B","Grade C","Organic","Imported","Local"]'::jsonb, 9),
  ('Grade', '["Grade A","Grade B","Grade C"]'::jsonb, 10)
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
-- Older products: the delivery cost unit becomes the matching method.
UPDATE "product" SET "delivery_cost_method" = CASE "delivery_cost_unit"
  WHEN 'kg' THEN 'per_kg'
  WHEN 'liter' THEN 'per_litre'
  WHEN 'box' THEN 'per_box'
  ELSE 'per_unit'
END
WHERE "delivery_cost_unit" IS NOT NULL AND "delivery_cost_method" IS NULL;
