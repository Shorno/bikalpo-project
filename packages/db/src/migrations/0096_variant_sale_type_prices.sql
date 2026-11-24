-- LPG Variant Table: per size, the Type options it is sold as (New,
-- Exchange, Refill...) with an optional price for each.
ALTER TABLE "product_variant_price" ADD COLUMN IF NOT EXISTS "sale_type_prices" jsonb;
