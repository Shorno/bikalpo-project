ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS "shop_function" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_role" (
  "id" serial PRIMARY KEY NOT NULL,
  "shop_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "is_system" boolean DEFAULT false NOT NULL,
  "legacy_function" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_role_permission" (
  "role_id" integer NOT NULL,
  "resource" text NOT NULL,
  "actions" text[] NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "shop_role_permission_role_id_resource_pk" PRIMARY KEY("role_id", "resource")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_user_role" (
  "user_id" text PRIMARY KEY NOT NULL,
  "shop_id" text NOT NULL,
  "role_id" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_permission_audit" (
  "id" serial PRIMARY KEY NOT NULL,
  "shop_id" text NOT NULL,
  "role_id" integer,
  "changed_by_user_id" text,
  "event" text NOT NULL,
  "subject_user_id" text,
  "before" jsonb,
  "after" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shop_role" ADD CONSTRAINT "shop_role_shop_id_user_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shop_role_permission" ADD CONSTRAINT "shop_role_permission_role_id_shop_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."shop_role"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shop_user_role" ADD CONSTRAINT "shop_user_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shop_user_role" ADD CONSTRAINT "shop_user_role_shop_id_user_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shop_user_role" ADD CONSTRAINT "shop_user_role_role_id_shop_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."shop_role"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shop_permission_audit" ADD CONSTRAINT "shop_permission_audit_shop_id_user_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shop_permission_audit" ADD CONSTRAINT "shop_permission_audit_role_id_shop_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."shop_role"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shop_permission_audit" ADD CONSTRAINT "shop_permission_audit_changed_by_user_id_user_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shop_permission_audit" ADD CONSTRAINT "shop_permission_audit_subject_user_id_user_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shopRole_shop_name_unique" ON "shop_role" USING btree ("shop_id", "name");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shopRole_shop_legacy_function_unique" ON "shop_role" USING btree ("shop_id", "legacy_function") WHERE "legacy_function" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shopRole_shop_idx" ON "shop_role" USING btree ("shop_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shopRolePermission_role_idx" ON "shop_role_permission" USING btree ("role_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shopUserRole_shop_idx" ON "shop_user_role" USING btree ("shop_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shopUserRole_role_idx" ON "shop_user_role" USING btree ("role_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shopPermissionAudit_shop_created_idx" ON "shop_permission_audit" USING btree ("shop_id", "created_at");
