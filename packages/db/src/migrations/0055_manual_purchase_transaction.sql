DO $$ BEGIN
  CREATE TYPE "purchase_entry_mode" AS ENUM ('new', 'exchange');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "purchase_verification_status" AS ENUM ('pending', 'verified', 'on_hold');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "purchase_payment_status" AS ENUM (
    'unpaid', 'partial', 'paid', 'refund_pending', 'partially_refunded', 'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TYPE "purchase_event_type" ADD VALUE IF NOT EXISTS 'verification_passed';
ALTER TYPE "purchase_event_type" ADD VALUE IF NOT EXISTS 'verification_on_hold';
ALTER TYPE "purchase_event_type" ADD VALUE IF NOT EXISTS 'refund_verified';
--> statement-breakpoint
ALTER TABLE "purchase" ADD COLUMN IF NOT EXISTS "owner_type" "inventory_owner_type" DEFAULT 'warehouse' NOT NULL;
ALTER TABLE "purchase" ADD COLUMN IF NOT EXISTS "vat_amount" numeric(12, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "purchase" ADD COLUMN IF NOT EXISTS "paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "purchase" ADD COLUMN IF NOT EXISTS "due_amount" numeric(12, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "purchase" ADD COLUMN IF NOT EXISTS "payment_status" "purchase_payment_status" DEFAULT 'unpaid' NOT NULL;
ALTER TABLE "purchase" ADD COLUMN IF NOT EXISTS "payment_method" varchar(50);
ALTER TABLE "purchase" ADD COLUMN IF NOT EXISTS "payment_account_id" integer;
ALTER TABLE "purchase" ADD COLUMN IF NOT EXISTS "entry_mode" "purchase_entry_mode" DEFAULT 'new' NOT NULL;
ALTER TABLE "purchase" ADD COLUMN IF NOT EXISTS "verification_status" "purchase_verification_status" DEFAULT 'pending' NOT NULL;
ALTER TABLE "purchase" ADD COLUMN IF NOT EXISTS "verification_message" text;
ALTER TABLE "purchase" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(120);
ALTER TABLE "purchase" ADD COLUMN IF NOT EXISTS "attachment_url" text;
ALTER TABLE "purchase" ADD COLUMN IF NOT EXISTS "attachment_name" varchar(255);
ALTER TABLE "purchase" ADD COLUMN IF NOT EXISTS "accepted_at" timestamp;
ALTER TABLE "purchase" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp;
ALTER TABLE "purchase" ADD COLUMN IF NOT EXISTS "created_by_id" text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "purchase" ADD CONSTRAINT "purchase_payment_account_id_finance_payment_account_id_fk"
    FOREIGN KEY ("payment_account_id") REFERENCES "finance_payment_account"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "purchase" ADD CONSTRAINT "purchase_created_by_id_user_id_fk"
    FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
UPDATE "purchase"
SET
  "paid_amount" = CASE WHEN "payment_type" = 'cash' THEN "total" ELSE 0 END,
  "due_amount" = CASE WHEN "payment_type" = 'credit' THEN "total" ELSE 0 END,
  "payment_status" = CASE
    WHEN "payment_type" = 'cash' THEN 'paid'::"purchase_payment_status"
    ELSE 'unpaid'::"purchase_payment_status"
  END
WHERE "paid_amount" = 0 AND "due_amount" = 0;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_paymentStatus_idx" ON "purchase" ("payment_status");
CREATE INDEX IF NOT EXISTS "purchase_verificationStatus_idx" ON "purchase" ("verification_status");
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_owner_idempotency_unique"
  ON "purchase" ("warehouse_id", "idempotency_key");
--> statement-breakpoint
ALTER TABLE "purchase_item" ADD COLUMN IF NOT EXISTS "sku" varchar(100);
ALTER TABLE "purchase_item" ADD COLUMN IF NOT EXISTS "brand_name" varchar(180);
ALTER TABLE "purchase_item" ADD COLUMN IF NOT EXISTS "size_label" varchar(100);
ALTER TABLE "purchase_item" ADD COLUMN IF NOT EXISTS "quantity_unit" varchar(30) DEFAULT 'unit' NOT NULL;
ALTER TABLE "purchase_item" ADD COLUMN IF NOT EXISTS "exchange_qty" numeric(12, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment" ALTER COLUMN "order_id" DROP NOT NULL;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "purchase_id" integer;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payment" ADD CONSTRAINT "payment_purchase_id_purchase_id_fk"
    FOREIGN KEY ("purchase_id") REFERENCES "purchase"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_purchaseId_idx" ON "payment" ("purchase_id");
DO $$ BEGIN
  ALTER TABLE "payment" ADD CONSTRAINT "payment_single_purchase_source_check"
    CHECK ((("order_id" IS NOT NULL)::integer + ("purchase_id" IS NOT NULL)::integer) = 1) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE "payment" VALIDATE CONSTRAINT "payment_single_purchase_source_check";
