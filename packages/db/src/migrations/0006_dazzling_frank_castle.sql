CREATE TYPE "public"."carton_status" AS ENUM('active', 'broken', 'dispatched', 'sold');--> statement-breakpoint
CREATE TYPE "public"."complaint_priority" AS ENUM('medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."complaint_status" AS ENUM('open', 'investigating', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."complaint_type" AS ENUM('delivery', 'payment', 'product');--> statement-breakpoint
CREATE TYPE "public"."damage_status" AS ENUM('active', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."damage_type" AS ENUM('physical', 'expired', 'lost');--> statement-breakpoint
CREATE TYPE "public"."delivery_area_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."tracking_type" AS ENUM('none', 'batch', 'serial');--> statement-breakpoint
CREATE TYPE "public"."product_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."ticket_category" AS ENUM('order', 'payment', 'delivery', 'account', 'other');--> statement-breakpoint
CREATE TYPE "public"."variant_option_type" AS ENUM('pack', 'loose');--> statement-breakpoint
CREATE TYPE "public"."product_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."stock_entry_cost_type" AS ENUM('per_kg', 'per_pack', 'per_carton');--> statement-breakpoint
CREATE TYPE "public"."stock_entry_type" AS ENUM('loose', 'pack', 'carton');--> statement-breakpoint
CREATE TYPE "public"."adjustment_reason" AS ENUM('physical_count', 'damage', 'expired', 'theft', 'system_error', 'other');--> statement-breakpoint
CREATE TYPE "public"."adjustment_status" AS ENUM('draft', 'submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."adjustment_type" AS ENUM('increase', 'decrease', 'damage', 'loss', 'correction');--> statement-breakpoint
CREATE TYPE "public"."warehouse_pos_cart_status" AS ENUM('held', 'converted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."warehouse_pos_customer_type" AS ENUM('walk_in', 'retail', 'wholesale');--> statement-breakpoint
CREATE TYPE "public"."warehouse_pos_payment_method" AS ENUM('cash', 'bkash', 'nagad', 'bank', 'due');--> statement-breakpoint
CREATE TYPE "public"."warehouse_pos_sale_status" AS ENUM('completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."warehouse_pos_sale_type" AS ENUM('retail', 'wholesale');--> statement-breakpoint
ALTER TYPE "public"."ticket_priority" ADD VALUE 'critical';--> statement-breakpoint
CREATE TABLE "admin_invite" (
	"id" serial PRIMARY KEY NOT NULL,
	"invite_code" varchar(20) NOT NULL,
	"admin_user_id" text NOT NULL,
	"invite_method" varchar(30) DEFAULT 'direct_call' NOT NULL,
	"invited_phone" varchar(20) NOT NULL,
	"invited_name" varchar(255),
	"invited_user_id" text,
	"user_type" varchar(20) DEFAULT 'retailer' NOT NULL,
	"status" varchar(20) DEFAULT 'invited' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_invite_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "carton_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"variant_id" integer NOT NULL,
	"packs_per_carton" integer NOT NULL,
	"carton_weight_kg" numeric(12, 2) NOT NULL,
	"carton_price" numeric(10, 2) NOT NULL,
	"carton_cost_price" numeric(10, 2),
	"delivery_cost_per_carton" numeric(10, 2),
	"label" varchar(100),
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carton" (
	"id" serial PRIMARY KEY NOT NULL,
	"carton_id" varchar(30) NOT NULL,
	"warehouse_id" text NOT NULL,
	"carton_config_id" integer,
	"variant_id" integer NOT NULL,
	"total_packs" integer NOT NULL,
	"total_weight_kg" numeric(12, 2) NOT NULL,
	"status" "carton_status" DEFAULT 'active' NOT NULL,
	"barcode" varchar(100),
	"qr_code" varchar(255),
	"broken_at" timestamp,
	"broken_by_id" text,
	"storage_area_id" integer,
	"note" text,
	"carton_price" numeric(10, 2),
	"delivery_cost_per_unit" numeric(10, 2),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "carton_carton_id_unique" UNIQUE("carton_id")
);
--> statement-breakpoint
CREATE TABLE "complaint" (
	"id" serial PRIMARY KEY NOT NULL,
	"complaint_number" text NOT NULL,
	"user_id" text NOT NULL,
	"user_type" text DEFAULT 'customer' NOT NULL,
	"order_id" integer NOT NULL,
	"type" "complaint_type" DEFAULT 'delivery' NOT NULL,
	"priority" "complaint_priority" DEFAULT 'medium' NOT NULL,
	"status" "complaint_status" DEFAULT 'open' NOT NULL,
	"description" text NOT NULL,
	"user_comment" text,
	"assigned_admin_id" text,
	"delay_reason" text,
	"investigation_notes" text,
	"resolution" text,
	"compensation_amount" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"closed_at" timestamp,
	CONSTRAINT "complaint_complaint_number_unique" UNIQUE("complaint_number")
);
--> statement-breakpoint
CREATE TABLE "complaint_action_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"complaint_id" integer NOT NULL,
	"action" text NOT NULL,
	"performed_by" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "complaint_reply" (
	"id" serial PRIMARY KEY NOT NULL,
	"complaint_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"message" text NOT NULL,
	"is_admin_reply" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "damage_entry" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_no" text NOT NULL,
	"shop_id" text NOT NULL,
	"damage_type" "damage_type" NOT NULL,
	"description" text,
	"proof_images" text[] DEFAULT '{}' NOT NULL,
	"total_qty" integer DEFAULT 0 NOT NULL,
	"total_loss_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"entered_by_name" text,
	"entry_date" date NOT NULL,
	"status" "damage_status" DEFAULT 'active' NOT NULL,
	"created_by_id" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "damage_entry_entry_no_unique" UNIQUE("entry_no")
);
--> statement-breakpoint
CREATE TABLE "damage_entry_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"damage_entry_id" integer NOT NULL,
	"inventory_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"qty" integer NOT NULL,
	"unit_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "delivery_area" (
	"id" serial PRIMARY KEY NOT NULL,
	"warehouse_id" text NOT NULL,
	"name" varchar(150) NOT NULL,
	"slug" varchar(150) NOT NULL,
	"description" text,
	"polygon" jsonb,
	"center_lat" text,
	"center_lng" text,
	"radius_km" text,
	"status" "delivery_area_status" DEFAULT 'active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"area_id" integer NOT NULL,
	"warehouse_id" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"default_rider_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_brand" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"brand_id" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variant_price" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"variant_option_id" integer NOT NULL,
	"brand_id" integer,
	"consumer_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_ticket_attachment" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"url" text NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_ticket_note" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variant_option" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"unit" varchar(20) NOT NULL,
	"size" varchar(20),
	"variant_type" "variant_option_type" DEFAULT 'pack' NOT NULL,
	"type_id" integer,
	"category_id" integer,
	"sku_code" varchar(2),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite" (
	"id" serial PRIMARY KEY NOT NULL,
	"invite_code" varchar(20) NOT NULL,
	"inviter_user_id" text NOT NULL,
	"invited_phone" varchar(20) NOT NULL,
	"invited_user_id" text,
	"user_type" varchar(20) DEFAULT 'retailer' NOT NULL,
	"status" varchar(20) DEFAULT 'invited' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invite_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "reward" (
	"id" serial PRIMARY KEY NOT NULL,
	"reward_code" varchar(20) NOT NULL,
	"user_id" text NOT NULL,
	"invite_id" integer,
	"source" varchar(30) DEFAULT 'referral_invite' NOT NULL,
	"amount" integer NOT NULL,
	"reward_type" varchar(30) DEFAULT 'cash_bonus' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"fraud_check" varchar(20) DEFAULT 'passed' NOT NULL,
	"fraud_reason" text,
	"approved_by" text,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reward_reward_code_unique" UNIQUE("reward_code")
);
--> statement-breakpoint
CREATE TABLE "wallet" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "product_identity_request" (
	"id" serial PRIMARY KEY NOT NULL,
	"requested_by" text NOT NULL,
	"type_name" varchar(100),
	"category_name" varchar(100),
	"sub_category_name" varchar(100),
	"product_name" varchar(200) NOT NULL,
	"description" text,
	"reference_image" varchar(500),
	"status" "product_request_status" DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_material" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"category" text DEFAULT 'shop_branding',
	"design_file_url" text,
	"size_format" text,
	"description" text,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_material_request" (
	"id" text PRIMARY KEY NOT NULL,
	"request_number" text NOT NULL,
	"material_id" text NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"user_type" text NOT NULL,
	"quantity" integer NOT NULL,
	"delivery_type" text DEFAULT 'courier' NOT NULL,
	"payment_type" text DEFAULT 'free' NOT NULL,
	"payment_amount" integer DEFAULT 0,
	"delivery_address" text,
	"delivery_contact" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp,
	"dispatched_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_material_request_request_number_unique" UNIQUE("request_number")
);
--> statement-breakpoint
CREATE TABLE "stock_entry" (
	"id" serial PRIMARY KEY NOT NULL,
	"warehouse_id" text NOT NULL,
	"variant_id" integer NOT NULL,
	"entry_type" "stock_entry_type" NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"quantity_unit" varchar(20) NOT NULL,
	"converted_qty_kg" numeric(12, 2) NOT NULL,
	"converted_qty_packs" numeric(12, 2) NOT NULL,
	"supplier_id" integer,
	"cost_type" "stock_entry_cost_type" NOT NULL,
	"purchase_price" numeric(10, 2) NOT NULL,
	"total_cost" numeric(12, 2) NOT NULL,
	"reference" varchar(150),
	"batch_no" varchar(100),
	"expiry_date" date,
	"manufacture_date" date,
	"storage_area_id" integer,
	"shelf_rack" varchar(100),
	"note" text,
	"carton_count" integer,
	"carton_config_id" integer,
	"converted_qty_cartons" numeric(12, 2),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_storage_area" (
	"id" serial PRIMARY KEY NOT NULL,
	"warehouse_id" text NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_adjustment" (
	"id" serial PRIMARY KEY NOT NULL,
	"adjustment_no" varchar(20) NOT NULL,
	"warehouse_id" text NOT NULL,
	"adjustment_type" "adjustment_type" NOT NULL,
	"reason" "adjustment_reason" NOT NULL,
	"reference_note" text,
	"adjustment_date" date NOT NULL,
	"status" "adjustment_status" DEFAULT 'draft' NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"total_qty_change" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_by_id" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_adjustment_adjustment_no_unique" UNIQUE("adjustment_no")
);
--> statement-breakpoint
CREATE TABLE "stock_adjustment_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"adjustment_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"current_qty" numeric(12, 2) DEFAULT '0' NOT NULL,
	"adjust_qty" numeric(12, 2) NOT NULL,
	"after_qty" numeric(12, 2) DEFAULT '0' NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "warehouse_pos_cart" (
	"id" serial PRIMARY KEY NOT NULL,
	"warehouse_id" text NOT NULL,
	"customer_id" integer,
	"held_ref" varchar(40) NOT NULL,
	"cart_data" jsonb NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" "warehouse_pos_cart_status" DEFAULT 'held' NOT NULL,
	"held_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "warehouse_pos_cart_held_ref_unique" UNIQUE("held_ref")
);
--> statement-breakpoint
CREATE TABLE "warehouse_pos_customer" (
	"id" serial PRIMARY KEY NOT NULL,
	"warehouse_id" text NOT NULL,
	"linked_user_id" text,
	"name" varchar(150) NOT NULL,
	"phone" varchar(30),
	"address" text,
	"customer_type" "warehouse_pos_customer_type" DEFAULT 'walk_in' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_pos_payment" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"payment_method" "warehouse_pos_payment_method" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"transaction_ref" varchar(100),
	"note" text,
	"paid_at" timestamp DEFAULT now() NOT NULL,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_pos_sale" (
	"id" serial PRIMARY KEY NOT NULL,
	"warehouse_id" text NOT NULL,
	"sale_type" "warehouse_pos_sale_type" DEFAULT 'retail' NOT NULL,
	"invoice_no" varchar(40) NOT NULL,
	"customer_id" integer,
	"customer_name" varchar(150) NOT NULL,
	"customer_phone" varchar(30),
	"customer_address" text,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"due" numeric(12, 2) DEFAULT '0' NOT NULL,
	"payment_method" "warehouse_pos_payment_method" NOT NULL,
	"status" "warehouse_pos_sale_status" DEFAULT 'completed' NOT NULL,
	"note" text,
	"held_cart_id" integer,
	"sold_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "warehouse_pos_sale_invoice_no_unique" UNIQUE("invoice_no")
);
--> statement-breakpoint
CREATE TABLE "warehouse_pos_sale_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"variant_id" integer,
	"product_id" integer,
	"sku" varchar(100),
	"product_name" varchar(160) NOT NULL,
	"variant_label" varchar(200) NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit_label" varchar(50) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_product_brand" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_product_pack_variant" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stock_ledger" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "core_product_brand" CASCADE;--> statement-breakpoint
DROP TABLE "core_product_pack_variant" CASCADE;--> statement-breakpoint
DROP TABLE "stock_ledger" CASCADE;--> statement-breakpoint
ALTER TABLE "core_product_identity" DROP CONSTRAINT "core_product_identity_sku_unique";--> statement-breakpoint
ALTER TABLE "brand" ALTER COLUMN "logo" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "category" ALTER COLUMN "image" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sub_category" ALTER COLUMN "image" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "warehouse_id" text;--> statement-breakpoint
ALTER TABLE "brand" ADD COLUMN "sku_code" varchar(2);--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "sku_code" varchar(3);--> statement-breakpoint
ALTER TABLE "sub_category" ADD COLUMN "sku_code" varchar(3);--> statement-breakpoint
ALTER TABLE "core_product_identity" ADD COLUMN "supports_pack" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "core_product_identity" ADD COLUMN "supports_loose" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_group" ADD COLUMN "warehouse_id" text;--> statement-breakpoint
ALTER TABLE "product_type" ADD COLUMN "sku_code" varchar(2);--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "in_carton_qty" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "active_carton_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "tracking_id" varchar(100);--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "rider_name" varchar(150);--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "rider_phone" varchar(20);--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "received_at" timestamp;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "modified_by_warehouse_at" timestamp;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "modification_accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "modification_rejected_at" timestamp;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "processing_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "packing_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "ready_at" timestamp;--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "modified_qty" integer;--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "modified_unit_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "delivered_qty" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "supply_mode" varchar(20);--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "target_variant_id" integer;--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "conversion_status" varchar(20) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "converted_qty" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "core_product_id" integer;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "short_description" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "video_url" varchar(500);--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "tracking_type" "tracking_type" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "expiry_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "damage_control_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "visibility" "product_visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "scheduled_at" timestamp;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "created_by_warehouse_id" text;--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "source_variant_price_id" integer;--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "source_variant_option_id" integer;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD COLUMN "category" "ticket_category" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD COLUMN "user_type" text DEFAULT 'customer' NOT NULL;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD COLUMN "assigned_to_id" text;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD COLUMN "current_level" varchar(10) DEFAULT 'level_1' NOT NULL;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD COLUMN "escalation_deadline" timestamp;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD COLUMN "auto_escalated" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD COLUMN "escalated_at" timestamp;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD COLUMN "escalated_by" text;--> statement-breakpoint
ALTER TABLE "admin_invite" ADD CONSTRAINT "admin_invite_admin_user_id_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_invite" ADD CONSTRAINT "admin_invite_invited_user_id_user_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carton_config" ADD CONSTRAINT "carton_config_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carton" ADD CONSTRAINT "carton_warehouse_id_user_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carton" ADD CONSTRAINT "carton_carton_config_id_carton_config_id_fk" FOREIGN KEY ("carton_config_id") REFERENCES "public"."carton_config"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carton" ADD CONSTRAINT "carton_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carton" ADD CONSTRAINT "carton_broken_by_id_user_id_fk" FOREIGN KEY ("broken_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carton" ADD CONSTRAINT "carton_storage_area_id_warehouse_storage_area_id_fk" FOREIGN KEY ("storage_area_id") REFERENCES "public"."warehouse_storage_area"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint" ADD CONSTRAINT "complaint_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint" ADD CONSTRAINT "complaint_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint" ADD CONSTRAINT "complaint_assigned_admin_id_user_id_fk" FOREIGN KEY ("assigned_admin_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_action_log" ADD CONSTRAINT "complaint_action_log_complaint_id_complaint_id_fk" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaint"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_action_log" ADD CONSTRAINT "complaint_action_log_performed_by_user_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_reply" ADD CONSTRAINT "complaint_reply_complaint_id_complaint_id_fk" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaint"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_reply" ADD CONSTRAINT "complaint_reply_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_entry" ADD CONSTRAINT "damage_entry_shop_id_user_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_entry" ADD CONSTRAINT "damage_entry_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_entry_item" ADD CONSTRAINT "damage_entry_item_damage_entry_id_damage_entry_id_fk" FOREIGN KEY ("damage_entry_id") REFERENCES "public"."damage_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_entry_item" ADD CONSTRAINT "damage_entry_item_inventory_id_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_entry_item" ADD CONSTRAINT "damage_entry_item_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_area" ADD CONSTRAINT "delivery_area_warehouse_id_user_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_schedule" ADD CONSTRAINT "delivery_schedule_area_id_delivery_area_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."delivery_area"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_schedule" ADD CONSTRAINT "delivery_schedule_warehouse_id_user_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_schedule" ADD CONSTRAINT "delivery_schedule_default_rider_id_user_id_fk" FOREIGN KEY ("default_rider_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_brand" ADD CONSTRAINT "product_brand_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_brand" ADD CONSTRAINT "product_brand_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_price" ADD CONSTRAINT "product_variant_price_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_price" ADD CONSTRAINT "product_variant_price_variant_option_id_variant_option_id_fk" FOREIGN KEY ("variant_option_id") REFERENCES "public"."variant_option"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_price" ADD CONSTRAINT "product_variant_price_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_attachment" ADD CONSTRAINT "support_ticket_attachment_ticket_id_support_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_attachment" ADD CONSTRAINT "support_ticket_attachment_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_note" ADD CONSTRAINT "support_ticket_note_ticket_id_support_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_note" ADD CONSTRAINT "support_ticket_note_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_option" ADD CONSTRAINT "variant_option_type_id_product_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."product_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_option" ADD CONSTRAINT "variant_option_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_inviter_user_id_user_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_invited_user_id_user_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward" ADD CONSTRAINT "reward_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward" ADD CONSTRAINT "reward_invite_id_invite_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."invite"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward" ADD CONSTRAINT "reward_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet" ADD CONSTRAINT "wallet_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_identity_request" ADD CONSTRAINT "product_identity_request_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_identity_request" ADD CONSTRAINT "product_identity_request_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_material_request" ADD CONSTRAINT "marketing_material_request_material_id_marketing_material_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."marketing_material"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_material_request" ADD CONSTRAINT "marketing_material_request_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_material_request" ADD CONSTRAINT "marketing_material_request_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_entry" ADD CONSTRAINT "stock_entry_warehouse_id_user_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_entry" ADD CONSTRAINT "stock_entry_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_entry" ADD CONSTRAINT "stock_entry_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_entry" ADD CONSTRAINT "stock_entry_storage_area_id_warehouse_storage_area_id_fk" FOREIGN KEY ("storage_area_id") REFERENCES "public"."warehouse_storage_area"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_entry" ADD CONSTRAINT "stock_entry_carton_config_id_carton_config_id_fk" FOREIGN KEY ("carton_config_id") REFERENCES "public"."carton_config"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_storage_area" ADD CONSTRAINT "warehouse_storage_area_warehouse_id_user_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustment" ADD CONSTRAINT "stock_adjustment_warehouse_id_user_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustment" ADD CONSTRAINT "stock_adjustment_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustment_item" ADD CONSTRAINT "stock_adjustment_item_adjustment_id_stock_adjustment_id_fk" FOREIGN KEY ("adjustment_id") REFERENCES "public"."stock_adjustment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustment_item" ADD CONSTRAINT "stock_adjustment_item_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_pos_cart" ADD CONSTRAINT "warehouse_pos_cart_warehouse_id_user_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_pos_cart" ADD CONSTRAINT "warehouse_pos_cart_customer_id_warehouse_pos_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."warehouse_pos_customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_pos_cart" ADD CONSTRAINT "warehouse_pos_cart_held_by_id_user_id_fk" FOREIGN KEY ("held_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_pos_customer" ADD CONSTRAINT "warehouse_pos_customer_warehouse_id_user_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_pos_customer" ADD CONSTRAINT "warehouse_pos_customer_linked_user_id_user_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_pos_customer" ADD CONSTRAINT "warehouse_pos_customer_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_pos_payment" ADD CONSTRAINT "warehouse_pos_payment_sale_id_warehouse_pos_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."warehouse_pos_sale"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_pos_payment" ADD CONSTRAINT "warehouse_pos_payment_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD CONSTRAINT "warehouse_pos_sale_warehouse_id_user_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD CONSTRAINT "warehouse_pos_sale_customer_id_warehouse_pos_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."warehouse_pos_customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD CONSTRAINT "warehouse_pos_sale_held_cart_id_warehouse_pos_cart_id_fk" FOREIGN KEY ("held_cart_id") REFERENCES "public"."warehouse_pos_cart"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale" ADD CONSTRAINT "warehouse_pos_sale_sold_by_id_user_id_fk" FOREIGN KEY ("sold_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale_item" ADD CONSTRAINT "warehouse_pos_sale_item_sale_id_warehouse_pos_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."warehouse_pos_sale"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale_item" ADD CONSTRAINT "warehouse_pos_sale_item_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale_item" ADD CONSTRAINT "warehouse_pos_sale_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_invite_admin_idx" ON "admin_invite" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "admin_invite_phone_idx" ON "admin_invite" USING btree ("invited_phone");--> statement-breakpoint
CREATE INDEX "admin_invite_status_idx" ON "admin_invite" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cartonConfig_variantId_idx" ON "carton_config" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "carton_warehouseId_idx" ON "carton" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "carton_variantId_idx" ON "carton" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "carton_status_idx" ON "carton" USING btree ("status");--> statement-breakpoint
CREATE INDEX "carton_cartonId_idx" ON "carton" USING btree ("carton_id");--> statement-breakpoint
CREATE INDEX "complaint_userId_idx" ON "complaint" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "complaint_orderId_idx" ON "complaint" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "complaint_status_idx" ON "complaint" USING btree ("status");--> statement-breakpoint
CREATE INDEX "complaint_type_idx" ON "complaint" USING btree ("type");--> statement-breakpoint
CREATE INDEX "complaint_priority_idx" ON "complaint" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "complaint_complaintNumber_idx" ON "complaint" USING btree ("complaint_number");--> statement-breakpoint
CREATE INDEX "complaint_userType_idx" ON "complaint" USING btree ("user_type");--> statement-breakpoint
CREATE INDEX "complaint_assignedAdminId_idx" ON "complaint" USING btree ("assigned_admin_id");--> statement-breakpoint
CREATE INDEX "complaintActionLog_complaintId_idx" ON "complaint_action_log" USING btree ("complaint_id");--> statement-breakpoint
CREATE INDEX "complaintActionLog_performedBy_idx" ON "complaint_action_log" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "complaintReply_complaintId_idx" ON "complaint_reply" USING btree ("complaint_id");--> statement-breakpoint
CREATE INDEX "complaintReply_userId_idx" ON "complaint_reply" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "damageEntry_shopId_idx" ON "damage_entry" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "damageEntry_status_idx" ON "damage_entry" USING btree ("status");--> statement-breakpoint
CREATE INDEX "damageEntry_entryDate_idx" ON "damage_entry" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "damageEntry_entryNo_idx" ON "damage_entry" USING btree ("entry_no");--> statement-breakpoint
CREATE INDEX "damageItem_entryId_idx" ON "damage_entry_item" USING btree ("damage_entry_id");--> statement-breakpoint
CREATE INDEX "damageItem_variantId_idx" ON "damage_entry_item" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "deliveryArea_warehouseId_idx" ON "delivery_area" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "deliveryArea_slug_idx" ON "delivery_area" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "deliverySchedule_areaId_idx" ON "delivery_schedule" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "deliverySchedule_warehouseId_idx" ON "delivery_schedule" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "deliverySchedule_dayOfWeek_idx" ON "delivery_schedule" USING btree ("day_of_week");--> statement-breakpoint
CREATE INDEX "supportTicketAttachment_ticketId_idx" ON "support_ticket_attachment" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "supportTicketNote_ticketId_idx" ON "support_ticket_note" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "invite_inviter_idx" ON "invite" USING btree ("inviter_user_id");--> statement-breakpoint
CREATE INDEX "invite_invited_phone_idx" ON "invite" USING btree ("invited_phone");--> statement-breakpoint
CREATE INDEX "invite_status_idx" ON "invite" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reward_user_idx" ON "reward" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reward_invite_idx" ON "reward" USING btree ("invite_id");--> statement-breakpoint
CREATE INDEX "reward_status_idx" ON "reward" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wallet_user_idx" ON "wallet" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "marketing_material_type_idx" ON "marketing_material" USING btree ("type");--> statement-breakpoint
CREATE INDEX "marketing_material_status_idx" ON "marketing_material" USING btree ("status");--> statement-breakpoint
CREATE INDEX "marketing_material_category_idx" ON "marketing_material" USING btree ("category");--> statement-breakpoint
CREATE INDEX "mmr_material_id_idx" ON "marketing_material_request" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "mmr_requested_by_idx" ON "marketing_material_request" USING btree ("requested_by_user_id");--> statement-breakpoint
CREATE INDEX "mmr_status_idx" ON "marketing_material_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mmr_user_type_idx" ON "marketing_material_request" USING btree ("user_type");--> statement-breakpoint
CREATE INDEX "mmr_request_number_idx" ON "marketing_material_request" USING btree ("request_number");--> statement-breakpoint
CREATE INDEX "stockEntry_warehouseId_idx" ON "stock_entry" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "stockEntry_variantId_idx" ON "stock_entry" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "stockEntry_supplierId_idx" ON "stock_entry" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "warehouseStorageArea_warehouseId_idx" ON "warehouse_storage_area" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "stockAdj_warehouseId_idx" ON "stock_adjustment" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "stockAdj_status_idx" ON "stock_adjustment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stockAdj_adjustmentDate_idx" ON "stock_adjustment" USING btree ("adjustment_date");--> statement-breakpoint
CREATE INDEX "stockAdj_adjustmentNo_idx" ON "stock_adjustment" USING btree ("adjustment_no");--> statement-breakpoint
CREATE INDEX "stockAdjItem_adjustmentId_idx" ON "stock_adjustment_item" USING btree ("adjustment_id");--> statement-breakpoint
CREATE INDEX "stockAdjItem_variantId_idx" ON "stock_adjustment_item" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "warehousePosCart_warehouseId_idx" ON "warehouse_pos_cart" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "warehousePosCart_customerId_idx" ON "warehouse_pos_cart" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "warehousePosCart_status_idx" ON "warehouse_pos_cart" USING btree ("status");--> statement-breakpoint
CREATE INDEX "warehousePosCustomer_warehouseId_idx" ON "warehouse_pos_customer" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "warehousePosCustomer_phone_idx" ON "warehouse_pos_customer" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "warehousePosCustomer_linkedUserId_idx" ON "warehouse_pos_customer" USING btree ("linked_user_id");--> statement-breakpoint
CREATE INDEX "warehousePosPayment_saleId_idx" ON "warehouse_pos_payment" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "warehousePosPayment_method_idx" ON "warehouse_pos_payment" USING btree ("payment_method");--> statement-breakpoint
CREATE INDEX "warehousePosSale_warehouseId_idx" ON "warehouse_pos_sale" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "warehousePosSale_customerId_idx" ON "warehouse_pos_sale" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "warehousePosSale_saleType_idx" ON "warehouse_pos_sale" USING btree ("sale_type");--> statement-breakpoint
CREATE INDEX "warehousePosSale_createdAt_idx" ON "warehouse_pos_sale" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "warehousePosSaleItem_saleId_idx" ON "warehouse_pos_sale_item" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "warehousePosSaleItem_variantId_idx" ON "warehouse_pos_sale_item" USING btree ("variant_id");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_warehouse_id_user_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_group" ADD CONSTRAINT "delivery_group_warehouse_id_user_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_target_variant_id_product_variant_id_fk" FOREIGN KEY ("target_variant_id") REFERENCES "public"."product_variant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_core_product_id_core_product_identity_id_fk" FOREIGN KEY ("core_product_id") REFERENCES "public"."core_product_identity"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_source_variant_price_id_product_variant_price_id_fk" FOREIGN KEY ("source_variant_price_id") REFERENCES "public"."product_variant_price"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_source_variant_option_id_variant_option_id_fk" FOREIGN KEY ("source_variant_option_id") REFERENCES "public"."variant_option"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_assigned_to_id_user_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_escalated_by_user_id_fk" FOREIGN KEY ("escalated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supportTicket_category_idx" ON "support_ticket" USING btree ("category");--> statement-breakpoint
CREATE INDEX "supportTicket_userType_idx" ON "support_ticket" USING btree ("user_type");--> statement-breakpoint
CREATE INDEX "supportTicket_priority_idx" ON "support_ticket" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "supportTicket_assignedToId_idx" ON "support_ticket" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "supportTicket_currentLevel_idx" ON "support_ticket" USING btree ("current_level");--> statement-breakpoint
ALTER TABLE "brand" DROP COLUMN "is_active";--> statement-breakpoint
ALTER TABLE "core_product_identity" DROP COLUMN "brand_support";--> statement-breakpoint
ALTER TABLE "core_product_identity" DROP COLUMN "variant_support_pack";--> statement-breakpoint
ALTER TABLE "core_product_identity" DROP COLUMN "variant_support_loose";--> statement-breakpoint
ALTER TABLE "core_product_identity" DROP COLUMN "default_loose_unit";--> statement-breakpoint
ALTER TABLE "core_product_identity" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "core_product_identity" DROP COLUMN "display_order";--> statement-breakpoint
ALTER TABLE "product_type" DROP COLUMN "enable_brand";--> statement-breakpoint
ALTER TABLE "product_type" DROP COLUMN "enable_color";--> statement-breakpoint
ALTER TABLE "product_type" DROP COLUMN "enable_size";--> statement-breakpoint
ALTER TABLE "product_type" DROP COLUMN "enable_design";--> statement-breakpoint
ALTER TABLE "product_type" DROP COLUMN "enable_variant";--> statement-breakpoint
ALTER TABLE "product" DROP COLUMN "stock_quantity";--> statement-breakpoint
ALTER TABLE "brand" ADD CONSTRAINT "brand_sku_code_unique" UNIQUE("sku_code");--> statement-breakpoint
ALTER TABLE "product_type" ADD CONSTRAINT "product_type_sku_code_unique" UNIQUE("sku_code");--> statement-breakpoint
DROP TYPE "public"."brand_support";--> statement-breakpoint
DROP TYPE "public"."core_product_status";--> statement-breakpoint
DROP TYPE "public"."stock_ledger_change_type";--> statement-breakpoint
DROP TYPE "public"."stock_ledger_ref_type";