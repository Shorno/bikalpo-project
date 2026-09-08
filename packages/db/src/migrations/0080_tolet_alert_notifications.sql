CREATE TABLE IF NOT EXISTS "tolet_alert_notification" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "listing_id" text NOT NULL REFERENCES "tolet_unit_listing"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "read_at" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tolet_alert_notification_user_listing_unique"
  ON "tolet_alert_notification" ("user_id", "listing_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tolet_alert_notification_user_created_idx"
  ON "tolet_alert_notification" ("user_id", "created_at");
