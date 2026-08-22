DO $$ BEGIN
  CREATE TYPE "public"."tolet_unit_listing_status" AS ENUM('draft', 'active', 'paused', 'closed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."tolet_unit_listing_visibility" AS ENUM('public', 'qr_only');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."tolet_preferred_tenant" AS ENUM('family', 'bachelor', 'office', 'female', 'any');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE "tolet_unit_listing" (
  "id" text PRIMARY KEY NOT NULL,
  "public_number" integer GENERATED ALWAYS AS IDENTITY (sequence name "tolet_unit_listing_public_number_seq" START WITH 100001 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1),
  "unit_id" text NOT NULL,
  "title" varchar(200) NOT NULL,
  "description" text,
  "monthly_rent" numeric(12, 2) NOT NULL,
  "advance_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
  "security_deposit" numeric(12, 2) DEFAULT '0' NOT NULL,
  "service_charge" numeric(12, 2) DEFAULT '0' NOT NULL,
  "service_charge_included" boolean DEFAULT false NOT NULL,
  "parking_charge" numeric(12, 2) DEFAULT '0' NOT NULL,
  "parking_charge_included" boolean DEFAULT false NOT NULL,
  "utility_charge" numeric(12, 2) DEFAULT '0' NOT NULL,
  "utility_charge_included" boolean DEFAULT false NOT NULL,
  "available_from" date NOT NULL,
  "preferred_tenant" "tolet_preferred_tenant" DEFAULT 'any' NOT NULL,
  "has_internet" boolean DEFAULT false NOT NULL,
  "other_facilities" text,
  "image_urls" text[] DEFAULT '{}'::text[] NOT NULL,
  "video_url" text,
  "visibility" "tolet_unit_listing_visibility" DEFAULT 'public' NOT NULL,
  "status" "tolet_unit_listing_status" DEFAULT 'draft' NOT NULL,
  "view_count" integer DEFAULT 0 NOT NULL,
  "published_at" timestamp,
  "paused_at" timestamp,
  "closed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "tolet_unit_listing_public_number_unique" UNIQUE("public_number"),
  CONSTRAINT "tolet_unit_listing_monthly_rent_nonnegative" CHECK ("monthly_rent" >= 0),
  CONSTRAINT "tolet_unit_listing_advance_amount_nonnegative" CHECK ("advance_amount" >= 0),
  CONSTRAINT "tolet_unit_listing_security_deposit_nonnegative" CHECK ("security_deposit" >= 0),
  CONSTRAINT "tolet_unit_listing_service_charge_nonnegative" CHECK ("service_charge" >= 0),
  CONSTRAINT "tolet_unit_listing_parking_charge_nonnegative" CHECK ("parking_charge" >= 0),
  CONSTRAINT "tolet_unit_listing_utility_charge_nonnegative" CHECK ("utility_charge" >= 0),
  CONSTRAINT "tolet_unit_listing_view_count_nonnegative" CHECK ("view_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "tolet_unit_listing"
  ADD CONSTRAINT "tolet_unit_listing_unit_id_tolet_unit_id_fk"
  FOREIGN KEY ("unit_id") REFERENCES "public"."tolet_unit"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "tolet_unit_listing_open_unit_unique"
  ON "tolet_unit_listing" USING btree ("unit_id")
  WHERE "status" IN ('draft', 'active', 'paused');
--> statement-breakpoint
CREATE INDEX "tolet_unit_listing_unit_id_idx"
  ON "tolet_unit_listing" USING btree ("unit_id");
--> statement-breakpoint
CREATE INDEX "tolet_unit_listing_discovery_idx"
  ON "tolet_unit_listing" USING btree ("status", "visibility", "published_at");
