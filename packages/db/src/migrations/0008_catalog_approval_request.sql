DO $$ BEGIN
    CREATE TYPE "public"."catalog_approval_request_type" AS ENUM('brand', 'variant_option', 'core_product');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."catalog_approval_status" AS ENUM('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "catalog_approval_request" (
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
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "catalog_approval_request_requested_by_user_id_fk"
        FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id")
        ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "catalog_approval_request_reviewed_by_user_id_fk"
        FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id")
        ON DELETE set null ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "catalogApprovalRequest_requestedBy_idx"
    ON "catalog_approval_request" ("requested_by");
CREATE INDEX IF NOT EXISTS "catalogApprovalRequest_requestType_idx"
    ON "catalog_approval_request" ("request_type");
CREATE INDEX IF NOT EXISTS "catalogApprovalRequest_status_idx"
    ON "catalog_approval_request" ("status");
CREATE INDEX IF NOT EXISTS "catalogApprovalRequest_createdAt_idx"
    ON "catalog_approval_request" ("created_at");
