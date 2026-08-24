CREATE TABLE IF NOT EXISTS "offer_template" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" varchar(40) NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "type" varchar(30) NOT NULL,
  "combo_rule" varchar(30),
  "buy_products" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "get_products" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "benefit_type" varchar(40) NOT NULL,
  "benefit_value" numeric(12,2),
  "apply_on" varchar(30) DEFAULT 'product' NOT NULL,
  "target_selection" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "target_retailers" boolean DEFAULT true NOT NULL,
  "target_wholesalers" boolean DEFAULT true NOT NULL,
  "apply_locations" jsonb DEFAULT '["all_stores"]'::jsonb NOT NULL,
  "minimum_order_amount" numeric(12,2) DEFAULT '0' NOT NULL,
  "max_use_per_order" integer DEFAULT 1 NOT NULL,
  "max_use_per_customer" integer DEFAULT 1 NOT NULL,
  "total_usage_limit" integer,
  "start_date" timestamp,
  "end_date" timestamp,
  "status" varchar(20) DEFAULT 'draft' NOT NULL,
  "used_by_count" integer DEFAULT 0 NOT NULL,
  "active_offers_created" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "offer_template_code_unique" ON "offer_template" ("code");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "retailer_offer" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" varchar(40) NOT NULL,
  "shop_id" text NOT NULL,
  "template_id" integer NOT NULL,
  "template_snapshot" jsonb NOT NULL,
  "name" varchar(255) NOT NULL,
  "offer_type" varchar(30) NOT NULL,
  "apply_to" varchar(30) NOT NULL,
  "product_id" integer,
  "variant_id" integer,
  "product_name" varchar(255),
  "variant_name" varchar(255),
  "category_id" integer,
  "category_name" varchar(255),
  "discount_type" varchar(30) NOT NULL,
  "discount_value" numeric(12,2),
  "minimum_quantity" numeric(12,2) DEFAULT '1' NOT NULL,
  "maximum_limit" integer,
  "start_date" timestamp NOT NULL,
  "end_date" timestamp NOT NULL,
  "all_day" boolean DEFAULT true NOT NULL,
  "start_time" varchar(5),
  "end_time" varchar(5),
  "target_type" varchar(30) DEFAULT 'all_customers' NOT NULL,
  "target_customer_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "target_area_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" varchar(20) DEFAULT 'draft' NOT NULL,
  "paused_at" timestamp,
  "deactivated_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "retailer_offer_code_unique" UNIQUE("code"),
  CONSTRAINT "retailer_offer_valid_dates" CHECK ("end_date" > "start_date")
);
--> statement-breakpoint
ALTER TABLE "retailer_offer" ADD CONSTRAINT "retailer_offer_shop_id_user_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "retailer_offer" ADD CONSTRAINT "retailer_offer_template_id_offer_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."offer_template"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "retailer_offer" ADD CONSTRAINT "retailer_offer_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "retailer_offer" ADD CONSTRAINT "retailer_offer_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "retailer_offer" ADD CONSTRAINT "retailer_offer_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "retailer_offer_shop_status_idx" ON "retailer_offer" ("shop_id", "status");
--> statement-breakpoint
CREATE INDEX "retailer_offer_shop_validity_idx" ON "retailer_offer" ("shop_id", "start_date", "end_date");
--> statement-breakpoint
CREATE INDEX "retailer_offer_template_idx" ON "retailer_offer" ("template_id");
--> statement-breakpoint
CREATE INDEX "retailer_offer_variant_idx" ON "retailer_offer" ("variant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "retailer_offer_application" (
  "id" serial PRIMARY KEY NOT NULL,
  "retailer_offer_id" integer NOT NULL,
  "shop_id" text NOT NULL,
  "pos_sale_id" integer,
  "order_id" integer,
  "customer_key" varchar(255),
  "discount_amount" numeric(12,2) DEFAULT '0' NOT NULL,
  "sales_amount" numeric(12,2) DEFAULT '0' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "retailer_offer_application_one_transaction" CHECK (num_nonnulls("pos_sale_id", "order_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "retailer_offer_application" ADD CONSTRAINT "retailer_offer_application_retailer_offer_id_retailer_offer_id_fk" FOREIGN KEY ("retailer_offer_id") REFERENCES "public"."retailer_offer"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "retailer_offer_application" ADD CONSTRAINT "retailer_offer_application_shop_id_user_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "retailer_offer_application" ADD CONSTRAINT "retailer_offer_application_pos_sale_id_warehouse_pos_sale_id_fk" FOREIGN KEY ("pos_sale_id") REFERENCES "public"."warehouse_pos_sale"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "retailer_offer_application" ADD CONSTRAINT "retailer_offer_application_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "retailer_offer_application_offer_idx" ON "retailer_offer_application" ("retailer_offer_id");
--> statement-breakpoint
CREATE INDEX "retailer_offer_application_shop_idx" ON "retailer_offer_application" ("shop_id");
--> statement-breakpoint
CREATE INDEX "retailer_offer_application_customer_idx" ON "retailer_offer_application" ("retailer_offer_id", "customer_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "retailer_offer_application_pos_unique" ON "retailer_offer_application" ("retailer_offer_id", "pos_sale_id") WHERE "pos_sale_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "retailer_offer_application_order_unique" ON "retailer_offer_application" ("retailer_offer_id", "order_id") WHERE "order_id" IS NOT NULL;
