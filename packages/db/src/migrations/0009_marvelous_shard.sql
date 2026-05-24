ALTER TABLE "product" ADD COLUMN "stock_tracking_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "available_for_sale" boolean DEFAULT true NOT NULL;