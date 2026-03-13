CREATE TYPE "public"."b2b_order_type" AS ENUM('b2b', 'b2c');--> statement-breakpoint
CREATE TABLE "combo_offer" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100) DEFAULT 'Weekly Offers',
	"banner_image" text,
	"discount_percentage" integer NOT NULL,
	"original_price" integer,
	"combo_price" integer NOT NULL,
	"products" text NOT NULL,
	"active" boolean DEFAULT true,
	"start_date" varchar(20),
	"end_date" varchar(20),
	"priority" integer DEFAULT 0,
	"badge" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"type" varchar(100) DEFAULT 'Weekly Offers' NOT NULL,
	"discount_percentage" integer NOT NULL,
	"original_price" integer,
	"combo_price" integer,
	"banner_image" text,
	"products" text,
	"target_products" text,
	"active" boolean DEFAULT true,
	"start_date" varchar(20),
	"end_date" varchar(20),
	"priority" integer DEFAULT 0,
	"badge" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart_item" ADD COLUMN "shop_id" text;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "retail_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "order_type" "b2b_order_type" DEFAULT 'b2c' NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "shop_id" text;--> statement-breakpoint
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_shop_id_user_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_shop_id_user_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cartItem_shopId_idx" ON "cart_item" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "order_orderType_idx" ON "order" USING btree ("order_type");--> statement-breakpoint
CREATE INDEX "order_shopId_idx" ON "order" USING btree ("shop_id");