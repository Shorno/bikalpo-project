ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "promotion_code" varchar(40);
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "payment_plan" "order_payment_plan" DEFAULT 'pay_later' NOT NULL;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "payment_due_at" timestamp;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "billed_name" text;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "billed_phone" text;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "billed_email" text;
