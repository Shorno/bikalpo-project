CREATE TYPE "public"."inventory_owner_type" AS ENUM('super_seller', 'shop');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'inactive', 'draft');--> statement-breakpoint
CREATE TYPE "public"."variant_order_type" AS ENUM('b2b', 'b2c');--> statement-breakpoint
CREATE TYPE "public"."pack_type" AS ENUM('sack', 'carton', 'packet', 'loose', 'bottle', 'can', 'jar', 'pouch', 'box');--> statement-breakpoint
CREATE TYPE "public"."variant_type" AS ENUM('trade', 'retail');--> statement-breakpoint
CREATE TYPE "public"."visibility_role" AS ENUM('shop_owner', 'consumer', 'all');--> statement-breakpoint
CREATE TYPE "public"."stock_ledger_change_type" AS ENUM('in', 'out', 'convert_in', 'convert_out', 'damage', 'return', 'adjust');--> statement-breakpoint
CREATE TYPE "public"."stock_ledger_ref_type" AS ENUM('order', 'return', 'damage', 'manual', 'conversion', 'invoice');--> statement-breakpoint
CREATE TABLE "area" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"slug" varchar(150) NOT NULL,
	"description" text,
	"parent_id" integer,
	"polygon" jsonb,
	"center_lat" text,
	"center_lng" text,
	"radius_km" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "area_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "seller_area_mapping" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"area_id" integer NOT NULL,
	"override_radius_km" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_type" "inventory_owner_type" NOT NULL,
	"owner_id" text NOT NULL,
	"variant_id" integer NOT NULL,
	"available_qty" numeric(12, 2) DEFAULT '0' NOT NULL,
	"reserved_qty" numeric(12, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_pack_rule" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" text NOT NULL,
	"is_empty_pack_returnable" boolean DEFAULT true NOT NULL,
	"empty_pack_value" numeric(10, 2) DEFAULT '0',
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_model" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"slug" varchar(150) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sales_model_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sales_model_product" (
	"id" serial PRIMARY KEY NOT NULL,
	"sales_model_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_model_assignment" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_owner_id" text NOT NULL,
	"sales_model_id" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_application" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"shop_name" text NOT NULL,
	"owner_name" text NOT NULL,
	"phone_number" text NOT NULL,
	"business_type" text NOT NULL,
	"shop_address" text NOT NULL,
	"trade_license_number" text,
	"documents" json DEFAULT '[]'::json,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"variant_id" integer NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" text NOT NULL,
	"change_type" "stock_ledger_change_type" NOT NULL,
	"qty" numeric(12, 2) NOT NULL,
	"reason" text,
	"reference_type" "stock_ledger_ref_type",
	"reference_id" text,
	"balance_after" numeric(12, 2) NOT NULL,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variant_conversion_map" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_variant_id" integer NOT NULL,
	"to_variant_id" integer NOT NULL,
	"conversion_ratio" numeric(10, 2) NOT NULL,
	"auto_convert" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'consumer';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_seller" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "seller_status" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "business_type" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "shop_address" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "shop_slug" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "can_accept_open_order" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "pending_otp_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "is_returnable_pack" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "default_pack_deposit_amount" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "allowed_pack_brands" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "allowed_pack_sizes" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "status" "product_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "variant_type" "variant_type";--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "pack_type" "pack_type";--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "pack_weight_kg" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "inner_pack_size_kg" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "pack_count_inside" integer;--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "sell_unit" varchar(50);--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "order_type" "variant_order_type";--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "visibility_role" "visibility_role" DEFAULT 'all';--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "stock_source" varchar(20);--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "delivery_type" varchar(50);--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "delivery_rule_id" integer;--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "linked_retail_variant_id" integer;--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "conversion_ratio" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "conversion_loss_percent" numeric(5, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "is_open_order_allowed" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "negotiation_timeout_sec" integer DEFAULT 100;--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "is_pack_return_required" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "pack_deposit_amount" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "min_margin_percent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "min_margin_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "seller_area_mapping" ADD CONSTRAINT "seller_area_mapping_area_id_area_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."area"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_pack_rule" ADD CONSTRAINT "product_pack_rule_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_model_product" ADD CONSTRAINT "sales_model_product_sales_model_id_sales_model_id_fk" FOREIGN KEY ("sales_model_id") REFERENCES "public"."sales_model"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_model_product" ADD CONSTRAINT "sales_model_product_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_model_assignment" ADD CONSTRAINT "shop_model_assignment_sales_model_id_sales_model_id_fk" FOREIGN KEY ("sales_model_id") REFERENCES "public"."sales_model"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_application" ADD CONSTRAINT "seller_application_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_application" ADD CONSTRAINT "seller_application_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_conversion_map" ADD CONSTRAINT "variant_conversion_map_from_variant_id_product_variant_id_fk" FOREIGN KEY ("from_variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_conversion_map" ADD CONSTRAINT "variant_conversion_map_to_variant_id_product_variant_id_fk" FOREIGN KEY ("to_variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sellerArea_seller_idx" ON "seller_area_mapping" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "sellerArea_area_idx" ON "seller_area_mapping" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "inventory_owner_idx" ON "inventory" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "inventory_variant_idx" ON "inventory" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "inventory_owner_variant_idx" ON "inventory" USING btree ("owner_type","owner_id","variant_id");--> statement-breakpoint
CREATE INDEX "packRule_product_idx" ON "product_pack_rule" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "packRule_owner_idx" ON "product_pack_rule" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "packRule_product_owner_idx" ON "product_pack_rule" USING btree ("product_id","owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "modelProduct_model_idx" ON "sales_model_product" USING btree ("sales_model_id");--> statement-breakpoint
CREATE INDEX "modelProduct_product_idx" ON "sales_model_product" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "shopModel_shop_idx" ON "shop_model_assignment" USING btree ("shop_owner_id");--> statement-breakpoint
CREATE INDEX "shopModel_model_idx" ON "shop_model_assignment" USING btree ("sales_model_id");--> statement-breakpoint
CREATE INDEX "seller_application_userId_idx" ON "seller_application" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "seller_application_status_idx" ON "seller_application" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stockLedger_variant_idx" ON "stock_ledger" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "stockLedger_owner_idx" ON "stock_ledger" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "stockLedger_createdAt_idx" ON "stock_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "stockLedger_ref_idx" ON "stock_ledger" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "conversionMap_from_idx" ON "variant_conversion_map" USING btree ("from_variant_id");--> statement-breakpoint
CREATE INDEX "conversionMap_to_idx" ON "variant_conversion_map" USING btree ("to_variant_id");