CREATE SEQUENCE IF NOT EXISTS "user_display_code_seq"
  AS integer START WITH 10000 MINVALUE 10000 MAXVALUE 99999 NO CYCLE;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_display_code" (
  "user_id" text PRIMARY KEY NOT NULL,
  "code" integer DEFAULT nextval('user_display_code_seq') NOT NULL,
  CONSTRAINT "user_display_code_five_digits" CHECK ("code" BETWEEN 10000 AND 99999)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_display_code_code_unique" ON "user_display_code" ("code");
--> statement-breakpoint
-- Preserve attribution for historical actors, including accounts since deleted.
INSERT INTO "user_display_code" ("user_id")
SELECT l."actor_id" FROM "consumer_price_log" l
WHERE NOT EXISTS (SELECT 1 FROM "user_display_code" c WHERE c."user_id" = l."actor_id")
GROUP BY l."actor_id" ORDER BY min(l."created_at"), l."actor_id"
ON CONFLICT ("user_id") DO NOTHING;
