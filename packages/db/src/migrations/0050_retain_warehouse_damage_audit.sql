ALTER TABLE "warehouse_damage_movement"
  DROP CONSTRAINT "warehouse_damage_movement_damage_entry_id_warehouse_damage_entry_id_fk";
--> statement-breakpoint
ALTER TABLE "warehouse_damage_movement"
  DROP CONSTRAINT "warehouse_damage_movement_damage_item_id_warehouse_damage_item_id_fk";
--> statement-breakpoint
ALTER TABLE "warehouse_damage_movement"
  DROP CONSTRAINT "warehouse_damage_movement_warehouse_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "warehouse_damage_movement"
  ADD CONSTRAINT "warehouse_damage_movement_damage_entry_id_warehouse_damage_entry_id_fk"
  FOREIGN KEY ("damage_entry_id") REFERENCES "public"."warehouse_damage_entry"("id")
  ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "warehouse_damage_movement"
  ADD CONSTRAINT "warehouse_damage_movement_damage_item_id_warehouse_damage_item_id_fk"
  FOREIGN KEY ("damage_item_id") REFERENCES "public"."warehouse_damage_item"("id")
  ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "warehouse_damage_movement"
  ADD CONSTRAINT "warehouse_damage_movement_warehouse_id_user_id_fk"
  FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id")
  ON DELETE restrict ON UPDATE no action;
