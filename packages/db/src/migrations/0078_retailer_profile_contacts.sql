ALTER TABLE "seller_application"
  ADD COLUMN IF NOT EXISTS "thana" text,
  ADD COLUMN IF NOT EXISTS "messenger_url" text,
  ADD COLUMN IF NOT EXISTS "telegram_url" text;
