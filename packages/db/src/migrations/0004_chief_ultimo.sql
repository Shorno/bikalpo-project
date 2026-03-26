CREATE TYPE "public"."inventory_behaviour" AS ENUM('auto_break', 'loose_convert', 'fixed_pack');--> statement-breakpoint
CREATE TYPE "public"."supplier_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."purchase_payment_type" AS ENUM('cash', 'credit');--> statement-breakpoint
CREATE TYPE "public"."purchase_status" AS ENUM('draft', 'received', 'partial', 'cancelled');--> statement-breakpoint
CREATE TABLE "customer_home_tab" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"slug" varchar(150) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_home_tab_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "customer_home_tab_product" (
	"id" serial PRIMARY KEY NOT NULL,
	"tab_id" integer NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"image" varchar(255) NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_type" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"image" varchar(255),
	"enable_brand" boolean DEFAULT true NOT NULL,
	"enable_color" boolean DEFAULT false NOT NULL,
	"enable_size" boolean DEFAULT true NOT NULL,
	"enable_design" boolean DEFAULT false NOT NULL,
	"enable_variant" boolean DEFAULT true NOT NULL,
	"inventory_behaviour" "inventory_behaviour" DEFAULT 'fixed_pack' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_type_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "supplier" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"company" varchar(200),
	"contact_person" varchar(150),
	"phone" varchar(20),
	"email" varchar(150),
	"address" text,
	"notes" text,
	"added_by" text NOT NULL,
	"credit_limit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"current_payable" numeric(12, 2) DEFAULT '0' NOT NULL,
	"return_pack_agreement" boolean DEFAULT false NOT NULL,
	"qr_data" jsonb,
	"status" "supplier_status" DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_number" text NOT NULL,
	"supplier_id" integer NOT NULL,
	"warehouse_id" text NOT NULL,
	"supplier_invoice_no" varchar(100),
	"purchase_date" date,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"transport_cost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"payment_type" "purchase_payment_type" DEFAULT 'cash' NOT NULL,
	"status" "purchase_status" DEFAULT 'draft' NOT NULL,
	"note" text,
	"received_at" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_purchase_number_unique" UNIQUE("purchase_number")
);
--> statement-breakpoint
CREATE TABLE "purchase_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_id" integer NOT NULL,
	"variant_id" integer,
	"product_name" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit_cost" numeric(10, 2) NOT NULL,
	"total_cost" numeric(12, 2) NOT NULL,
	"received_qty" numeric(12, 2) DEFAULT '0' NOT NULL,
	"batch_no" varchar(100),
	"expiry_date" date,
	"return_pack_qty" numeric(12, 2) DEFAULT '0' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landing_pricing_plan" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"subtitle" text,
	"price_monthly" integer NOT NULL,
	"price_yearly" integer,
	"features" json DEFAULT '[]'::json,
	"is_popular" boolean DEFAULT false,
	"cta_text" text DEFAULT 'Choose Plan',
	"sort_order" integer DEFAULT 0,
	"active" boolean DEFAULT true,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_category_assignment" (
	"id" serial PRIMARY KEY NOT NULL,
	"warehouse_id" text NOT NULL,
	"category_id" integer NOT NULL,
	"subcategory_id" integer,
	"assigned_by" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tolet_listing" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"location" varchar(255) NOT NULL,
	"rent" numeric(12, 2) DEFAULT '0' NOT NULL,
	"area" varchar(100),
	"bedrooms" integer,
	"bathrooms" integer,
	"contact_info" varchar(255) NOT NULL,
	"image_url" varchar(1024),
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "address" ADD COLUMN "lat" text;--> statement-breakpoint
ALTER TABLE "address" ADD COLUMN "lng" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "shop_lat" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "shop_lng" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "warehouse_lat" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "warehouse_lng" text;--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "type_id" integer;--> statement-breakpoint
ALTER TABLE "delivery_rule" ADD COLUMN "area_id" integer;--> statement-breakpoint
ALTER TABLE "offer" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "offer" ADD COLUMN "target_area_ids" jsonb;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "consumer_area_id" integer;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "matched_area_id" integer;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "location_lat" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "location_lng" text;--> statement-breakpoint
ALTER TABLE "seller_application" ADD COLUMN "business_category" text;--> statement-breakpoint
ALTER TABLE "seller_application" ADD COLUMN "years_in_business" text;--> statement-breakpoint
ALTER TABLE "seller_application" ADD COLUMN "monthly_revenue" text;--> statement-breakpoint
ALTER TABLE "seller_application" ADD COLUMN "latitude" text;--> statement-breakpoint
ALTER TABLE "seller_application" ADD COLUMN "longitude" text;--> statement-breakpoint
ALTER TABLE "seller_application" ADD COLUMN "area" text;--> statement-breakpoint
ALTER TABLE "seller_application" ADD COLUMN "district" text;--> statement-breakpoint
ALTER TABLE "seller_application" ADD COLUMN "division" text;--> statement-breakpoint
ALTER TABLE "seller_application" ADD COLUMN "post_code" text;--> statement-breakpoint
ALTER TABLE "seller_application" ADD COLUMN "selected_plan" text;--> statement-breakpoint
ALTER TABLE "warehouse_application" ADD COLUMN "business_category" text;--> statement-breakpoint
ALTER TABLE "warehouse_application" ADD COLUMN "years_in_business" text;--> statement-breakpoint
ALTER TABLE "warehouse_application" ADD COLUMN "monthly_revenue" text;--> statement-breakpoint
ALTER TABLE "warehouse_application" ADD COLUMN "latitude" text;--> statement-breakpoint
ALTER TABLE "warehouse_application" ADD COLUMN "longitude" text;--> statement-breakpoint
ALTER TABLE "warehouse_application" ADD COLUMN "area" text;--> statement-breakpoint
ALTER TABLE "warehouse_application" ADD COLUMN "district" text;--> statement-breakpoint
ALTER TABLE "warehouse_application" ADD COLUMN "division" text;--> statement-breakpoint
ALTER TABLE "warehouse_application" ADD COLUMN "post_code" text;--> statement-breakpoint
ALTER TABLE "warehouse_application" ADD COLUMN "selected_plan" text;--> statement-breakpoint
ALTER TABLE "customer_home_tab_product" ADD CONSTRAINT "customer_home_tab_product_tab_id_customer_home_tab_id_fk" FOREIGN KEY ("tab_id") REFERENCES "public"."customer_home_tab"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_warehouse_id_user_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_item" ADD CONSTRAINT "purchase_item_purchase_id_purchase_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchase"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_item" ADD CONSTRAINT "purchase_item_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_category_assignment" ADD CONSTRAINT "warehouse_category_assignment_warehouse_id_user_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_category_assignment" ADD CONSTRAINT "warehouse_category_assignment_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_category_assignment" ADD CONSTRAINT "warehouse_category_assignment_subcategory_id_sub_category_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."sub_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_category_assignment" ADD CONSTRAINT "warehouse_category_assignment_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supplier_addedBy_idx" ON "supplier" USING btree ("added_by");--> statement-breakpoint
CREATE INDEX "purchase_warehouseId_idx" ON "purchase" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "purchase_supplierId_idx" ON "purchase" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_status_idx" ON "purchase" USING btree ("status");--> statement-breakpoint
CREATE INDEX "purchaseItem_purchaseId_idx" ON "purchase_item" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "purchaseItem_variantId_idx" ON "purchase_item" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "wca_warehouseId_idx" ON "warehouse_category_assignment" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "wca_categoryId_idx" ON "warehouse_category_assignment" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wca_unique_idx" ON "warehouse_category_assignment" USING btree ("warehouse_id","category_id","subcategory_id");--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_type_id_product_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."product_type"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_rule" ADD CONSTRAINT "delivery_rule_area_id_area_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."area"("id") ON DELETE set null ON UPDATE no action;