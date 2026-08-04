CREATE TYPE "public"."cylinder_sale_mode" AS ENUM('new', 'exchange');
--> statement-breakpoint
ALTER TABLE "product_variant"
    ADD COLUMN "exchange_enabled" boolean DEFAULT false NOT NULL,
    ADD COLUMN "exchange_credit_amount" numeric(10, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
UPDATE "product_variant" pv
SET "exchange_enabled" = coalesce(pv."is_pack_return_required", false),
    "exchange_credit_amount" = greatest(coalesce(pv."pack_deposit_amount", 0), 0)
FROM "product" p
JOIN "category" c ON c."id" = p."category_id"
JOIN "product_type" pt ON pt."id" = c."type_id"
WHERE pv."product_id" = p."id"
  AND pt."fulfillment_family" = 'lpg';
--> statement-breakpoint
ALTER TABLE "cart_item"
    ADD COLUMN "cylinder_sale_mode" "cylinder_sale_mode" DEFAULT 'new' NOT NULL;
--> statement-breakpoint
ALTER TABLE "order_item"
    ADD COLUMN "cylinder_sale_mode" "cylinder_sale_mode" DEFAULT 'new' NOT NULL,
    ADD COLUMN "new_unit_price" numeric(10, 2),
    ADD COLUMN "exchange_credit_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
    ADD COLUMN "expected_empty_pack_qty" integer DEFAULT 0 NOT NULL,
    ADD COLUMN "collected_empty_pack_qty" integer DEFAULT 0 NOT NULL,
    ADD COLUMN "converted_to_new_qty" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
WITH active_retailer_reservations AS (
    SELECT o."shop_id", oi."variant_id",
           sum(coalesce(oi."inventory_qty", oi."quantity"::numeric)) AS quantity
    FROM "order" o
    JOIN "order_item" oi ON oi."order_id" = o."id"
    WHERE o."order_type" = 'b2c'
      AND o."order_source" = 'direct'
      AND o."shop_id" IS NOT NULL
      AND oi."variant_id" IS NOT NULL
      AND o."status" NOT IN ('delivered', 'returned', 'cancelled')
    GROUP BY o."shop_id", oi."variant_id"
)
UPDATE "inventory" i
SET "reserved_qty" = i."reserved_qty"::numeric + r.quantity,
    "updated_at" = now()
FROM active_retailer_reservations r
WHERE i."owner_type" = 'shop'
  AND i."owner_id" = r."shop_id"
  AND i."variant_id" = r."variant_id";
--> statement-breakpoint
ALTER TABLE "invoice"
    ADD COLUMN "handoff_balance" numeric(10, 2) DEFAULT '0' NOT NULL,
    ADD COLUMN "handoff_payment_method" varchar(30),
    ADD COLUMN "handoff_payment_reference" varchar(150),
    ADD COLUMN "handoff_adjusted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "empty_pack" ALTER COLUMN "delivery_group_invoice_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "empty_pack"
    ADD COLUMN "shop_id" text,
    ADD COLUMN "invoice_id" integer,
    ADD COLUMN "order_item_id" integer;
--> statement-breakpoint
ALTER TABLE "empty_pack" ADD CONSTRAINT "empty_pack_shop_id_user_id_fk"
    FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "empty_pack" ADD CONSTRAINT "empty_pack_invoice_id_invoice_id_fk"
    FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "empty_pack" ADD CONSTRAINT "empty_pack_order_item_id_order_item_id_fk"
    FOREIGN KEY ("order_item_id") REFERENCES "public"."order_item"("id") ON DELETE set null;
--> statement-breakpoint
UPDATE "empty_pack" ep
SET "shop_id" = dg."shop_id",
    "invoice_id" = dgi."invoice_id"
FROM "delivery_group_invoice" dgi
JOIN "delivery_group" dg ON dg."id" = dgi."group_id"
WHERE ep."delivery_group_invoice_id" = dgi."id";
--> statement-breakpoint
CREATE INDEX "emptyPack_shopId_idx" ON "empty_pack" ("shop_id");
--> statement-breakpoint
CREATE INDEX "emptyPack_invoiceId_idx" ON "empty_pack" ("invoice_id");
--> statement-breakpoint
CREATE INDEX "emptyPack_orderItemId_idx" ON "empty_pack" ("order_item_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "emptyPack_invoiceOrderItem_unique"
    ON "empty_pack" ("invoice_id", "order_item_id")
    WHERE "order_item_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_exchange_credit_nonnegative"
    CHECK ("exchange_credit_amount" >= 0);
--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_empty_pack_quantities_valid"
    CHECK (
        "expected_empty_pack_qty" >= 0
        AND "collected_empty_pack_qty" >= 0
        AND "converted_to_new_qty" >= 0
        AND "collected_empty_pack_qty" + "converted_to_new_qty" <= "expected_empty_pack_qty"
    );
