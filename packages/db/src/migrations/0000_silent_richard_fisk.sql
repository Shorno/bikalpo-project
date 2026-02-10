CREATE TYPE "public"."delivery_group_status" AS ENUM('assigned', 'out_for_delivery', 'completed', 'partial');--> statement-breakpoint
CREATE TYPE "public"."delivery_invoice_status" AS ENUM('pending', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."estimate_status" AS ENUM('draft', 'pending', 'sent', 'approved', 'rejected', 'converted');--> statement-breakpoint
CREATE TYPE "public"."invoice_delivery_status" AS ENUM('not_assigned', 'pending', 'out_for_delivery', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."invoice_payment_status" AS ENUM('unpaid', 'collected', 'settled');--> statement-breakpoint
CREATE TYPE "public"."invoice_type" AS ENUM('main', 'split');--> statement-breakpoint
CREATE TYPE "public"."invoice_vehicle_type" AS ENUM('bike', 'car', 'van', 'truck');--> statement-breakpoint
CREATE TYPE "public"."item_request_status" AS ENUM('pending', 'approved', 'rejected', 'suggested');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'processing', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash_on_delivery', 'bkash', 'nagad', 'bank_transfer', 'card');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."refund_type" AS ENUM('cash', 'wallet', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."return_status" AS ENUM('pending', 'approved', 'rejected', 'processed');--> statement-breakpoint
CREATE TYPE "public"."return_type" AS ENUM('full', 'partial');--> statement-breakpoint
CREATE TYPE "public"."payment_transaction_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."stock_change_type" AS ENUM('add', 'reduce');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TABLE "address" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"label" text DEFAULT 'Home' NOT NULL,
	"recipient_name" text NOT NULL,
	"phone" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"area" text,
	"postal_code" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcement" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'info',
	"active" boolean DEFAULT true,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"phone_number" text,
	"phone_number_verified" boolean DEFAULT false,
	"shop_name" text,
	"owner_name" text,
	"role" text DEFAULT 'guest',
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"service_area" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_update" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'info',
	"active" boolean DEFAULT true,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"logo" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "brand_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "cart" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"cart_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"variant_id" integer,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"image" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "category_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sub_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"category_id" integer NOT NULL,
	"image" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sub_category_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "customer_assignment" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"salesman_id" text NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"assigned_by" text,
	CONSTRAINT "customer_assignment_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "delivery_rule" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150),
	"area" varchar(100),
	"min_weight_kg" numeric(10, 2),
	"max_weight_kg" numeric(10, 2),
	"base_cost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"per_kg_cost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"note" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_group" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_name" text NOT NULL,
	"deliveryman_id" text NOT NULL,
	"vehicle_type" "invoice_vehicle_type",
	"expected_delivery_at" timestamp,
	"status" "delivery_group_status" DEFAULT 'assigned' NOT NULL,
	"total_invoices" integer DEFAULT 0 NOT NULL,
	"completed_invoices" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"assigned_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "delivery_group_invoice" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"invoice_id" integer NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"status" "delivery_invoice_status" DEFAULT 'pending' NOT NULL,
	"delivered_at" timestamp,
	"failed_reason" text,
	"delivery_photo" text,
	"delivery_otp" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estimate" (
	"id" serial PRIMARY KEY NOT NULL,
	"estimate_number" text NOT NULL,
	"customer_id" text NOT NULL,
	"salesman_id" text NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"status" "estimate_status" DEFAULT 'draft' NOT NULL,
	"valid_until" date,
	"notes" text,
	"converted_order_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"approved_at" timestamp,
	"rejected_at" timestamp,
	"converted_at" timestamp,
	CONSTRAINT "estimate_estimate_number_unique" UNIQUE("estimate_number")
);
--> statement-breakpoint
CREATE TABLE "estimate_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"estimate_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"product_image" text,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"order_id" integer NOT NULL,
	"customer_id" text NOT NULL,
	"parent_invoice_id" integer,
	"split_sequence" integer,
	"invoice_type" "invoice_type" DEFAULT 'main' NOT NULL,
	"payment_status" "invoice_payment_status" DEFAULT 'unpaid' NOT NULL,
	"delivery_status" "invoice_delivery_status" DEFAULT 'not_assigned' NOT NULL,
	"deliveryman_id" text,
	"vehicle_type" "invoice_vehicle_type",
	"vehicle_info" text,
	"expected_delivery_at" timestamp,
	"subtotal" numeric(10, 2) NOT NULL,
	"discount_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"delivery_charge" numeric(10, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(10, 2) NOT NULL,
	"customer_notes" text,
	"admin_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	"delivered_at" timestamp,
	CONSTRAINT "invoice_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "invoice_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"product_sku" text,
	"product_image" text,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"line_total" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_request" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_number" text NOT NULL,
	"customer_id" text NOT NULL,
	"item_name" text NOT NULL,
	"brand" text,
	"category" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"description" text,
	"image" varchar(500),
	"status" "item_request_status" DEFAULT 'pending' NOT NULL,
	"admin_response" text,
	"suggested_product_id" integer,
	"processed_by_id" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "item_request_request_number_unique" UNIQUE("request_number")
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"user_id" text NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"shipping_cost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"previous_total" numeric(10, 2),
	"total_price_changed_at" timestamp,
	"confirmed_subtotal" numeric(10, 2),
	"confirmed_total" numeric(10, 2),
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"payment_method" "payment_method" DEFAULT 'cash_on_delivery' NOT NULL,
	"shipping_name" text NOT NULL,
	"shipping_phone" text NOT NULL,
	"shipping_email" text,
	"shipping_address" text NOT NULL,
	"shipping_city" text NOT NULL,
	"shipping_area" text,
	"shipping_postal_code" text,
	"customer_note" text,
	"admin_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp,
	"shipped_at" timestamp,
	"delivered_at" timestamp,
	"cancelled_at" timestamp,
	"admin_modified_at" timestamp,
	CONSTRAINT "order_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "order_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"variant_id" integer,
	"product_name" text NOT NULL,
	"product_image" text NOT NULL,
	"product_size" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_return" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"submitted_by" text,
	"processed_by" text,
	"reason" text NOT NULL,
	"return_type" "return_type" DEFAULT 'full' NOT NULL,
	"items" jsonb,
	"total_amount" numeric(10, 2) NOT NULL,
	"refund_type" "refund_type",
	"status" "return_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"admin_notes" text,
	"attachments" jsonb,
	"restocked" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"transaction_id" varchar(255),
	"payment_method" varchar(50) NOT NULL,
	"payment_provider" varchar(50) DEFAULT 'sslcommerz',
	"status" "payment_transaction_status" DEFAULT 'pending' NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'BDT' NOT NULL,
	"sender_number" varchar(20),
	"receiver_number" varchar(20),
	"completed_at" timestamp,
	"failed_at" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"slug" varchar(150) NOT NULL,
	"description" text,
	"category_id" integer NOT NULL,
	"sub_category_id" integer,
	"brand_id" integer,
	"size" varchar(50) NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"reorder_level" integer DEFAULT 0 NOT NULL,
	"sku" varchar(100),
	"supplier" text,
	"last_restocked_at" timestamp,
	"image" varchar(255) NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb,
	"in_stock" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "product_image" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"image_url" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variant" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"sku" varchar(100),
	"unit_label" varchar(50) NOT NULL,
	"quantity_selector_label" varchar(100),
	"packaging_type" varchar(20) NOT NULL,
	"weight_kg" numeric(10, 2) NOT NULL,
	"piece_weight_kg" numeric(10, 2),
	"pieces_per_unit" integer,
	"pricing_type" varchar(20) DEFAULT 'per_unit' NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"price_tiers" jsonb DEFAULT '[]'::jsonb,
	"order_min" numeric(12, 2) DEFAULT '1' NOT NULL,
	"order_max" numeric(12, 2),
	"order_increment" numeric(12, 2) DEFAULT '1' NOT NULL,
	"order_unit" varchar(20) DEFAULT 'piece' NOT NULL,
	"quantity_selector_options" jsonb DEFAULT '[]'::jsonb,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"reorder_level" integer DEFAULT 0 NOT NULL,
	"origin" varchar(100),
	"shelf_life" varchar(50),
	"packaging_note" text,
	"care" varchar(100),
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_review" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"title" varchar(100),
	"comment" text NOT NULL,
	"is_verified_purchase" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "review_product_user_unique" UNIQUE("product_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "stock_change_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"change_type" "stock_change_type" NOT NULL,
	"quantity" integer NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_id" text
);
--> statement-breakpoint
CREATE TABLE "support_ticket" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_number" text NOT NULL,
	"customer_id" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"closed_at" timestamp,
	CONSTRAINT "support_ticket_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
CREATE TABLE "support_ticket_reply" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"message" text NOT NULL,
	"is_staff_reply" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"business_name" text,
	"owner_name" text,
	"phone_number" text,
	"vat_number" text,
	"address" text,
	"facebook" text,
	"whatsapp" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "todo" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart" ADD CONSTRAINT "cart_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_cart_id_cart_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."cart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_category" ADD CONSTRAINT "sub_category_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_assignment" ADD CONSTRAINT "customer_assignment_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_assignment" ADD CONSTRAINT "customer_assignment_salesman_id_user_id_fk" FOREIGN KEY ("salesman_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_assignment" ADD CONSTRAINT "customer_assignment_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_group" ADD CONSTRAINT "delivery_group_deliveryman_id_user_id_fk" FOREIGN KEY ("deliveryman_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_group_invoice" ADD CONSTRAINT "delivery_group_invoice_group_id_delivery_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."delivery_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_group_invoice" ADD CONSTRAINT "delivery_group_invoice_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate" ADD CONSTRAINT "estimate_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate" ADD CONSTRAINT "estimate_salesman_id_user_id_fk" FOREIGN KEY ("salesman_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_item" ADD CONSTRAINT "estimate_item_estimate_id_estimate_id_fk" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_item" ADD CONSTRAINT "estimate_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_parent_invoice_id_invoice_id_fk" FOREIGN KEY ("parent_invoice_id") REFERENCES "public"."invoice"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_deliveryman_id_user_id_fk" FOREIGN KEY ("deliveryman_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_request" ADD CONSTRAINT "item_request_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_request" ADD CONSTRAINT "item_request_suggested_product_id_product_id_fk" FOREIGN KEY ("suggested_product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_request" ADD CONSTRAINT "item_request_processed_by_id_user_id_fk" FOREIGN KEY ("processed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_return" ADD CONSTRAINT "order_return_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_return" ADD CONSTRAINT "order_return_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_return" ADD CONSTRAINT "order_return_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_return" ADD CONSTRAINT "order_return_processed_by_user_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_sub_category_id_sub_category_id_fk" FOREIGN KEY ("sub_category_id") REFERENCES "public"."sub_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_review" ADD CONSTRAINT "product_review_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_review" ADD CONSTRAINT "product_review_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_change_log" ADD CONSTRAINT "stock_change_log_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_change_log" ADD CONSTRAINT "stock_change_log_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_reply" ADD CONSTRAINT "support_ticket_reply_ticket_id_support_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_reply" ADD CONSTRAINT "support_ticket_reply_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "address_userId_idx" ON "address" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "cart_userId_idx" ON "cart" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cartItem_cartId_idx" ON "cart_item" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "cartItem_productId_idx" ON "cart_item" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "cartItem_variantId_idx" ON "cart_item" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "customer_assignment_customer_idx" ON "customer_assignment" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_assignment_salesman_idx" ON "customer_assignment" USING btree ("salesman_id");--> statement-breakpoint
CREATE INDEX "deliveryGroup_deliverymanId_idx" ON "delivery_group" USING btree ("deliveryman_id");--> statement-breakpoint
CREATE INDEX "deliveryGroup_status_idx" ON "delivery_group" USING btree ("status");--> statement-breakpoint
CREATE INDEX "deliveryGroupInvoice_groupId_idx" ON "delivery_group_invoice" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "deliveryGroupInvoice_invoiceId_idx" ON "delivery_group_invoice" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "deliveryGroupInvoice_status_idx" ON "delivery_group_invoice" USING btree ("status");--> statement-breakpoint
CREATE INDEX "estimate_customerId_idx" ON "estimate" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "estimate_salesmanId_idx" ON "estimate" USING btree ("salesman_id");--> statement-breakpoint
CREATE INDEX "estimate_status_idx" ON "estimate" USING btree ("status");--> statement-breakpoint
CREATE INDEX "estimate_estimateNumber_idx" ON "estimate" USING btree ("estimate_number");--> statement-breakpoint
CREATE INDEX "estimateItem_estimateId_idx" ON "estimate_item" USING btree ("estimate_id");--> statement-breakpoint
CREATE INDEX "estimateItem_productId_idx" ON "estimate_item" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "invoice_orderId_idx" ON "invoice" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "invoice_customerId_idx" ON "invoice" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "invoice_deliveryStatus_idx" ON "invoice" USING btree ("delivery_status");--> statement-breakpoint
CREATE INDEX "invoice_invoiceNumber_idx" ON "invoice" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "invoice_parentInvoiceId_idx" ON "invoice" USING btree ("parent_invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_deliverymanId_idx" ON "invoice" USING btree ("deliveryman_id");--> statement-breakpoint
CREATE INDEX "invoiceItem_invoiceId_idx" ON "invoice_item" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoiceItem_productId_idx" ON "invoice_item" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "itemRequest_customerId_idx" ON "item_request" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "itemRequest_status_idx" ON "item_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "itemRequest_requestNumber_idx" ON "item_request" USING btree ("request_number");--> statement-breakpoint
CREATE INDEX "itemRequest_processedById_idx" ON "item_request" USING btree ("processed_by_id");--> statement-breakpoint
CREATE INDEX "order_userId_idx" ON "order" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "order_status_idx" ON "order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_orderNumber_idx" ON "order" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "orderItem_orderId_idx" ON "order_item" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orderItem_productId_idx" ON "order_item" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "orderItem_variantId_idx" ON "order_item" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "orderReturn_orderId_idx" ON "order_return" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orderReturn_userId_idx" ON "order_return" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orderReturn_status_idx" ON "order_return" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orderReturn_processedBy_idx" ON "order_return" USING btree ("processed_by");--> statement-breakpoint
CREATE INDEX "review_productId_idx" ON "product_review" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "review_userId_idx" ON "product_review" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stockChangeLog_productId_idx" ON "stock_change_log" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stockChangeLog_createdAt_idx" ON "stock_change_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "supportTicket_customerId_idx" ON "support_ticket" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "supportTicket_status_idx" ON "support_ticket" USING btree ("status");--> statement-breakpoint
CREATE INDEX "supportTicket_ticketNumber_idx" ON "support_ticket" USING btree ("ticket_number");--> statement-breakpoint
CREATE INDEX "supportTicketReply_ticketId_idx" ON "support_ticket_reply" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "supportTicketReply_userId_idx" ON "support_ticket_reply" USING btree ("user_id");