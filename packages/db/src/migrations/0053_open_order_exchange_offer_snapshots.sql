ALTER TABLE "open_order_bid_item"
  ADD COLUMN "seller_new_price" numeric(10, 2),
  ADD COLUMN "exchange_credit_amount" numeric(10, 2) DEFAULT '0' NOT NULL;

UPDATE "open_order_bid_item"
SET "seller_new_price" = "seller_price"
WHERE "seller_price" IS NOT NULL;
