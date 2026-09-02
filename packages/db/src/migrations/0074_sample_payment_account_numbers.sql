UPDATE "finance_payment_account"
SET "account_number" = CASE
  WHEN "type" = 'bank'::"finance_payment_account_type"
    THEN 'DEMO-BANK-' || lpad("id"::text, 6, '0')
  WHEN "type" = 'mobile_banking'::"finance_payment_account_type"
    THEN 'DEMO-MFS-' || lpad("id"::text, 6, '0')
END
WHERE "type" IN (
  'bank'::"finance_payment_account_type",
  'mobile_banking'::"finance_payment_account_type"
)
  AND ("account_number" IS NULL OR btrim("account_number") = '');
