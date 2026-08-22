ALTER TABLE "product_review" DROP CONSTRAINT IF EXISTS "review_product_user_unique";
--> statement-breakpoint
ALTER TABLE "product_review" ALTER COLUMN "is_verified_purchase" SET DEFAULT false;
