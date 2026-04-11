CREATE TYPE "public"."brand_support" AS ENUM('multi_brand', 'single_brand');--> statement-breakpoint
CREATE TYPE "public"."core_product_status" AS ENUM('active', 'draft', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."payment_collection_method" AS ENUM('cash', 'bkash', 'nagad', 'bank_transfer', 'other');--> statement-breakpoint
CREATE TYPE "public"."supervisor_approval" AS ENUM('pending', 'approved', 'flagged');--> statement-breakpoint
CREATE TYPE "public"."empty_pack_status" AS ENUM('collected', 'submitted', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."expense_payment_method" AS ENUM('cash', 'bank', 'mobile_banking');--> statement-breakpoint
CREATE TYPE "public"."owner_type" AS ENUM('warehouse', 'shop', 'restaurant');--> statement-breakpoint
CREATE TYPE "public"."financial_ledger_direction" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."financial_ledger_entry_type" AS ENUM('expense', 'purchase_cash', 'purchase_credit', 'supplier_payment', 'sale', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."financial_ledger_ref_type" AS ENUM('expense', 'purchase', 'supplier_payment', 'order', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."ledger_owner_type" AS ENUM('warehouse', 'shop', 'restaurant');--> statement-breakpoint
CREATE TYPE "public"."open_order_bid_status" AS ENUM('available', 'locked', 'submitted', 'expired', 'released', 'lost');--> statement-breakpoint
CREATE TYPE "public"."shop_warehouse_status" AS ENUM('active', 'pending', 'disconnected');--> statement-breakpoint
ALTER TYPE "public"."delivery_invoice_status" ADD VALUE 'returned';--> statement-breakpoint
ALTER TYPE "public"."invoice_delivery_status" ADD VALUE 'returned';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'matching_shop' BEFORE 'confirmed';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'negotiating' BEFORE 'confirmed';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'returned' BEFORE 'cancelled';--> statement-breakpoint
CREATE TABLE "core_product_brand" (
	"id" serial PRIMARY KEY NOT NULL,
	"core_product_id" integer NOT NULL,
	"brand_id" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core_product_identity" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" varchar(20) NOT NULL,
	"name" varchar(150) NOT NULL,
	"slug" varchar(150) NOT NULL,
	"description" text,
	"image" varchar(255) NOT NULL,
	"category_id" integer NOT NULL,
	"sub_category_id" integer,
	"brand_support" "brand_support" DEFAULT 'multi_brand' NOT NULL,
	"variant_support_pack" boolean DEFAULT true NOT NULL,
	"variant_support_loose" boolean DEFAULT false NOT NULL,
	"default_loose_unit" varchar(20),
	"status" "core_product_status" DEFAULT 'active' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "core_product_identity_sku_unique" UNIQUE("sku"),
	CONSTRAINT "core_product_identity_name_unique" UNIQUE("name"),
	CONSTRAINT "core_product_identity_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "core_product_pack_variant" (
	"id" serial PRIMARY KEY NOT NULL,
	"core_product_id" integer NOT NULL,
	"label" varchar(100) NOT NULL,
	"weight_kg" numeric(10, 2) NOT NULL,
	"pack_type" varchar(20) NOT NULL,
	"sell_unit" varchar(50),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_kpi" (
	"id" serial PRIMARY KEY NOT NULL,
	"deliveryman_id" text NOT NULL,
	"date" date NOT NULL,
	"total_deliveries" integer DEFAULT 0 NOT NULL,
	"successful" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"total_cash_collected" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_digital_collected" numeric(10, 2) DEFAULT '0' NOT NULL,
	"expected_total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_packs_collected" integer DEFAULT 0 NOT NULL,
	"total_packs_verified" integer DEFAULT 0 NOT NULL,
	"avg_delivery_time_mins" integer,
	"total_distance_km" numeric(10, 2),
	"success_rate" numeric(5, 2),
	"on_time_rate" numeric(5, 2),
	"fraud_flags" integer DEFAULT 0 NOT NULL,
	"flag_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_location_ping" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"deliveryman_id" text NOT NULL,
	"lat" numeric(10, 7) NOT NULL,
	"lng" numeric(10, 7) NOT NULL,
	"accuracy" numeric(8, 2),
	"speed" numeric(6, 2),
	"battery_level" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empty_pack" (
	"id" serial PRIMARY KEY NOT NULL,
	"delivery_group_invoice_id" integer NOT NULL,
	"variant_id" integer,
	"brand_id" integer,
	"pack_description" text,
	"quantity_collected" integer DEFAULT 0 NOT NULL,
	"photo_proof" text,
	"status" "empty_pack_status" DEFAULT 'collected' NOT NULL,
	"submitted_to" text,
	"verified_by" text,
	"deposit_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"submitted_at" timestamp,
	"verified_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "expense_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"owner_id" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense" (
	"id" serial PRIMARY KEY NOT NULL,
	"expense_number" varchar(30) NOT NULL,
	"title" varchar(200) NOT NULL,
	"category_id" integer NOT NULL,
	"payee_id" integer,
	"amount" numeric(12, 2) NOT NULL,
	"payment_date" date NOT NULL,
	"payment_method" "expense_payment_method" NOT NULL,
	"reference_no" varchar(100),
	"attachment" text,
	"note" text,
	"owner_id" text NOT NULL,
	"owner_type" "owner_type" NOT NULL,
	"is_voided" boolean DEFAULT false NOT NULL,
	"void_reason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "expense_expense_number_unique" UNIQUE("expense_number")
);
--> statement-breakpoint
CREATE TABLE "financial_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_type" "financial_ledger_entry_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"direction" "financial_ledger_direction" NOT NULL,
	"balance_before" numeric(14, 2),
	"balance_after" numeric(14, 2),
	"reference_type" "financial_ledger_ref_type" NOT NULL,
	"reference_id" integer NOT NULL,
	"description" text,
	"owner_id" text NOT NULL,
	"owner_type" "ledger_owner_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "open_order_bid" (
	"id" serial PRIMARY KEY NOT NULL,
	"sub_order_id" integer NOT NULL,
	"shop_id" text NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"distance_km" numeric(8, 2),
	"status" "open_order_bid_status" DEFAULT 'available' NOT NULL,
	"locked_at" timestamp,
	"submitted_at" timestamp,
	"expires_at" timestamp,
	"timeout_seconds" integer DEFAULT 100 NOT NULL,
	"delivery_charge" numeric(10, 2),
	"total_bid" numeric(10, 2),
	"is_winner" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "open_order_bid_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"bid_id" integer NOT NULL,
	"order_item_id" integer NOT NULL,
	"platform_price" numeric(10, 2) NOT NULL,
	"seller_price" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "shop_warehouse_connection" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"warehouse_id" text NOT NULL,
	"status" "shop_warehouse_status" DEFAULT 'pending' NOT NULL,
	"connected_at" timestamp DEFAULT now(),
	"last_ordered_at" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_category_assignment" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"category_id" integer NOT NULL,
	"subcategory_id" integer,
	"assigned_by" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payee" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"contact_person" varchar(150),
	"phone" varchar(20) NOT NULL,
	"email" varchar(150),
	"address" text,
	"notes" text,
	"added_by" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delivery_group" ADD COLUMN "start_lat" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "delivery_group" ADD COLUMN "start_lng" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "delivery_group" ADD COLUMN "end_lat" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "delivery_group" ADD COLUMN "end_lng" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "delivery_group" ADD COLUMN "started_at" timestamp;--> statement-breakpoint
ALTER TABLE "delivery_group" ADD COLUMN "total_cash_collected" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_group" ADD COLUMN "total_digital_collected" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_group" ADD COLUMN "expected_total" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_group" ADD COLUMN "cash_reconciled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_group" ADD COLUMN "pack_reconciled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_group" ADD COLUMN "supervisor_approval" "supervisor_approval" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_group" ADD COLUMN "supervisor_note" text;--> statement-breakpoint
ALTER TABLE "delivery_group" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "delivery_group" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "delivery_group_invoice" ADD COLUMN "delivery_lat" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "delivery_group_invoice" ADD COLUMN "delivery_lng" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "delivery_group_invoice" ADD COLUMN "payment_method" "payment_collection_method";--> statement-breakpoint
ALTER TABLE "delivery_group_invoice" ADD COLUMN "amount_collected" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_group_invoice" ADD COLUMN "transaction_id" text;--> statement-breakpoint
ALTER TABLE "delivery_group_invoice" ADD COLUMN "failed_photo" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "is_open_order" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "parent_order_id" integer;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "sub_order_label" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "broadcast_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "brand_id" integer;--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "color" varchar(50);--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "size" varchar(50);--> statement-breakpoint
ALTER TABLE "core_product_brand" ADD CONSTRAINT "core_product_brand_core_product_id_core_product_identity_id_fk" FOREIGN KEY ("core_product_id") REFERENCES "public"."core_product_identity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_product_brand" ADD CONSTRAINT "core_product_brand_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_product_identity" ADD CONSTRAINT "core_product_identity_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_product_identity" ADD CONSTRAINT "core_product_identity_sub_category_id_sub_category_id_fk" FOREIGN KEY ("sub_category_id") REFERENCES "public"."sub_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_product_pack_variant" ADD CONSTRAINT "core_product_pack_variant_core_product_id_core_product_identity_id_fk" FOREIGN KEY ("core_product_id") REFERENCES "public"."core_product_identity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_kpi" ADD CONSTRAINT "delivery_kpi_deliveryman_id_user_id_fk" FOREIGN KEY ("deliveryman_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_location_ping" ADD CONSTRAINT "delivery_location_ping_group_id_delivery_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."delivery_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_location_ping" ADD CONSTRAINT "delivery_location_ping_deliveryman_id_user_id_fk" FOREIGN KEY ("deliveryman_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empty_pack" ADD CONSTRAINT "empty_pack_delivery_group_invoice_id_delivery_group_invoice_id_fk" FOREIGN KEY ("delivery_group_invoice_id") REFERENCES "public"."delivery_group_invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empty_pack" ADD CONSTRAINT "empty_pack_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empty_pack" ADD CONSTRAINT "empty_pack_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empty_pack" ADD CONSTRAINT "empty_pack_submitted_to_user_id_fk" FOREIGN KEY ("submitted_to") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empty_pack" ADD CONSTRAINT "empty_pack_verified_by_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_category" ADD CONSTRAINT "expense_category_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_category_id_expense_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_payee_id_payee_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."payee"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_ledger" ADD CONSTRAINT "financial_ledger_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_order_bid" ADD CONSTRAINT "open_order_bid_sub_order_id_order_id_fk" FOREIGN KEY ("sub_order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_order_bid" ADD CONSTRAINT "open_order_bid_shop_id_user_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_order_bid_item" ADD CONSTRAINT "open_order_bid_item_bid_id_open_order_bid_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."open_order_bid"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_order_bid_item" ADD CONSTRAINT "open_order_bid_item_order_item_id_order_item_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_warehouse_connection" ADD CONSTRAINT "shop_warehouse_connection_shop_id_user_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_warehouse_connection" ADD CONSTRAINT "shop_warehouse_connection_warehouse_id_user_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_category_assignment" ADD CONSTRAINT "shop_category_assignment_shop_id_user_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_category_assignment" ADD CONSTRAINT "shop_category_assignment_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_category_assignment" ADD CONSTRAINT "shop_category_assignment_subcategory_id_sub_category_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."sub_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_category_assignment" ADD CONSTRAINT "shop_category_assignment_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payee" ADD CONSTRAINT "payee_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deliveryKpi_deliverymanId_idx" ON "delivery_kpi" USING btree ("deliveryman_id");--> statement-breakpoint
CREATE INDEX "deliveryKpi_date_idx" ON "delivery_kpi" USING btree ("date");--> statement-breakpoint
CREATE INDEX "locationPing_groupId_idx" ON "delivery_location_ping" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "locationPing_deliverymanId_idx" ON "delivery_location_ping" USING btree ("deliveryman_id");--> statement-breakpoint
CREATE INDEX "locationPing_createdAt_idx" ON "delivery_location_ping" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "emptyPack_dgiId_idx" ON "empty_pack" USING btree ("delivery_group_invoice_id");--> statement-breakpoint
CREATE INDEX "emptyPack_status_idx" ON "empty_pack" USING btree ("status");--> statement-breakpoint
CREATE INDEX "expenseCategory_ownerId_idx" ON "expense_category" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "expenseCategory_slug_idx" ON "expense_category" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "expense_ownerId_idx" ON "expense" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "expense_categoryId_idx" ON "expense" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "expense_paymentDate_idx" ON "expense" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "expense_ownerType_idx" ON "expense" USING btree ("owner_type");--> statement-breakpoint
CREATE INDEX "financialLedger_ownerId_idx" ON "financial_ledger" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "financialLedger_ownerType_idx" ON "financial_ledger" USING btree ("owner_type");--> statement-breakpoint
CREATE INDEX "financialLedger_entryType_idx" ON "financial_ledger" USING btree ("entry_type");--> statement-breakpoint
CREATE INDEX "financialLedger_createdAt_idx" ON "financial_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "financialLedger_ref_idx" ON "financial_ledger" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "openOrderBid_subOrder_idx" ON "open_order_bid" USING btree ("sub_order_id");--> statement-breakpoint
CREATE INDEX "openOrderBid_shop_idx" ON "open_order_bid" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "openOrderBid_status_idx" ON "open_order_bid" USING btree ("status");--> statement-breakpoint
CREATE INDEX "openOrderBid_subOrder_shop_idx" ON "open_order_bid" USING btree ("sub_order_id","shop_id");--> statement-breakpoint
CREATE INDEX "openOrderBidItem_bid_idx" ON "open_order_bid_item" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "openOrderBidItem_orderItem_idx" ON "open_order_bid_item" USING btree ("order_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "swc_shop_warehouse_idx" ON "shop_warehouse_connection" USING btree ("shop_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "swc_shopId_idx" ON "shop_warehouse_connection" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "swc_warehouseId_idx" ON "shop_warehouse_connection" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "swc_status_idx" ON "shop_warehouse_connection" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sca_shopId_idx" ON "shop_category_assignment" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "sca_categoryId_idx" ON "shop_category_assignment" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sca_unique_idx" ON "shop_category_assignment" USING btree ("shop_id","category_id","subcategory_id");--> statement-breakpoint
CREATE INDEX "payee_addedBy_idx" ON "payee" USING btree ("added_by");--> statement-breakpoint
ALTER TABLE "delivery_group" ADD CONSTRAINT "delivery_group_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_phone_number_unique" UNIQUE("phone_number");