CREATE TABLE IF NOT EXISTS "tolet_banner" (
  "id" text PRIMARY KEY,
  "slides" jsonb NOT NULL,
  "updated_at" timestamp NOT NULL DEFAULT now()
);
