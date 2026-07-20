CREATE TYPE "public"."warehouse_pos_payment_entry_type" AS ENUM('payment', 'reversal');
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "public"."retailer_pos_invoice_seq" START WITH 1 INCREMENT BY 1;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_customer" ALTER COLUMN "warehouse_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_cart" ALTER COLUMN "warehouse_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ALTER COLUMN "warehouse_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_customer" ADD COLUMN "shop_id" text;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_customer" ADD COLUMN "normalized_phone" varchar(30);
--> statement-breakpoint
ALTER TABLE "warehouse_pos_cart" ADD COLUMN "shop_id" text;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD COLUMN "shop_id" text;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD COLUMN "checkout_request_id" varchar(80);
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD COLUMN "discount_mode" varchar(20);
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD COLUMN "discount_value" numeric(12, 2);
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD COLUMN "tax_mode" varchar(20);
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD COLUMN "tax_value" numeric(12, 2);
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD COLUMN "tendered_amount" numeric(12, 2);
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD COLUMN "change_amount" numeric(12, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD COLUMN "void_reason" text;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD COLUMN "voided_by_id" text;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD COLUMN "voided_at" timestamp;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_payment" ADD COLUMN "entry_type" "warehouse_pos_payment_entry_type" DEFAULT 'payment' NOT NULL;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_payment" ADD COLUMN "idempotency_key" varchar(80);
--> statement-breakpoint
ALTER TABLE "warehouse_pos_payment" ADD COLUMN "reverses_payment_id" integer;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_payment" ADD COLUMN "tendered_amount" numeric(12, 2);
--> statement-breakpoint
UPDATE "warehouse_pos_customer"
SET "normalized_phone" = regexp_replace("phone", '[^0-9+]', '', 'g')
WHERE "phone" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_customer" ADD CONSTRAINT "warehouse_pos_customer_shop_id_user_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_cart" ADD CONSTRAINT "warehouse_pos_cart_shop_id_user_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD CONSTRAINT "warehouse_pos_sale_shop_id_user_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD CONSTRAINT "warehouse_pos_sale_voided_by_id_user_id_fk" FOREIGN KEY ("voided_by_id") REFERENCES "public"."user"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_customer" ADD CONSTRAINT "warehouse_pos_customer_exactly_one_owner" CHECK (num_nonnulls("warehouse_id", "shop_id") = 1);
--> statement-breakpoint
ALTER TABLE "warehouse_pos_cart" ADD CONSTRAINT "warehouse_pos_cart_exactly_one_owner" CHECK (num_nonnulls("warehouse_id", "shop_id") = 1);
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD CONSTRAINT "warehouse_pos_sale_exactly_one_owner" CHECK (num_nonnulls("warehouse_id", "shop_id") = 1);
--> statement-breakpoint
CREATE INDEX "warehousePosCustomer_shopId_idx" ON "warehouse_pos_customer" USING btree ("shop_id");
--> statement-breakpoint
CREATE INDEX "warehousePosCart_shopId_idx" ON "warehouse_pos_cart" USING btree ("shop_id");
--> statement-breakpoint
CREATE INDEX "warehousePosSale_shopId_idx" ON "warehouse_pos_sale" USING btree ("shop_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "warehousePosSale_checkoutRequestId_unique" ON "warehouse_pos_sale" USING btree ("checkout_request_id") WHERE "checkout_request_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "warehousePosPayment_idempotencyKey_unique" ON "warehouse_pos_payment" USING btree ("idempotency_key") WHERE "idempotency_key" IS NOT NULL;
