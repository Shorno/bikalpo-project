-- Price attribution uses the existing full Better Auth ID in consumer_price_log.
-- The five-character suffix is presentation only; no separate alias is needed.
DROP TABLE IF EXISTS "user_display_code";
--> statement-breakpoint
DROP SEQUENCE IF EXISTS "user_display_code_seq";
