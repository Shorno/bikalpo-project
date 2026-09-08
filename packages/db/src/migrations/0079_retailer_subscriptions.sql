CREATE TABLE "retailer_subscription_plan" (
  "id" text PRIMARY KEY, "code" text NOT NULL UNIQUE, "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '', "duration_months" integer, "amount_minor" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'BDT', "active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0, "version" integer NOT NULL DEFAULT 1,
  "updated_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "retailer_subscription_plan_terms_check" CHECK (currency = 'BDT' AND ((code = 'free' AND duration_months IS NULL AND amount_minor = 0 AND active) OR (code <> 'free' AND duration_months IS NOT NULL AND duration_months IN (1,6,12) AND amount_minor > 0 AND amount_minor <= 100000000)))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "retailer_subscription_plan_active_duration_unique" ON "retailer_subscription_plan" (coalesce(duration_months,0)) WHERE active;
--> statement-breakpoint
CREATE TABLE "retailer_subscription_purchase" (
  "id" text PRIMARY KEY, "shop_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "plan_id" text NOT NULL REFERENCES "retailer_subscription_plan"("id"),
  "plan_code" text NOT NULL, "plan_name" text NOT NULL, "plan_version" integer NOT NULL,
  "duration_months" integer NOT NULL, "amount_minor" integer NOT NULL, "currency" text NOT NULL DEFAULT 'BDT',
  "provider" text NOT NULL DEFAULT 'dummy', "previous_term_id" text NOT NULL,
  "quote_expires_at" timestamptz NOT NULL, "confirmed_at" timestamptz, "idempotency_key" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "retailer_subscription_purchase_terms_check" CHECK (provider = 'dummy' AND currency = 'BDT' AND duration_months IN (1,6,12) AND amount_minor > 0 AND ((confirmed_at IS NULL AND idempotency_key IS NULL) OR (confirmed_at IS NOT NULL AND idempotency_key IS NOT NULL)))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "retailer_subscription_purchase_key_unique" ON "retailer_subscription_purchase" (shop_id, idempotency_key);
CREATE INDEX "retailer_subscription_purchase_shop_idx" ON "retailer_subscription_purchase" (shop_id);
--> statement-breakpoint
CREATE TABLE "retailer_subscription" (
  "id" text PRIMARY KEY, "shop_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "plan_id" text NOT NULL REFERENCES "retailer_subscription_plan"("id"),
  "purchase_id" text UNIQUE REFERENCES "retailer_subscription_purchase"("id"),
  "plan_code" text NOT NULL, "plan_name" text NOT NULL, "duration_months" integer,
  "amount_minor" integer NOT NULL, "currency" text NOT NULL DEFAULT 'BDT',
  "starts_at" timestamptz NOT NULL, "expires_at" timestamptz,
  "is_current" boolean NOT NULL DEFAULT true, "superseded_at" timestamptz,
  "source" text NOT NULL, "auto_renew" boolean NOT NULL DEFAULT false, "next_billing_at" timestamptz,
  CONSTRAINT "retailer_subscription_terms_check" CHECK (currency = 'BDT' AND NOT auto_renew AND next_billing_at IS NULL AND ((plan_code = 'free' AND duration_months IS NULL AND amount_minor = 0 AND expires_at IS NULL AND purchase_id IS NULL) OR (plan_code <> 'free' AND duration_months IS NOT NULL AND duration_months IN (1,6,12) AND amount_minor > 0 AND expires_at IS NOT NULL AND expires_at > starts_at AND purchase_id IS NOT NULL)))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "retailer_subscription_current_shop_unique" ON "retailer_subscription" (shop_id) WHERE is_current;
CREATE INDEX "retailer_subscription_shop_idx" ON "retailer_subscription" (shop_id);
