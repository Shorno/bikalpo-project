-- Carton Configuration System Migration
-- Adds carton_config, carton tables and updates stock_entry + inventory

-- 1. Create carton_status enum
DO $$ BEGIN
    CREATE TYPE "public"."carton_status" AS ENUM('active', 'broken', 'dispatched', 'sold');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add 'carton' to stock_entry_type enum
ALTER TYPE "stock_entry_type" ADD VALUE IF NOT EXISTS 'carton';

-- 3. Add 'per_carton' to stock_entry_cost_type enum
ALTER TYPE "stock_entry_cost_type" ADD VALUE IF NOT EXISTS 'per_carton';

-- 4. Create carton_config table
CREATE TABLE IF NOT EXISTS "carton_config" (
    "id" serial PRIMARY KEY NOT NULL,
    "variant_id" integer NOT NULL,
    "packs_per_carton" integer NOT NULL,
    "carton_weight_kg" numeric(12, 2) NOT NULL,
    "carton_price" numeric(10, 2) NOT NULL,
    "carton_cost_price" numeric(10, 2),
    "delivery_cost_per_carton" numeric(10, 2),
    "label" varchar(100),
    "is_default" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "carton_config_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variant"("id") ON DELETE CASCADE
);

-- 5. Create carton table
CREATE TABLE IF NOT EXISTS "carton" (
    "id" serial PRIMARY KEY NOT NULL,
    "carton_id" varchar(30) NOT NULL UNIQUE,
    "warehouse_id" text NOT NULL,
    "carton_config_id" integer,
    "variant_id" integer NOT NULL,
    "total_packs" integer NOT NULL,
    "total_weight_kg" numeric(12, 2) NOT NULL,
    "status" "carton_status" DEFAULT 'active' NOT NULL,
    "barcode" varchar(100),
    "qr_code" varchar(255),
    "broken_at" timestamp,
    "broken_by_id" text,
    "storage_area_id" integer,
    "note" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "carton_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "user"("id") ON DELETE CASCADE,
    CONSTRAINT "carton_carton_config_id_fkey" FOREIGN KEY ("carton_config_id") REFERENCES "carton_config"("id") ON DELETE SET NULL,
    CONSTRAINT "carton_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variant"("id") ON DELETE CASCADE,
    CONSTRAINT "carton_broken_by_id_fkey" FOREIGN KEY ("broken_by_id") REFERENCES "user"("id") ON DELETE SET NULL,
    CONSTRAINT "carton_storage_area_id_fkey" FOREIGN KEY ("storage_area_id") REFERENCES "warehouse_storage_area"("id") ON DELETE SET NULL
);

-- 6. Add carton tracking columns to inventory table
ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "in_carton_qty" numeric(12, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "active_carton_count" integer DEFAULT 0 NOT NULL;

-- 7. Add carton entry columns to stock_entry table
ALTER TABLE "stock_entry" ADD COLUMN IF NOT EXISTS "carton_count" integer;
ALTER TABLE "stock_entry" ADD COLUMN IF NOT EXISTS "carton_config_id" integer REFERENCES "carton_config"("id") ON DELETE SET NULL;
ALTER TABLE "stock_entry" ADD COLUMN IF NOT EXISTS "converted_qty_cartons" numeric(12, 2);

-- 8. Create indexes
CREATE INDEX IF NOT EXISTS "cartonConfig_variantId_idx" ON "carton_config" ("variant_id");
CREATE INDEX IF NOT EXISTS "carton_warehouseId_idx" ON "carton" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "carton_variantId_idx" ON "carton" ("variant_id");
CREATE INDEX IF NOT EXISTS "carton_status_idx" ON "carton" ("status");
CREATE INDEX IF NOT EXISTS "carton_cartonId_idx" ON "carton" ("carton_id");
