DO $$ BEGIN
  CREATE TYPE "public"."tolet_property_status" AS ENUM('active', 'inactive', 'blocked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."tolet_unit_status" AS ENUM('vacant', 'booked', 'occupied', 'inactive');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE "tolet_property" (
  "id" text PRIMARY KEY NOT NULL,
  "public_number" integer GENERATED ALWAYS AS IDENTITY (sequence name "tolet_property_public_number_seq" START WITH 100001 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1),
  "owner_user_id" text NOT NULL,
  "qr_token" text NOT NULL,
  "name" varchar(200) NOT NULL,
  "cover_image_url" text NOT NULL,
  "owner_name" varchar(150) NOT NULL,
  "mobile_number" varchar(30) NOT NULL,
  "email" varchar(320),
  "property_type" varchar(50) NOT NULL,
  "division" varchar(100) NOT NULL,
  "district" varchar(100) NOT NULL,
  "area" varchar(150) NOT NULL,
  "full_address" text NOT NULL,
  "nearby_landmark" text,
  "latitude" text,
  "longitude" text,
  "building_type" varchar(50) NOT NULL,
  "total_floors" integer NOT NULL,
  "declared_total_units" integer NOT NULL,
  "has_parking" boolean DEFAULT false NOT NULL,
  "has_lift" boolean DEFAULT false NOT NULL,
  "has_security_guard" boolean DEFAULT false NOT NULL,
  "has_cctv" boolean DEFAULT false NOT NULL,
  "has_generator" boolean DEFAULT false NOT NULL,
  "has_water_supply" boolean DEFAULT false NOT NULL,
  "has_gas_connection" boolean DEFAULT false NOT NULL,
  "has_electricity" boolean DEFAULT false NOT NULL,
  "description" text,
  "front_image_url" text NOT NULL,
  "building_image_url" text,
  "video_url" text,
  "phone_verified_at" timestamp NOT NULL,
  "information_confirmed_at" timestamp NOT NULL,
  "terms_accepted_at" timestamp NOT NULL,
  "property_policy_accepted_at" timestamp NOT NULL,
  "status" "tolet_property_status" DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "tolet_property_public_number_unique" UNIQUE("public_number"),
  CONSTRAINT "tolet_property_qr_token_unique" UNIQUE("qr_token")
);
--> statement-breakpoint
CREATE TABLE "tolet_unit" (
  "id" text PRIMARY KEY NOT NULL,
  "public_number" integer GENERATED ALWAYS AS IDENTITY (sequence name "tolet_unit_public_number_seq" START WITH 100001 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1),
  "property_id" text NOT NULL,
  "name" varchar(100) NOT NULL,
  "unit_type" varchar(50) NOT NULL,
  "status" "tolet_unit_status" DEFAULT 'vacant' NOT NULL,
  "floor_number" integer NOT NULL,
  "size_sq_ft" integer NOT NULL,
  "bedrooms" integer DEFAULT 0 NOT NULL,
  "bathrooms" integer DEFAULT 0 NOT NULL,
  "balconies" integer DEFAULT 0 NOT NULL,
  "has_drawing_room" boolean DEFAULT false NOT NULL,
  "has_dining_space" boolean DEFAULT false NOT NULL,
  "has_kitchen" boolean DEFAULT false NOT NULL,
  "is_furnished" boolean DEFAULT false NOT NULL,
  "description" text,
  "image_urls" text[] DEFAULT '{}'::text[] NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "tolet_unit_public_number_unique" UNIQUE("public_number"),
  CONSTRAINT "tolet_unit_property_name_unique" UNIQUE("property_id", "name")
);
--> statement-breakpoint
ALTER TABLE "tolet_property"
  ADD CONSTRAINT "tolet_property_owner_user_id_user_id_fk"
  FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tolet_unit"
  ADD CONSTRAINT "tolet_unit_property_id_tolet_property_id_fk"
  FOREIGN KEY ("property_id") REFERENCES "public"."tolet_property"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "tolet_property_owner_user_id_idx" ON "tolet_property" USING btree ("owner_user_id");
--> statement-breakpoint
CREATE INDEX "tolet_property_status_idx" ON "tolet_property" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "tolet_unit_property_id_idx" ON "tolet_unit" USING btree ("property_id");
--> statement-breakpoint
CREATE INDEX "tolet_unit_status_idx" ON "tolet_unit" USING btree ("status");
