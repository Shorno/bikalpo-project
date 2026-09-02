ALTER TABLE "finance_payment_account"
  ADD COLUMN IF NOT EXISTS "account_number" varchar(80);
