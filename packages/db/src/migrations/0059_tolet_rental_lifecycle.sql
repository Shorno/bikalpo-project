ALTER TABLE "tolet_unit_listing" ADD COLUMN IF NOT EXISTS "monthly_rent_visible" boolean DEFAULT true NOT NULL;
ALTER TABLE "tolet_unit_listing" ADD COLUMN IF NOT EXISTS "advance_amount_visible" boolean DEFAULT true NOT NULL;
ALTER TABLE "tolet_unit_listing" ADD COLUMN IF NOT EXISTS "security_deposit_visible" boolean DEFAULT true NOT NULL;
ALTER TABLE "tolet_unit_listing" ADD COLUMN IF NOT EXISTS "service_charge_visible" boolean DEFAULT true NOT NULL;
ALTER TABLE "tolet_unit_listing" ADD COLUMN IF NOT EXISTS "parking_charge_visible" boolean DEFAULT true NOT NULL;
ALTER TABLE "tolet_unit_listing" ADD COLUMN IF NOT EXISTS "utility_charge_visible" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."tolet_rental_contract_status" AS ENUM('active', 'leaving', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."tolet_rent_payment_status" AS ENUM('pending', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."tolet_rental_alert_status" AS ENUM('active', 'paused', 'fulfilled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tolet_rental_contract" (
  "id" text PRIMARY KEY NOT NULL,
  "public_number" integer GENERATED ALWAYS AS IDENTITY (sequence name "tolet_rental_contract_public_number_seq" START WITH 300001),
  "booking_request_id" text NOT NULL,
  "property_id" text NOT NULL,
  "unit_id" text NOT NULL,
  "owner_user_id" text NOT NULL,
  "tenant_user_id" text NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "rent_due_day" integer DEFAULT 1 NOT NULL,
  "monthly_rent" numeric(12,2) NOT NULL,
  "advance_amount" numeric(12,2) DEFAULT '0' NOT NULL,
  "security_deposit" numeric(12,2) DEFAULT '0' NOT NULL,
  "service_charge" numeric(12,2) DEFAULT '0' NOT NULL,
  "parking_charge" numeric(12,2) DEFAULT '0' NOT NULL,
  "utility_charge" numeric(12,2) DEFAULT '0' NOT NULL,
  "status" "tolet_rental_contract_status" DEFAULT 'active' NOT NULL,
  "activated_at" timestamp DEFAULT now() NOT NULL,
  "leave_requested_at" timestamp,
  "access_ends_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "tolet_rental_contract_date_order" CHECK ("end_date" >= "start_date"),
  CONSTRAINT "tolet_rental_contract_due_day_valid" CHECK ("rent_due_day" BETWEEN 1 AND 28)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tolet_rent_payment" (
  "id" text PRIMARY KEY NOT NULL,
  "contract_id" text NOT NULL,
  "cycle_month" date NOT NULL,
  "due_date" date NOT NULL,
  "amount" numeric(12,2) NOT NULL,
  "reference_name" varchar(150),
  "status" "tolet_rent_payment_status" DEFAULT 'pending' NOT NULL,
  "verified_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "tolet_rent_payment_amount_nonnegative" CHECK ("amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tolet_rental_alert" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "source_contract_id" text,
  "preferred_category" varchar(50) NOT NULL,
  "preferred_location" varchar(200) NOT NULL,
  "minimum_size_sq_ft" integer DEFAULT 0 NOT NULL,
  "minimum_bedrooms" integer DEFAULT 0 NOT NULL,
  "minimum_bathrooms" integer DEFAULT 0 NOT NULL,
  "minimum_balconies" integer DEFAULT 0 NOT NULL,
  "balcony_preference" varchar(20) DEFAULT 'optional' NOT NULL,
  "preferred_floor" varchar(30) DEFAULT 'any' NOT NULL,
  "status" "tolet_rental_alert_status" DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "tolet_rental_alert_sizes_nonnegative" CHECK ("minimum_size_sq_ft" >= 0 AND "minimum_bedrooms" >= 0 AND "minimum_bathrooms" >= 0 AND "minimum_balconies" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tolet_rental_comment" (
  "id" text PRIMARY KEY NOT NULL,
  "contract_id" text NOT NULL,
  "author_user_id" text NOT NULL,
  "body" text NOT NULL,
  "rating" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "tolet_rental_comment_rating_valid" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "tolet_rental_contract" ADD CONSTRAINT "tolet_rental_contract_booking_fk" FOREIGN KEY ("booking_request_id") REFERENCES "tolet_booking_request"("id") ON DELETE restrict; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "tolet_rental_contract" ADD CONSTRAINT "tolet_rental_contract_property_fk" FOREIGN KEY ("property_id") REFERENCES "tolet_property"("id") ON DELETE restrict; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "tolet_rental_contract" ADD CONSTRAINT "tolet_rental_contract_unit_fk" FOREIGN KEY ("unit_id") REFERENCES "tolet_unit"("id") ON DELETE restrict; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "tolet_rental_contract" ADD CONSTRAINT "tolet_rental_contract_owner_fk" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE restrict; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "tolet_rental_contract" ADD CONSTRAINT "tolet_rental_contract_tenant_fk" FOREIGN KEY ("tenant_user_id") REFERENCES "user"("id") ON DELETE restrict; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "tolet_rent_payment" ADD CONSTRAINT "tolet_rent_payment_contract_fk" FOREIGN KEY ("contract_id") REFERENCES "tolet_rental_contract"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "tolet_rental_alert" ADD CONSTRAINT "tolet_rental_alert_user_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "tolet_rental_alert" ADD CONSTRAINT "tolet_rental_alert_contract_fk" FOREIGN KEY ("source_contract_id") REFERENCES "tolet_rental_contract"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "tolet_rental_comment" ADD CONSTRAINT "tolet_rental_comment_contract_fk" FOREIGN KEY ("contract_id") REFERENCES "tolet_rental_contract"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "tolet_rental_comment" ADD CONSTRAINT "tolet_rental_comment_author_fk" FOREIGN KEY ("author_user_id") REFERENCES "user"("id") ON DELETE restrict; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tolet_rental_contract_public_number_unique" ON "tolet_rental_contract" ("public_number");
CREATE UNIQUE INDEX IF NOT EXISTS "tolet_rental_contract_booking_unique" ON "tolet_rental_contract" ("booking_request_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tolet_rental_contract_current_unit_unique" ON "tolet_rental_contract" ("unit_id") WHERE "status" IN ('active', 'leaving');
CREATE INDEX IF NOT EXISTS "tolet_rental_contract_owner_status_idx" ON "tolet_rental_contract" ("owner_user_id", "status");
CREATE INDEX IF NOT EXISTS "tolet_rental_contract_tenant_status_idx" ON "tolet_rental_contract" ("tenant_user_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "tolet_rent_payment_contract_cycle_unique" ON "tolet_rent_payment" ("contract_id", "cycle_month");
CREATE INDEX IF NOT EXISTS "tolet_rent_payment_contract_status_idx" ON "tolet_rent_payment" ("contract_id", "status");
CREATE INDEX IF NOT EXISTS "tolet_rental_alert_user_status_idx" ON "tolet_rental_alert" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "tolet_rental_comment_contract_created_idx" ON "tolet_rental_comment" ("contract_id", "created_at");
