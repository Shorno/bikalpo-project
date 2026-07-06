ALTER TABLE "customer_assignment" DROP CONSTRAINT "customer_assignment_unique";--> statement-breakpoint
ALTER TABLE "customer_assignment" ADD COLUMN "warehouse_id" text;--> statement-breakpoint
UPDATE "customer_assignment" AS ca
SET "warehouse_id" = salesman."warehouse_id"
FROM "user" AS salesman
WHERE ca."salesman_id" = salesman."id"
  AND ca."warehouse_id" IS NULL;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "customer_assignment" WHERE "warehouse_id" IS NULL) THEN
		RAISE EXCEPTION 'customer_assignment warehouse_id backfill failed; salesman warehouse_id missing';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "customer_assignment" ALTER COLUMN "warehouse_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_assignment" ADD CONSTRAINT "customer_assignment_warehouse_id_user_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_assignment_warehouse_idx" ON "customer_assignment" USING btree ("warehouse_id");--> statement-breakpoint
ALTER TABLE "customer_assignment" ADD CONSTRAINT "customer_assignment_warehouse_customer_unique" UNIQUE("warehouse_id","customer_id");
