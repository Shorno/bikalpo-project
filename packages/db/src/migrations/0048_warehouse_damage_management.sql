DO $$ BEGIN
  CREATE TYPE "public"."warehouse_damage_type" AS ENUM('physical', 'expired', 'lost');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."warehouse_damage_mode" AS ENUM('loose', 'pack', 'carton', 'direct');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."warehouse_damage_status" AS ENUM('posted', 'reversed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "public"."carton_status" ADD VALUE IF NOT EXISTS 'damaged';
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "public"."warehouse_damage_entry_no_seq" START WITH 1 INCREMENT BY 1;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "warehouse_damage_entry" (
  "id" serial PRIMARY KEY NOT NULL,
  "entry_no" varchar(30) NOT NULL,
  "request_key" varchar(64) NOT NULL,
  "warehouse_id" text NOT NULL,
  "damage_type" "warehouse_damage_type" NOT NULL,
  "damage_mode" "warehouse_damage_mode" NOT NULL,
  "description" text,
  "proof_images" text[] DEFAULT '{}'::text[] NOT NULL,
  "total_loss_value" numeric(14, 2) DEFAULT '0' NOT NULL,
  "entry_date" date NOT NULL,
  "status" "warehouse_damage_status" DEFAULT 'posted' NOT NULL,
  "created_by_id" text,
  "created_by_name" text NOT NULL,
  "reversed_at" timestamp,
  "reversed_by_id" text,
  "reversal_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "warehouse_damage_item" (
  "id" serial PRIMARY KEY NOT NULL,
  "damage_entry_id" integer NOT NULL,
  "inventory_id" integer NOT NULL,
  "variant_id" integer NOT NULL,
  "stock_entry_id" integer,
  "carton_id" integer,
  "quantity" numeric(12, 2) NOT NULL,
  "quantity_unit" varchar(30) NOT NULL,
  "unit_cost" numeric(14, 4) NOT NULL,
  "total_value" numeric(14, 2) NOT NULL,
  "sku_snapshot" varchar(100),
  "product_name_snapshot" text NOT NULL,
  "brand_name_snapshot" text,
  "variant_label_snapshot" text NOT NULL,
  "source_label_snapshot" text,
  "note" text
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "warehouse_damage_entry" ADD CONSTRAINT "warehouse_damage_entry_warehouse_id_user_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "warehouse_damage_entry" ADD CONSTRAINT "warehouse_damage_entry_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "warehouse_damage_entry" ADD CONSTRAINT "warehouse_damage_entry_reversed_by_id_user_id_fk" FOREIGN KEY ("reversed_by_id") REFERENCES "public"."user"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "warehouse_damage_item" ADD CONSTRAINT "warehouse_damage_item_damage_entry_id_fk" FOREIGN KEY ("damage_entry_id") REFERENCES "public"."warehouse_damage_entry"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "warehouse_damage_item" ADD CONSTRAINT "warehouse_damage_item_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "warehouse_damage_item" ADD CONSTRAINT "warehouse_damage_item_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "warehouse_damage_item" ADD CONSTRAINT "warehouse_damage_item_stock_entry_id_fk" FOREIGN KEY ("stock_entry_id") REFERENCES "public"."stock_entry"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "warehouse_damage_item" ADD CONSTRAINT "warehouse_damage_item_carton_id_fk" FOREIGN KEY ("carton_id") REFERENCES "public"."carton"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "warehouseDamage_entryNo_uq" ON "warehouse_damage_entry" ("entry_no");
CREATE UNIQUE INDEX IF NOT EXISTS "warehouseDamage_requestKey_uq" ON "warehouse_damage_entry" ("request_key");
CREATE INDEX IF NOT EXISTS "warehouseDamage_warehouseDate_idx" ON "warehouse_damage_entry" ("warehouse_id", "entry_date");
CREATE INDEX IF NOT EXISTS "warehouseDamage_type_idx" ON "warehouse_damage_entry" ("damage_type");
CREATE INDEX IF NOT EXISTS "warehouseDamage_mode_idx" ON "warehouse_damage_entry" ("damage_mode");
CREATE INDEX IF NOT EXISTS "warehouseDamage_status_idx" ON "warehouse_damage_entry" ("status");
CREATE INDEX IF NOT EXISTS "warehouseDamageItem_entry_idx" ON "warehouse_damage_item" ("damage_entry_id");
CREATE INDEX IF NOT EXISTS "warehouseDamageItem_variant_idx" ON "warehouse_damage_item" ("variant_id");
CREATE INDEX IF NOT EXISTS "warehouseDamageItem_stockEntry_idx" ON "warehouse_damage_item" ("stock_entry_id");
CREATE INDEX IF NOT EXISTS "warehouseDamageItem_carton_idx" ON "warehouse_damage_item" ("carton_id");
