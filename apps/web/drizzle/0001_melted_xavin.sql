DO $$ BEGIN
  CREATE TYPE "public"."delivery_group_status" AS ENUM('pending', 'assigned', 'out_for_delivery', 'completed', 'partial');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."delivery_order_status" AS ENUM('pending', 'delivered', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."estimate_status" AS ENUM('draft', 'sent', 'approved', 'rejected', 'converted');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."refund_type" AS ENUM('cash', 'wallet', 'adjustment');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."return_status" AS ENUM('pending', 'approved', 'rejected', 'processed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."return_type" AS ENUM('full', 'partial');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
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
CREATE TABLE "delivery_group" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_name" text NOT NULL,
	"deliveryman_id" text,
	"status" "delivery_group_status" DEFAULT 'pending' NOT NULL,
	"total_orders" integer DEFAULT 0 NOT NULL,
	"completed_orders" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"assigned_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "delivery_group_order" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"status" "delivery_order_status" DEFAULT 'pending' NOT NULL,
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
CREATE TABLE "wishlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"product_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_user_product_unique" UNIQUE("user_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "order_return" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"processed_by" text,
	"reason" text NOT NULL,
	"return_type" "return_type" DEFAULT 'full' NOT NULL,
	"items" jsonb,
	"total_amount" numeric(10, 2) NOT NULL,
	"refund_type" "refund_type",
	"status" "return_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"admin_notes" text,
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
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
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
ALTER TABLE "order" ALTER COLUMN "payment_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "payment_status" SET DEFAULT 'pending'::text;--> statement-breakpoint
ALTER TABLE "payment" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "payment" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."payment_status";--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded', 'cancelled');--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "payment_status" SET DEFAULT 'pending'::"public"."payment_status";--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "payment_status" SET DATA TYPE "public"."payment_status" USING "payment_status"::"public"."payment_status";--> statement-breakpoint
ALTER TABLE "payment" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."payment_status";--> statement-breakpoint
ALTER TABLE "payment" ALTER COLUMN "status" SET DATA TYPE "public"."payment_status" USING "status"::"public"."payment_status";--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "brand_id" integer;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_group" ADD CONSTRAINT "delivery_group_deliveryman_id_user_id_fk" FOREIGN KEY ("deliveryman_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_group_order" ADD CONSTRAINT "delivery_group_order_group_id_delivery_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."delivery_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_group_order" ADD CONSTRAINT "delivery_group_order_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate" ADD CONSTRAINT "estimate_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate" ADD CONSTRAINT "estimate_salesman_id_user_id_fk" FOREIGN KEY ("salesman_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_item" ADD CONSTRAINT "estimate_item_estimate_id_estimate_id_fk" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_item" ADD CONSTRAINT "estimate_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_review" ADD CONSTRAINT "product_review_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_review" ADD CONSTRAINT "product_review_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_return" ADD CONSTRAINT "order_return_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_return" ADD CONSTRAINT "order_return_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_return" ADD CONSTRAINT "order_return_processed_by_user_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "address_userId_idx" ON "address" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "deliveryGroup_deliverymanId_idx" ON "delivery_group" USING btree ("deliveryman_id");--> statement-breakpoint
CREATE INDEX "deliveryGroup_status_idx" ON "delivery_group" USING btree ("status");--> statement-breakpoint
CREATE INDEX "deliveryGroupOrder_groupId_idx" ON "delivery_group_order" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "deliveryGroupOrder_orderId_idx" ON "delivery_group_order" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "deliveryGroupOrder_status_idx" ON "delivery_group_order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "estimate_customerId_idx" ON "estimate" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "estimate_salesmanId_idx" ON "estimate" USING btree ("salesman_id");--> statement-breakpoint
CREATE INDEX "estimate_status_idx" ON "estimate" USING btree ("status");--> statement-breakpoint
CREATE INDEX "estimate_estimateNumber_idx" ON "estimate" USING btree ("estimate_number");--> statement-breakpoint
CREATE INDEX "estimateItem_estimateId_idx" ON "estimate_item" USING btree ("estimate_id");--> statement-breakpoint
CREATE INDEX "estimateItem_productId_idx" ON "estimate_item" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "review_productId_idx" ON "product_review" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "review_userId_idx" ON "product_review" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wishlist_userId_idx" ON "wishlist" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wishlist_productId_idx" ON "wishlist" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "orderReturn_orderId_idx" ON "order_return" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orderReturn_userId_idx" ON "order_return" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orderReturn_status_idx" ON "order_return" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orderReturn_processedBy_idx" ON "order_return" USING btree ("processed_by");--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE set null ON UPDATE no action;