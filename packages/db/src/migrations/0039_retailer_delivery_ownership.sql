ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS "shop_id" text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_shop_id_user_id_fk'
  ) THEN
    ALTER TABLE "user"
    ADD CONSTRAINT "user_shop_id_user_id_fk"
    FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id")
    ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_warehouseId_idx" ON "user" USING btree ("warehouse_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_shopId_idx" ON "user" USING btree ("shop_id");
--> statement-breakpoint
ALTER TABLE "delivery_group"
ADD COLUMN IF NOT EXISTS "shop_id" text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_group_shop_id_user_id_fk'
  ) THEN
    ALTER TABLE "delivery_group"
    ADD CONSTRAINT "delivery_group_shop_id_user_id_fk"
    FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id")
    ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deliveryGroup_warehouseId_idx" ON "delivery_group" USING btree ("warehouse_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deliveryGroup_shopId_idx" ON "delivery_group" USING btree ("shop_id");
