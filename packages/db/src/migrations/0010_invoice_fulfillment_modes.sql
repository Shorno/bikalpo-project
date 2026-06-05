DO $$
BEGIN
    CREATE TYPE "public"."invoice_fulfillment_mode" AS ENUM(
        'self_pickup',
        'internal_delivery',
        'third_party'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "invoice"
    ADD COLUMN IF NOT EXISTS "fulfillment_mode" "invoice_fulfillment_mode",
    ADD COLUMN IF NOT EXISTS "completion_otp" text,
    ADD COLUMN IF NOT EXISTS "completion_otp_generated_at" timestamp,
    ADD COLUMN IF NOT EXISTS "completion_otp_verified_at" timestamp,
    ADD COLUMN IF NOT EXISTS "settled_at" timestamp;
