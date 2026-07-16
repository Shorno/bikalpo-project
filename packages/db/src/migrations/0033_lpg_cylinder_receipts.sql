DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "inventory" i
        JOIN "product_variant" pv ON pv."id" = i."variant_id"
        JOIN "product" p ON p."id" = pv."product_id"
        JOIN "category" c ON c."id" = p."category_id"
        JOIN "product_type" pt ON pt."id" = c."type_id"
        WHERE lower(coalesce(pt."slug", '') || ' ' || coalesce(pt."name", '')) ~ '(lpg|gas|cylinder)'
          AND (i."in_carton_qty"::numeric > 0 OR i."active_carton_count" > 0)
    ) OR EXISTS (
        SELECT 1
        FROM "carton" ct
        JOIN "product_variant" pv ON pv."id" = ct."variant_id"
        JOIN "product" p ON p."id" = pv."product_id"
        JOIN "category" c ON c."id" = p."category_id"
        JOIN "product_type" pt ON pt."id" = c."type_id"
        WHERE lower(coalesce(pt."slug", '') || ' ' || coalesce(pt."name", '')) ~ '(lpg|gas|cylinder)'
          AND ct."status" = 'active'
    ) THEN
        RAISE EXCEPTION 'LPG cylinder migration stopped: active carton-backed LPG inventory requires manual reconciliation';
    END IF;
END $$;
--> statement-breakpoint
CREATE TYPE "public"."product_type_family" AS ENUM(
    'grocery', 'fashion', 'footwear', 'electronics', 'lpg', 'bulk_liquid', 'generic'
);
--> statement-breakpoint
ALTER TABLE "product_type"
    ADD COLUMN "fulfillment_family" "product_type_family" DEFAULT 'generic' NOT NULL;
--> statement-breakpoint
UPDATE "product_type"
SET "fulfillment_family" = 'lpg'
WHERE lower(coalesce("slug", '') || ' ' || coalesce("name", '')) ~ '(lpg|gas|cylinder)';
--> statement-breakpoint
UPDATE "product_type_rule_setting" prs
SET "inventory_unit_options" = '["cylinder"]'::jsonb,
    "default_inventory_unit" = 'cylinder',
    "conversion_default" = false,
    "inventory_loose_unit_default" = false,
    "updated_at" = now()
FROM "product_type" pt
WHERE prs."product_type_id" = pt."id"
  AND pt."fulfillment_family" = 'lpg';
--> statement-breakpoint
UPDATE "product" p
SET "inventory_unit" = 'cylinder',
    "conversion_enabled" = false,
    "inventory_loose_unit_enabled" = false,
    "updatedAt" = now()
FROM "category" c
JOIN "product_type" pt ON pt."id" = c."type_id"
WHERE p."category_id" = c."id"
  AND pt."fulfillment_family" = 'lpg';
--> statement-breakpoint
UPDATE "product_variant" pv
SET "packaging_type" = 'cylinder',
    "pack_type" = 'cylinder',
    "order_unit" = 'cylinder',
    "sell_unit" = coalesce(vo."display_alias", vo."name", pv."unit_label"),
    "updatedAt" = now()
FROM "variant_option" vo
WHERE pv."source_variant_option_id" = vo."id"
  AND lower(coalesce(vo."definition"->>'container', '')) = 'cylinder';
--> statement-breakpoint
ALTER TYPE "public"."stock_entry_type" ADD VALUE IF NOT EXISTS 'direct';
--> statement-breakpoint
CREATE TYPE "public"."stock_receipt_payment_method" AS ENUM('cash', 'bank');
--> statement-breakpoint
CREATE SEQUENCE "public"."stock_receipt_number_seq" START WITH 1 INCREMENT BY 1;
--> statement-breakpoint
CREATE TABLE "stock_receipt" (
    "id" serial PRIMARY KEY NOT NULL,
    "receipt_no" varchar(32) DEFAULT 'GRN-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('stock_receipt_number_seq')::text, 6, '0') NOT NULL,
    "warehouse_id" text NOT NULL,
    "idempotency_key" varchar(100) NOT NULL,
    "supplier_id" integer,
    "receipt_date" date NOT NULL,
    "payment_method" "stock_receipt_payment_method" NOT NULL,
    "reference" varchar(150),
    "storage_area_id" integer,
    "shelf_rack" varchar(100),
    "note" text,
    "line_count" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "stockReceipt_receiptNo_unique" UNIQUE("receipt_no"),
    CONSTRAINT "stockReceipt_warehouse_idempotency_unique" UNIQUE("warehouse_id", "idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "stock_receipt" ADD CONSTRAINT "stock_receipt_warehouse_id_user_id_fk"
    FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "stock_receipt" ADD CONSTRAINT "stock_receipt_supplier_id_supplier_id_fk"
    FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "stock_receipt" ADD CONSTRAINT "stock_receipt_storage_area_id_warehouse_storage_area_id_fk"
    FOREIGN KEY ("storage_area_id") REFERENCES "public"."warehouse_storage_area"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX "stockReceipt_warehouseId_idx" ON "stock_receipt" ("warehouse_id");
--> statement-breakpoint
CREATE INDEX "stockReceipt_supplierId_idx" ON "stock_receipt" ("supplier_id");
--> statement-breakpoint
ALTER TABLE "stock_entry" ADD COLUMN "receipt_id" integer;
--> statement-breakpoint
ALTER TABLE "stock_entry" ADD CONSTRAINT "stock_entry_receipt_id_stock_receipt_id_fk"
    FOREIGN KEY ("receipt_id") REFERENCES "public"."stock_receipt"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX "stockEntry_receiptId_idx" ON "stock_entry" ("receipt_id");
--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "quantity_unit" varchar(20);
--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "inventory_unit" varchar(20);
--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "conversion_factor" numeric(12, 4);
--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "inventory_qty" numeric(12, 2);
--> statement-breakpoint
ALTER TABLE "invoice_item" ADD COLUMN "variant_id" integer;
--> statement-breakpoint
ALTER TABLE "invoice_item" ADD COLUMN "quantity_unit" varchar(20);
--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_variant_id_product_variant_id_fk"
    FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "stock_adjustment_item" ADD COLUMN "quantity_unit" varchar(20);
--> statement-breakpoint
UPDATE "stock_entry" se
SET "quantity_unit" = 'cylinder',
    "inventory_unit" = 'cylinder'
FROM "product_variant" pv
JOIN "variant_option" vo ON vo."id" = pv."source_variant_option_id"
WHERE se."variant_id" = pv."id"
  AND lower(coalesce(vo."definition"->>'container', '')) = 'cylinder';
--> statement-breakpoint
UPDATE "order_item" oi
SET "supply_mode" = 'cylinder',
    "quantity_unit" = 'cylinder',
    "inventory_unit" = 'cylinder',
    "conversion_factor" = 1,
    "inventory_qty" = coalesce(oi."modified_qty", oi."quantity")
FROM "product_variant" pv
JOIN "variant_option" vo ON vo."id" = pv."source_variant_option_id"
WHERE oi."variant_id" = pv."id"
  AND lower(coalesce(vo."definition"->>'container', '')) = 'cylinder'
  AND EXISTS (
      SELECT 1 FROM "order" o
      WHERE o."id" = oi."order_id"
        AND o."status" IN ('pending', 'approved', 'confirmed', 'processing', 'ready_for_dispatch', 'partially_invoiced', 'invoiced')
  );
--> statement-breakpoint
UPDATE "stock_adjustment_item" sai
SET "quantity_unit" = 'cylinder'
FROM "product_variant" pv
JOIN "variant_option" vo ON vo."id" = pv."source_variant_option_id"
WHERE sai."variant_id" = pv."id"
  AND lower(coalesce(vo."definition"->>'container', '')) = 'cylinder';
