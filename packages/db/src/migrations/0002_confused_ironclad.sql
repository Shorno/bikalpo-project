CREATE TYPE "public"."b2b_order_type" AS ENUM('b2b', 'b2c');--> statement-breakpoint
ALTER TYPE "public"."inventory_owner_type" ADD VALUE 'warehouse';--> statement-breakpoint
CREATE TABLE "warehouse_application" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"warehouse_name" text NOT NULL,
	"owner_name" text NOT NULL,
	"phone_number" text NOT NULL,
	"warehouse_address" text NOT NULL,
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
ALTER TABLE "user" ADD COLUMN "warehouse_name" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "warehouse_slug" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "warehouse_address" text;--> statement-breakpoint
ALTER TABLE "cart_item" ADD COLUMN "shop_id" text;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "retail_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "order_type" "b2b_order_type" DEFAULT 'b2c' NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "shop_id" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "warehouse_id" text;--> statement-breakpoint
ALTER TABLE "warehouse_application" ADD CONSTRAINT "warehouse_application_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_application" ADD CONSTRAINT "warehouse_application_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "warehouse_application_userId_idx" ON "warehouse_application" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "warehouse_application_status_idx" ON "warehouse_application" USING btree ("status");--> statement-breakpoint
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_shop_id_user_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_shop_id_user_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_warehouse_id_user_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cartItem_shopId_idx" ON "cart_item" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "order_orderType_idx" ON "order" USING btree ("order_type");--> statement-breakpoint
CREATE INDEX "order_shopId_idx" ON "order" USING btree ("shop_id");