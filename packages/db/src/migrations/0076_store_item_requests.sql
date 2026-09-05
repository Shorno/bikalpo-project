CREATE TABLE IF NOT EXISTS "store_item_request" (
  "id" serial PRIMARY KEY,
  "shop_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "customer_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "item_name" text NOT NULL,
  "brand" text,
  "quantity" integer NOT NULL CHECK ("quantity" > 0),
  "description" text,
  "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'available', 'unavailable')),
  "response" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_item_request_shop_idx" ON "store_item_request"("shop_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_item_request_customer_idx" ON "store_item_request"("customer_id");
