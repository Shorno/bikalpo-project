CREATE TABLE IF NOT EXISTS "consumer_price_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "variant_price_id" integer NOT NULL,
  "product_id" integer NOT NULL,
  "actor_id" text NOT NULL,
  "actor_name" text NOT NULL,
  "source" varchar(20) NOT NULL,
  "previous_price" numeric(10, 2) NOT NULL,
  "new_price" numeric(10, 2) NOT NULL,
  "previous_exchange_price" numeric(10, 2),
  "new_exchange_price" numeric(10, 2),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consumer_price_log_variant_date_idx"
  ON "consumer_price_log" ("variant_price_id", "created_at", "id");
