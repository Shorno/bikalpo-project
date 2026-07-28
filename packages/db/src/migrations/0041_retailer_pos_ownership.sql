DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'warehouse_pos_payment_entry_type'
  ) THEN
    CREATE TYPE "public"."warehouse_pos_payment_entry_type" AS ENUM('payment', 'reversal');
  END IF;
END $$;
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "public"."retailer_pos_invoice_seq" START WITH 1 INCREMENT BY 1;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_customer" ALTER COLUMN "warehouse_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_cart" ALTER COLUMN "warehouse_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ALTER COLUMN "warehouse_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_customer" ADD COLUMN IF NOT EXISTS "shop_id" text;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_customer" ADD COLUMN IF NOT EXISTS "normalized_phone" varchar(30);
--> statement-breakpoint
ALTER TABLE "warehouse_pos_cart" ADD COLUMN IF NOT EXISTS "shop_id" text;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD COLUMN IF NOT EXISTS "shop_id" text;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD COLUMN IF NOT EXISTS "checkout_request_id" varchar(80);
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD COLUMN IF NOT EXISTS "discount_mode" varchar(20);
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD COLUMN IF NOT EXISTS "discount_value" numeric(12, 2);
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD COLUMN IF NOT EXISTS "tax_mode" varchar(20);
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD COLUMN IF NOT EXISTS "tax_value" numeric(12, 2);
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD COLUMN IF NOT EXISTS "tendered_amount" numeric(12, 2);
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD COLUMN IF NOT EXISTS "change_amount" numeric(12, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD COLUMN IF NOT EXISTS "void_reason" text;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD COLUMN IF NOT EXISTS "voided_by_id" text;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD COLUMN IF NOT EXISTS "voided_at" timestamp;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_payment" ADD COLUMN IF NOT EXISTS "entry_type" "warehouse_pos_payment_entry_type" DEFAULT 'payment' NOT NULL;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_payment" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(80);
--> statement-breakpoint
ALTER TABLE "warehouse_pos_payment" ADD COLUMN IF NOT EXISTS "reverses_payment_id" integer;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_payment" ADD COLUMN IF NOT EXISTS "tendered_amount" numeric(12, 2);
--> statement-breakpoint
UPDATE "warehouse_pos_customer"
SET "normalized_phone" = regexp_replace("phone", '[^0-9+]', '', 'g')
WHERE "phone" IS NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'warehouse_pos_customer_shop_id_user_id_fk'
  ) THEN
    ALTER TABLE "warehouse_pos_customer"
    ADD CONSTRAINT "warehouse_pos_customer_shop_id_user_id_fk"
    FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id") ON DELETE cascade;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'warehouse_pos_cart_shop_id_user_id_fk'
  ) THEN
    ALTER TABLE "warehouse_pos_cart"
    ADD CONSTRAINT "warehouse_pos_cart_shop_id_user_id_fk"
    FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id") ON DELETE cascade;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'warehouse_pos_sale_shop_id_user_id_fk'
  ) THEN
    ALTER TABLE "warehouse_pos_sale"
    ADD CONSTRAINT "warehouse_pos_sale_shop_id_user_id_fk"
    FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id") ON DELETE cascade;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'warehouse_pos_sale_voided_by_id_user_id_fk'
  ) THEN
    ALTER TABLE "warehouse_pos_sale"
    ADD CONSTRAINT "warehouse_pos_sale_voided_by_id_user_id_fk"
    FOREIGN KEY ("voided_by_id") REFERENCES "public"."user"("id") ON DELETE set null;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'warehouse_pos_customer_exactly_one_owner'
  ) THEN
    ALTER TABLE "warehouse_pos_customer"
    ADD CONSTRAINT "warehouse_pos_customer_exactly_one_owner"
    CHECK (num_nonnulls("warehouse_id", "shop_id") = 1);
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'warehouse_pos_cart_exactly_one_owner'
  ) THEN
    ALTER TABLE "warehouse_pos_cart"
    ADD CONSTRAINT "warehouse_pos_cart_exactly_one_owner"
    CHECK (num_nonnulls("warehouse_id", "shop_id") = 1);
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'warehouse_pos_sale_exactly_one_owner'
  ) THEN
    ALTER TABLE "warehouse_pos_sale"
    ADD CONSTRAINT "warehouse_pos_sale_exactly_one_owner"
    CHECK (num_nonnulls("warehouse_id", "shop_id") = 1);
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "warehousePosCustomer_shopId_idx" ON "warehouse_pos_customer" USING btree ("shop_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "warehousePosCart_shopId_idx" ON "warehouse_pos_cart" USING btree ("shop_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "warehousePosSale_shopId_idx" ON "warehouse_pos_sale" USING btree ("shop_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "warehousePosSale_checkoutRequestId_unique" ON "warehouse_pos_sale" USING btree ("checkout_request_id") WHERE "checkout_request_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "warehousePosPayment_idempotencyKey_unique" ON "warehouse_pos_payment" USING btree ("idempotency_key") WHERE "idempotency_key" IS NOT NULL;
