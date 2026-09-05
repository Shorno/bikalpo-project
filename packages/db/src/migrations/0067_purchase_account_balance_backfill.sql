WITH purchase_account_movements AS (
  SELECT
    "journal_line"."finance_account_id" AS "finance_account_id",
    SUM(
      CASE
        WHEN "journal_line"."normal_balance" = 'debit'
          THEN "journal_line"."debit"::numeric - "journal_line"."credit"::numeric
        ELSE "journal_line"."credit"::numeric - "journal_line"."debit"::numeric
      END
    ) AS "balance_delta"
  FROM "journal_line"
  INNER JOIN "journal_entry"
    ON "journal_entry"."id" = "journal_line"."journal_entry_id"
  WHERE "journal_entry"."status" = 'posted'
    AND "journal_entry"."transaction_type" IN (
      'supplier_advance_payment',
      'purchase_receipt',
      'supplier_advance_applied',
      'supplier_advance_refunded',
      'supplier_payment',
      'purchase_return_due',
      'purchase_return_paid',
      'supplier_refund_received'
    )
  GROUP BY "journal_line"."finance_account_id"
)
UPDATE "finance_account"
SET
  "current_balance" = (
    "finance_account"."current_balance"::numeric +
    "purchase_account_movements"."balance_delta"
  )::numeric(14, 2),
  "updatedAt" = now()
FROM "purchase_account_movements"
WHERE "finance_account"."id" =
  "purchase_account_movements"."finance_account_id";
