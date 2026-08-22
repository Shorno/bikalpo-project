-- Global offer structures created by Admin and instantiated by store owners.
-- A template contains rules only and is never executed directly at checkout.
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
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "offer_template_code_unique" UNIQUE("code")
);

CREATE INDEX IF NOT EXISTS "offer_template_status_idx"
  ON "offer_template" ("status");
CREATE INDEX IF NOT EXISTS "offer_template_type_idx"
  ON "offer_template" ("type");
