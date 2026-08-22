DO $$ BEGIN
  CREATE TYPE "inventory_movement_direction" AS ENUM ('in', 'out');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "inventory_movement_reason" AS ENUM (
    'purchase_receipt', 'purchase_return', 'purchase_reversal',
    'sale_fulfillment', 'sale_return', 'manual_adjustment'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "purchase_event_source" AS ENUM ('platform_order', 'manual_purchase');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "purchase_event_category" AS ENUM (
    'purchase', 'payment', 'inventory', 'accounting', 'communication'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "purchase_event_type" AS ENUM (
    'draft_created', 'checkout_confirmed', 'submitted', 'otp_verified',
    'accepted', 'payment_initiated', 'payment_completed', 'payment_failed',
    'advance_recorded', 'partially_received', 'received',
    'inventory_recognized', 'payable_created', 'advance_applied',
    'payment_settled', 'cancelled', 'refund_requested', 'refund_approved',
    'refund_processed', 'refund_completed', 'return_processed',
    'accounting_posted', 'communication_recorded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "purchase_payment_purpose" AS ENUM (
    'order_payment', 'supplier_advance', 'payable_settlement'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "purchase_payment_timing" AS ENUM (
    'before_receipt', 'at_receipt', 'after_receipt'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TYPE "balance_sheet_line" ADD VALUE IF NOT EXISTS 'supplier_refund_receivable' AFTER 'supplier_advance';
--> statement-breakpoint
ALTER TYPE "payment_transaction_status" ADD VALUE IF NOT EXISTS 'refund_pending' BEFORE 'refunded';
--> statement-breakpoint
ALTER TYPE "journal_source_type" ADD VALUE IF NOT EXISTS 'payment';
ALTER TYPE "journal_source_type" ADD VALUE IF NOT EXISTS 'purchase_event';
ALTER TYPE "journal_source_type" ADD VALUE IF NOT EXISTS 'purchase_return';
--> statement-breakpoint
ALTER TYPE "journal_transaction_type" ADD VALUE IF NOT EXISTS 'purchase_receipt';
ALTER TYPE "journal_transaction_type" ADD VALUE IF NOT EXISTS 'supplier_advance_applied';
ALTER TYPE "journal_transaction_type" ADD VALUE IF NOT EXISTS 'supplier_payment';
ALTER TYPE "journal_transaction_type" ADD VALUE IF NOT EXISTS 'purchase_return_due';
ALTER TYPE "journal_transaction_type" ADD VALUE IF NOT EXISTS 'purchase_return_paid';
ALTER TYPE "journal_transaction_type" ADD VALUE IF NOT EXISTS 'supplier_refund_received';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_event" (
  "id" serial PRIMARY KEY NOT NULL,
  "owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "source_type" "purchase_event_source" NOT NULL,
  "order_id" integer REFERENCES "order"("id") ON DELETE cascade,
  "purchase_id" integer REFERENCES "purchase"("id") ON DELETE cascade,
  "category" "purchase_event_category" NOT NULL,
  "event_type" "purchase_event_type" NOT NULL,
  "from_state" varchar(50),
  "to_state" varchar(50),
  "amount" numeric(14, 2),
  "reference" varchar(180),
  "description" text,
  "metadata" jsonb,
  "actor_id" text REFERENCES "user"("id") ON DELETE set null,
  "idempotency_key" varchar(180) NOT NULL,
  "occurred_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "purchaseEvent_source_check" CHECK (
    ("source_type" = 'platform_order' AND "order_id" IS NOT NULL AND "purchase_id" IS NULL)
    OR ("source_type" = 'manual_purchase' AND "purchase_id" IS NOT NULL AND "order_id" IS NULL)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "purchaseEvent_owner_idempotency_unique"
  ON "purchase_event" ("owner_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "purchaseEvent_order_idx"
  ON "purchase_event" ("order_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "purchaseEvent_purchase_idx"
  ON "purchase_event" ("purchase_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "purchaseEvent_owner_idx"
  ON "purchase_event" ("owner_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "purchaseEvent_category_idx"
  ON "purchase_event" ("category", "event_type");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_movement" (
  "id" serial PRIMARY KEY NOT NULL,
  "owner_type" "inventory_owner_type" NOT NULL,
  "owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "variant_id" integer NOT NULL REFERENCES "product_variant"("id") ON DELETE restrict,
  "direction" "inventory_movement_direction" NOT NULL,
  "reason" "inventory_movement_reason" NOT NULL,
  "quantity" numeric(14, 4) NOT NULL,
  "unit" varchar(30) NOT NULL,
  "unit_cost" numeric(14, 4),
  "total_cost" numeric(14, 2),
  "quantity_before" numeric(14, 4),
  "quantity_after" numeric(14, 4),
  "order_id" integer REFERENCES "order"("id") ON DELETE set null,
  "order_item_id" integer REFERENCES "order_item"("id") ON DELETE set null,
  "purchase_id" integer REFERENCES "purchase"("id") ON DELETE set null,
  "purchase_item_id" integer REFERENCES "purchase_item"("id") ON DELETE set null,
  "reverses_movement_id" integer REFERENCES "inventory_movement"("id") ON DELETE set null,
  "reference" varchar(180),
  "note" text,
  "idempotency_key" varchar(180) NOT NULL,
  "created_by_id" text REFERENCES "user"("id") ON DELETE set null,
  "occurred_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "inventoryMovement_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "inventoryMovement_cost_check" CHECK (
    ("unit_cost" IS NULL OR "unit_cost" >= 0)
    AND ("total_cost" IS NULL OR "total_cost" >= 0)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventoryMovement_owner_idempotency_unique"
  ON "inventory_movement" ("owner_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "inventoryMovement_owner_variant_idx"
  ON "inventory_movement" ("owner_type", "owner_id", "variant_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "inventoryMovement_order_idx"
  ON "inventory_movement" ("order_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "inventoryMovement_purchase_idx"
  ON "inventory_movement" ("purchase_id", "occurred_at");
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "payment_account_id" integer;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "purchase_purpose" "purchase_payment_purpose";
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "purchase_timing" "purchase_payment_timing";
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "reference_no" varchar(180);
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "related_payment_id" integer;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "refunded_amount" numeric(10, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "verified_at" timestamp;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payment" ADD CONSTRAINT "payment_payment_account_id_finance_payment_account_id_fk"
    FOREIGN KEY ("payment_account_id") REFERENCES "finance_payment_account"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "payment" ADD CONSTRAINT "payment_related_payment_id_payment_id_fk"
    FOREIGN KEY ("related_payment_id") REFERENCES "payment"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_purchasePurpose_idx" ON "payment" ("purchase_purpose");
CREATE INDEX IF NOT EXISTS "payment_paymentAccount_idx" ON "payment" ("payment_account_id");
