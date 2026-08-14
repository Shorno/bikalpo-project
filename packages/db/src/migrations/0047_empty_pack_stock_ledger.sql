DO $$ BEGIN
 CREATE TYPE "empty_pack_movement_type" AS ENUM('exchange_in', 'damage', 'supplier_return', 'sale_application');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "seller_stock_consumed_at" timestamp;

CREATE TABLE IF NOT EXISTS "empty_pack_stock" (
  "id" serial PRIMARY KEY NOT NULL,
  "owner_type" "inventory_owner_type" NOT NULL,
  "owner_id" text NOT NULL,
  "variant_id" integer NOT NULL,
  "available_qty" integer DEFAULT 0 NOT NULL,
  "damaged_qty" integer DEFAULT 0 NOT NULL,
  "returned_qty" integer DEFAULT 0 NOT NULL,
  "applied_to_sales_qty" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "empty_pack_movement" (
  "id" serial PRIMARY KEY NOT NULL,
  "owner_type" "inventory_owner_type" NOT NULL,
  "owner_id" text NOT NULL,
  "variant_id" integer NOT NULL,
  "movement_type" "empty_pack_movement_type" NOT NULL,
  "quantity" integer NOT NULL,
  "order_id" integer,
  "order_item_id" integer,
  "source_key" text,
  "notes" text,
  "created_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "empty_pack_stock" ADD CONSTRAINT "empty_pack_stock_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "empty_pack_movement" ADD CONSTRAINT "empty_pack_movement_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "empty_pack_movement" ADD CONSTRAINT "empty_pack_movement_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "empty_pack_movement" ADD CONSTRAINT "empty_pack_movement_order_item_id_order_item_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_item"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "empty_pack_movement" ADD CONSTRAINT "empty_pack_movement_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "emptyPackStock_ownerVariant_unique" ON "empty_pack_stock" USING btree ("owner_type", "owner_id", "variant_id");
CREATE INDEX IF NOT EXISTS "emptyPackStock_owner_idx" ON "empty_pack_stock" USING btree ("owner_type", "owner_id");
CREATE INDEX IF NOT EXISTS "emptyPackMovement_owner_idx" ON "empty_pack_movement" USING btree ("owner_type", "owner_id");
CREATE INDEX IF NOT EXISTS "emptyPackMovement_variant_idx" ON "empty_pack_movement" USING btree ("variant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "emptyPackMovement_sourceKey_unique" ON "empty_pack_movement" USING btree ("source_key");

-- Preserve verified retailer empties that pre-date the balance table.
INSERT INTO "empty_pack_stock" ("owner_type", "owner_id", "variant_id", "available_qty")
SELECT 'shop', "shop_id", "variant_id", SUM("quantity_collected")::integer
FROM "empty_pack"
WHERE "shop_id" IS NOT NULL AND "variant_id" IS NOT NULL AND "status" = 'verified'
GROUP BY "shop_id", "variant_id"
ON CONFLICT ("owner_type", "owner_id", "variant_id") DO NOTHING;
