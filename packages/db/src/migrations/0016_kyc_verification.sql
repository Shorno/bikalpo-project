CREATE TABLE "kyc_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kyc_verification" ADD CONSTRAINT "kyc_verification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "kyc_verification" ADD CONSTRAINT "kyc_verification_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "kyc_verification_user_id_idx" ON "kyc_verification" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "kyc_verification_status_idx" ON "kyc_verification" USING btree ("status");
--> statement-breakpoint
INSERT INTO "kyc_verification" ("id", "user_id", "status", "created_at", "updated_at")
SELECT
	gen_random_uuid()::text,
	u.id,
	'pending',
	NOW(),
	NOW()
FROM "user" u
WHERE u.role IN ('shop_owner', 'warehouse')
	AND (
		EXISTS (SELECT 1 FROM "seller_application" sa WHERE sa.user_id = u.id)
		OR EXISTS (SELECT 1 FROM "warehouse_application" wa WHERE wa.user_id = u.id)
	)
	AND NOT EXISTS (
		SELECT 1 FROM "kyc_verification" k WHERE k.user_id = u.id
	);
