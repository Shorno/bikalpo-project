DO $$ BEGIN
  CREATE TYPE "warehouse_pos_payment_status" AS ENUM ('paid', 'partial', 'due');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "warehouse_pos_invoice_seq" START WITH 1 INCREMENT BY 1;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_sale"
  ADD COLUMN IF NOT EXISTS "payment_status" "warehouse_pos_payment_status" DEFAULT 'paid' NOT NULL,
  ADD COLUMN IF NOT EXISTS "delivery_method" varchar(80) DEFAULT 'Self Pickup' NOT NULL,
  ADD COLUMN IF NOT EXISTS "responsible_person_id" text,
  ADD COLUMN IF NOT EXISTS "responsible_person_name" varchar(150),
  ADD COLUMN IF NOT EXISTS "sale_date" date DEFAULT CURRENT_DATE NOT NULL,
  ADD COLUMN IF NOT EXISTS "terms" text;
--> statement-breakpoint
ALTER TABLE "warehouse_pos_payment"
  ADD COLUMN IF NOT EXISTS "payment_account_id" integer;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "warehouse_pos_sale"
    ADD CONSTRAINT "warehouse_pos_sale_responsible_person_id_user_id_fk"
    FOREIGN KEY ("responsible_person_id") REFERENCES "public"."user"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "warehouse_pos_payment"
    ADD CONSTRAINT "warehouse_pos_payment_payment_account_id_finance_payment_account_id_fk"
    FOREIGN KEY ("payment_account_id") REFERENCES "public"."finance_payment_account"("id")
    ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "warehousePosPayment_paymentAccountId_idx"
  ON "warehouse_pos_payment" USING btree ("payment_account_id");
