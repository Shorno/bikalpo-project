ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "login_verification" text DEFAULT 'otp_only' NOT NULL,
  ADD COLUMN IF NOT EXISTS "remember_trusted_device" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "auto_logout_minutes" integer DEFAULT 30 NOT NULL,
  ADD COLUMN IF NOT EXISTS "allow_multiple_login_devices" boolean DEFAULT false NOT NULL;
