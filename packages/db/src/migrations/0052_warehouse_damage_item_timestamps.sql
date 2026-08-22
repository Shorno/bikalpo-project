ALTER TABLE "warehouse_damage_item"
  ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL,
  ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
