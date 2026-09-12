-- DEFERRED BY USER 2026-09-12: do not apply without renewed approval.
ALTER TABLE "tolet_rental_comment" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tolet_public_reviews_created_idx" ON "tolet_rental_comment" ("created_at" DESC, "id" DESC) WHERE "is_public" = true;
