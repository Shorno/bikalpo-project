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
	CONSTRAINT "checkoutSetting_creditDays_check" CHECK (
		"wholesale_credit_days" >= 0
	),
	CONSTRAINT "checkoutSetting_deliveryMode_check" CHECK (
		"allow_self_pickup" OR "allow_courier"
	)
);
