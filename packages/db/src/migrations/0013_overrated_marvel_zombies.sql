CREATE TABLE "salesman_area_assignment" (
	"id" serial PRIMARY KEY NOT NULL,
	"warehouse_id" text NOT NULL,
	"salesman_id" text NOT NULL,
	"area_id" integer NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"assigned_by" text,
	CONSTRAINT "salesman_area_assignment_salesman_unique" UNIQUE("salesman_id")
);
--> statement-breakpoint
ALTER TABLE "salesman_area_assignment" ADD CONSTRAINT "salesman_area_assignment_warehouse_id_user_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesman_area_assignment" ADD CONSTRAINT "salesman_area_assignment_salesman_id_user_id_fk" FOREIGN KEY ("salesman_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesman_area_assignment" ADD CONSTRAINT "salesman_area_assignment_area_id_delivery_area_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."delivery_area"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesman_area_assignment" ADD CONSTRAINT "salesman_area_assignment_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "salesman_area_assignment_warehouse_idx" ON "salesman_area_assignment" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "salesman_area_assignment_area_idx" ON "salesman_area_assignment" USING btree ("area_id");