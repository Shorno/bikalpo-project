-- Rental agreement terms captured when the owner activates a contract.
-- end_date becomes optional: NULL means the rental is open-ended until the tenant leaves.
ALTER TABLE "tolet_rental_contract" ALTER COLUMN "end_date" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "tolet_rental_contract" ADD COLUMN IF NOT EXISTS "contract_type" varchar(30) DEFAULT 'monthly_rental' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tolet_rental_contract" ADD COLUMN IF NOT EXISTS "payment_type" varchar(40);
--> statement-breakpoint
ALTER TABLE "tolet_rental_contract" ADD COLUMN IF NOT EXISTS "payment_amount" numeric(12, 2);
--> statement-breakpoint
ALTER TABLE "tolet_rental_contract" ADD COLUMN IF NOT EXISTS "note" text;
--> statement-breakpoint
ALTER TABLE "tolet_rental_contract" ADD COLUMN IF NOT EXISTS "agreement_file_url" text;
