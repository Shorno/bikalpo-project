ALTER TYPE "public"."warehouse_damage_status" ADD VALUE IF NOT EXISTS 'draft' BEFORE 'posted';
--> statement-breakpoint
ALTER TABLE "warehouse_damage_entry" ADD COLUMN "draft_payload" jsonb;
