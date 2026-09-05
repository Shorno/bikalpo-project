ALTER TABLE "finance_payment_account"
  ADD COLUMN IF NOT EXISTS "provider_name" varchar(120);
--> statement-breakpoint
UPDATE "finance_payment_account"
SET
  "type" = 'mobile_banking'::"finance_payment_account_type",
  "provider_name" = regexp_replace("name", '\\s+Merchant$', '', 'i')
WHERE "code" IN (
  '1007-bkash-merchant',
  '1008-nagad-merchant',
  '1009-rocket-merchant'
);
--> statement-breakpoint
UPDATE "finance_payment_account"
SET "provider_name" = "name"
WHERE "type" = 'bank'::"finance_payment_account_type"
  AND "provider_name" IS NULL;
