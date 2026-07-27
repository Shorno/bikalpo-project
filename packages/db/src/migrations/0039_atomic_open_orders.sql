CREATE TYPE "public"."cart_mode" AS ENUM('open_order', 'direct');
CREATE TYPE "public"."open_order_discount_type" AS ENUM('fixed', 'percentage');
CREATE TYPE "public"."open_order_outcome" AS ENUM('consumer_cancelled', 'no_offers', 'selection_expired');
CREATE TYPE "public"."open_order_reservation_state" AS ENUM('none', 'held', 'released', 'consumed');

ALTER TABLE "cart" ADD COLUMN "mode" "cart_mode";
ALTER TABLE "cart" ADD COLUMN "direct_shop_id" text;
ALTER TABLE "order" ADD COLUMN "selection_expires_at" timestamp;
ALTER TABLE "order" ADD COLUMN "open_order_outcome" "open_order_outcome";

ALTER TABLE "open_order_bid" ADD COLUMN "item_subtotal" numeric(10, 2);
ALTER TABLE "open_order_bid" ADD COLUMN "discount_type" "open_order_discount_type";
ALTER TABLE "open_order_bid" ADD COLUMN "discount_value" numeric(10, 2);
ALTER TABLE "open_order_bid" ADD COLUMN "discount_amount" numeric(10, 2);
ALTER TABLE "open_order_bid" ADD COLUMN "price_frozen_at" timestamp;
ALTER TABLE "open_order_bid" ADD COLUMN "reservation_held" boolean DEFAULT false NOT NULL;
ALTER TABLE "open_order_bid" ADD COLUMN "reservation_state" "open_order_reservation_state" DEFAULT 'none' NOT NULL;
ALTER TABLE "open_order_bid" ADD COLUMN "reservation_released_at" timestamp;
ALTER TABLE "open_order_bid" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;

ALTER TABLE "open_order_bid_item" ADD COLUMN "inventory_id" integer;

ALTER TABLE "cart" ADD CONSTRAINT "cart_direct_shop_id_user_id_fk"
  FOREIGN KEY ("direct_shop_id") REFERENCES "public"."user"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "open_order_bid_item" ADD CONSTRAINT "open_order_bid_item_inventory_id_inventory_id_fk"
  FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id")
  ON DELETE restrict ON UPDATE no action;

CREATE INDEX "openOrderBidItem_inventory_idx" ON "open_order_bid_item" USING btree ("inventory_id");
CREATE INDEX "cart_mode_idx" ON "cart" USING btree ("mode");
CREATE INDEX "cart_directShopId_idx" ON "cart" USING btree ("direct_shop_id");
CREATE INDEX "order_openOrder_deadlines_idx" ON "order" USING btree (
  "is_open_order", "status", "broadcast_expires_at", "selection_expires_at"
);
CREATE UNIQUE INDEX "order_one_active_open_request_per_user_idx" ON "order" USING btree ("user_id")
WHERE "is_open_order" = true AND "status" IN ('matching_shop', 'negotiating');

WITH cart_composition AS (
  SELECT
    c.id,
    count(ci.id) AS item_count,
    count(ci.id) FILTER (WHERE ci.shop_id IS NULL) AS open_item_count,
    count(DISTINCT ci.shop_id) FILTER (WHERE ci.shop_id IS NOT NULL) AS direct_shop_count,
    min(ci.shop_id) FILTER (WHERE ci.shop_id IS NOT NULL) AS direct_shop_id
  FROM cart c
  LEFT JOIN cart_item ci ON ci.cart_id = c.id
  GROUP BY c.id
)
UPDATE cart c
SET
  mode = CASE
    WHEN composition.item_count = 0 THEN NULL
    WHEN composition.open_item_count = composition.item_count THEN 'open_order'::cart_mode
    WHEN composition.open_item_count = 0 AND composition.direct_shop_count = 1 THEN 'direct'::cart_mode
    ELSE NULL
  END,
  direct_shop_id = CASE
    WHEN composition.open_item_count = 0 AND composition.direct_shop_count = 1
      THEN composition.direct_shop_id
    ELSE NULL
  END
FROM cart_composition composition
WHERE composition.id = c.id;
