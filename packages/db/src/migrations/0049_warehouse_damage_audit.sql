ALTER TABLE "warehouse_damage_item"
  ADD COLUMN "carton_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "source_total_weight_kg" numeric(12, 2),
  ADD COLUMN "costing_method" varchar(40) DEFAULT 'batch_acquisition_cost' NOT NULL,
  ADD COLUMN "currency" varchar(3) DEFAULT 'BDT' NOT NULL;
--> statement-breakpoint
CREATE TABLE "warehouse_damage_movement" (
  "id" serial PRIMARY KEY NOT NULL,
  "damage_entry_id" integer NOT NULL,
  "damage_item_id" integer NOT NULL,
  "warehouse_id" text NOT NULL,
  "inventory_id" integer NOT NULL,
  "carton_id" integer,
  "movement_kind" varchar(20) NOT NULL,
  "quantity_delta" numeric(12, 2) NOT NULL,
  "quantity_unit" varchar(30) NOT NULL,
  "actor_id" text,
  "actor_name" text NOT NULL,
  "approved_by_id" text,
  "approved_at" timestamp DEFAULT now() NOT NULL,
  "reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "warehouse_damage_movement"
  ADD CONSTRAINT "warehouse_damage_movement_damage_entry_id_warehouse_damage_entry_id_fk"
  FOREIGN KEY ("damage_entry_id") REFERENCES "public"."warehouse_damage_entry"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "warehouse_damage_movement"
  ADD CONSTRAINT "warehouse_damage_movement_damage_item_id_warehouse_damage_item_id_fk"
  FOREIGN KEY ("damage_item_id") REFERENCES "public"."warehouse_damage_item"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "warehouse_damage_movement"
  ADD CONSTRAINT "warehouse_damage_movement_warehouse_id_user_id_fk"
  FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "warehouse_damage_movement"
  ADD CONSTRAINT "warehouse_damage_movement_inventory_id_inventory_id_fk"
  FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id")
  ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "warehouse_damage_movement"
  ADD CONSTRAINT "warehouse_damage_movement_carton_id_carton_id_fk"
  FOREIGN KEY ("carton_id") REFERENCES "public"."carton"("id")
  ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "warehouse_damage_movement"
  ADD CONSTRAINT "warehouse_damage_movement_actor_id_user_id_fk"
  FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "warehouse_damage_movement"
  ADD CONSTRAINT "warehouse_damage_movement_approved_by_id_user_id_fk"
  FOREIGN KEY ("approved_by_id") REFERENCES "public"."user"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "warehouseDamageMovement_entryItemKind_uq"
  ON "warehouse_damage_movement" USING btree ("damage_entry_id", "damage_item_id", "movement_kind");
--> statement-breakpoint
CREATE INDEX "warehouseDamageMovement_warehouse_idx"
  ON "warehouse_damage_movement" USING btree ("warehouse_id");
--> statement-breakpoint
CREATE INDEX "warehouseDamageMovement_inventory_idx"
  ON "warehouse_damage_movement" USING btree ("inventory_id");
