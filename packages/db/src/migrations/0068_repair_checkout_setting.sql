DO $$ BEGIN
	CREATE TYPE "checkout_promotion_audience" AS ENUM ('retail', 'wholesale', 'all');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "checkout_promotion_type" AS ENUM ('fixed', 'percentage');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "order_delivery_mode" AS ENUM ('self_pickup', 'courier');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "order_payment_plan" AS ENUM ('pay_now', 'partial', 'pay_later');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "payment_entry_type" AS ENUM ('payment', 'refund');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TYPE "payment_status" ADD VALUE IF NOT EXISTS 'partial';
--> statement-breakpoint
ALTER TYPE "payment_status" ADD VALUE IF NOT EXISTS 'partially_refunded';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checkout_promotion" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
	"code" varchar(40) NOT NULL,
	"name" varchar(120) NOT NULL,
	"audience" "checkout_promotion_audience" DEFAULT 'all' NOT NULL,
	"type" "checkout_promotion_type" NOT NULL,
	"value" numeric(12, 2) NOT NULL,
	"minimum_subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"maximum_discount" numeric(12, 2),
	"usage_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "checkoutPromotion_amounts_check" CHECK (
		"value" >= 0 AND "minimum_subtotal" >= 0 AND
		("maximum_discount" IS NULL OR "maximum_discount" >= 0)
	),
	CONSTRAINT "checkoutPromotion_usage_check" CHECK (
		"used_count" >= 0 AND ("usage_limit" IS NULL OR "usage_limit" >= 0)
	)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "checkoutPromotion_owner_code_unique"
	ON "checkout_promotion" ("owner_id", "code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkoutPromotion_owner_active_idx"
	ON "checkout_promotion" ("owner_id", "is_active");
--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "product_discount" numeric(10, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "coupon_discount" numeric(10, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "reward_discount" numeric(10, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "tax_amount" numeric(10, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "delivery_fee" numeric(10, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "shipping_fee" numeric(10, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "paid_amount" numeric(10, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "due_amount" numeric(10, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "return_amount" numeric(10, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "promotion_code" varchar(40);
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "payment_plan" "order_payment_plan" DEFAULT 'pay_later' NOT NULL;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "payment_due_at" timestamp;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "credit_days" integer;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "delivery_mode" "order_delivery_mode" DEFAULT 'courier' NOT NULL;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "checkout_quote_version" varchar(80);
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "checkout_quote_expires_at" timestamp;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "checkout_idempotency_key" varchar(100);
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "invoice_name" text;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "invoice_phone" text;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "invoice_email" text;
--> statement-breakpoint
UPDATE "order"
SET
	"product_discount" = "discount",
	"delivery_fee" = "shipping_cost",
	"due_amount" = CASE WHEN "payment_status" = 'paid' THEN 0 ELSE "total" END,
	"paid_amount" = CASE WHEN "payment_status" = 'paid' THEN "total" ELSE 0 END
WHERE
	"product_discount" = 0 AND "delivery_fee" = 0 AND
	"paid_amount" = 0 AND "due_amount" = 0;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "order_checkout_idempotency_unique"
	ON "order" ("checkout_idempotency_key")
	WHERE "checkout_idempotency_key" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(100);
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "entry_type" "payment_entry_type" DEFAULT 'payment' NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_orderId_idx" ON "payment" ("order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_idempotencyKey_unique" ON "payment" ("idempotency_key");
--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "product_discount" numeric(10, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "coupon_discount" numeric(10, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "reward_discount" numeric(10, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "shipping_charge" numeric(10, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "paid_amount" numeric(10, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "due_amount" numeric(10, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "return_amount" numeric(10, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
UPDATE "invoice"
SET
	"product_discount" = "discount_amount",
	"due_amount" = CASE WHEN "payment_status" IN ('collected', 'settled') THEN 0 ELSE "grand_total" END,
	"paid_amount" = CASE WHEN "payment_status" IN ('collected', 'settled') THEN "grand_total" ELSE 0 END
WHERE "product_discount" = 0 AND "paid_amount" = 0 AND "due_amount" = 0;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_allocation" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL REFERENCES "payment"("id") ON DELETE cascade,
	"invoice_id" integer NOT NULL REFERENCES "invoice"("id") ON DELETE restrict,
	"amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "paymentAllocation_amount_check" CHECK ("amount" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "paymentAllocation_payment_invoice_unique"
	ON "payment_allocation" ("payment_id", "invoice_id");
CREATE INDEX IF NOT EXISTS "paymentAllocation_invoice_idx"
	ON "payment_allocation" ("invoice_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checkout_promotion_redemption" (
	"id" serial PRIMARY KEY NOT NULL,
	"promotion_id" integer NOT NULL REFERENCES "checkout_promotion"("id") ON DELETE restrict,
	"order_id" integer NOT NULL REFERENCES "order"("id") ON DELETE cascade,
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE restrict,
	"code_snapshot" varchar(40) NOT NULL,
	"discount_amount" numeric(12, 2) NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "checkoutPromotionRedemption_amount_check" CHECK ("discount_amount" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "checkoutPromotionRedemption_order_unique"
	ON "checkout_promotion_redemption" ("order_id");
CREATE INDEX IF NOT EXISTS "checkoutPromotionRedemption_promotion_idx"
	ON "checkout_promotion_redemption" ("promotion_id");
CREATE INDEX IF NOT EXISTS "checkoutPromotionRedemption_user_idx"
	ON "checkout_promotion_redemption" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checkout_setting" (
	"owner_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE cascade,
	"allow_self_pickup" boolean DEFAULT true NOT NULL,
	"allow_courier" boolean DEFAULT true NOT NULL,
	"allow_retail_deposits" boolean DEFAULT false NOT NULL,
	"default_shipping_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"tax_percentage" numeric(5, 2) DEFAULT '0' NOT NULL,
	"wholesale_credit_days" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "checkoutSetting_shippingFee_check" CHECK ("default_shipping_fee" >= 0),
	CONSTRAINT "checkoutSetting_taxPercentage_check" CHECK (
		"tax_percentage" >= 0 AND "tax_percentage" <= 100
	),
	CONSTRAINT "checkoutSetting_creditDays_check" CHECK ("wholesale_credit_days" >= 0),
	CONSTRAINT "checkoutSetting_deliveryMode_check" CHECK (
		"allow_self_pickup" OR "allow_courier"
	)
);
--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "promotion_code" varchar(40);
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "payment_plan" "order_payment_plan" DEFAULT 'pay_later' NOT NULL;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "payment_due_at" timestamp;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "billed_name" text;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "billed_phone" text;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "billed_email" text;
