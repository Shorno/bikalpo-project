-- Monthly stock value per owner, for the Products page "vs last month" KPI and trend.
CREATE TABLE IF NOT EXISTS "owner_inventory_snapshot" (
  "id" serial PRIMARY KEY NOT NULL,
  "owner_type" "inventory_owner_type" NOT NULL,
  "owner_id" text NOT NULL,
  "month" text NOT NULL,
  "inventory_value" numeric(16, 2) DEFAULT '0' NOT NULL,
  "product_count" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "owner_inventory_snapshot_owner_month_unique"
  ON "owner_inventory_snapshot" USING btree ("owner_type", "owner_id", "month");
