CREATE TYPE "public"."catalog_approval_request_type" AS ENUM('brand', 'variant_option', 'core_product');--> statement-breakpoint
CREATE TYPE "public"."catalog_approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "catalog_approval_request" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_type" "catalog_approval_request_type" NOT NULL,
	"status" "catalog_approval_status" DEFAULT 'pending' NOT NULL,
	"requested_by" text NOT NULL,
	"payload" jsonb NOT NULL,
	"admin_note" text,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"created_entity_id" integer,
	"created_entity_snapshot" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_approval_request" ADD CONSTRAINT "catalog_approval_request_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_approval_request" ADD CONSTRAINT "catalog_approval_request_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalogApprovalRequest_requestedBy_idx" ON "catalog_approval_request" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "catalogApprovalRequest_requestType_idx" ON "catalog_approval_request" USING btree ("request_type");--> statement-breakpoint
CREATE INDEX "catalogApprovalRequest_status_idx" ON "catalog_approval_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "catalogApprovalRequest_createdAt_idx" ON "catalog_approval_request" USING btree ("createdAt");