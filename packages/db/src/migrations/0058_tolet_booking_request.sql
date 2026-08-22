DO $$ BEGIN
  CREATE TYPE "public"."tolet_booking_request_status" AS ENUM('pending', 'accepted', 'rejected', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE "tolet_booking_request" (
  "id" text PRIMARY KEY NOT NULL,
  "public_number" integer GENERATED ALWAYS AS IDENTITY (sequence name "tolet_booking_request_public_number_seq" START WITH 200001 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1),
  "listing_id" text NOT NULL,
  "requester_user_id" text NOT NULL,
  "contact_name" varchar(150) NOT NULL,
  "contact_phone" varchar(30) NOT NULL,
  "desired_move_in_date" date NOT NULL,
  "message" text,
  "idempotency_key" varchar(36) NOT NULL,
  "offer_snapshot" jsonb NOT NULL,
  "listing_updated_at_at_request" timestamp NOT NULL,
  "status" "tolet_booking_request_status" DEFAULT 'pending' NOT NULL,
  "response_note" text,
  "responded_at" timestamp,
  "cancelled_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "tolet_booking_request_public_number_unique" UNIQUE("public_number"),
  CONSTRAINT "tolet_booking_request_requester_idempotency_unique" UNIQUE("requester_user_id", "idempotency_key"),
  CONSTRAINT "tolet_booking_request_state_timestamps_valid" CHECK (
    ("status" = 'pending' AND "responded_at" IS NULL AND "cancelled_at" IS NULL)
    OR ("status" IN ('accepted', 'rejected') AND "responded_at" IS NOT NULL AND "cancelled_at" IS NULL)
    OR ("status" = 'cancelled' AND "responded_at" IS NULL AND "cancelled_at" IS NOT NULL)
  )
);
--> statement-breakpoint
ALTER TABLE "tolet_booking_request"
  ADD CONSTRAINT "tolet_booking_request_listing_id_tolet_unit_listing_id_fk"
  FOREIGN KEY ("listing_id") REFERENCES "public"."tolet_unit_listing"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tolet_booking_request"
  ADD CONSTRAINT "tolet_booking_request_requester_user_id_user_id_fk"
  FOREIGN KEY ("requester_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "tolet_booking_request_pending_requester_listing_unique"
  ON "tolet_booking_request" USING btree ("requester_user_id", "listing_id")
  WHERE "status" = 'pending';
--> statement-breakpoint
CREATE UNIQUE INDEX "tolet_booking_request_accepted_listing_unique"
  ON "tolet_booking_request" USING btree ("listing_id")
  WHERE "status" = 'accepted';
--> statement-breakpoint
CREATE INDEX "tolet_booking_request_requester_status_idx"
  ON "tolet_booking_request" USING btree ("requester_user_id", "status");
--> statement-breakpoint
CREATE INDEX "tolet_booking_request_listing_status_idx"
  ON "tolet_booking_request" USING btree ("listing_id", "status");
