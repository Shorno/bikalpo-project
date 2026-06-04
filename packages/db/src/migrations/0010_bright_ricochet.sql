CREATE TYPE "public"."warehouse_warehouse_status" AS ENUM('active', 'pending', 'disconnected');--> statement-breakpoint
CREATE TABLE "warehouse_due_collection" (
	"id" serial PRIMARY KEY NOT NULL,
	"warehouse_id" text NOT NULL,
	"invoice_id" integer NOT NULL,
	"payment_method" "warehouse_pos_payment_method" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"transaction_ref" varchar(100),
	"note" text,
	"collected_at" timestamp DEFAULT now() NOT NULL,
	"collected_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_warehouse_connection" (
	"id" serial PRIMARY KEY NOT NULL,
	"buyer_warehouse_id" text NOT NULL,
	"supplier_warehouse_id" text NOT NULL,
	"status" "warehouse_warehouse_status" DEFAULT 'pending' NOT NULL,
	"connected_at" timestamp,
	"last_ordered_at" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "warehouse_due_collection" ADD CONSTRAINT "warehouse_due_collection_warehouse_id_user_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_due_collection" ADD CONSTRAINT "warehouse_due_collection_collected_by_id_user_id_fk" FOREIGN KEY ("collected_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_warehouse_connection" ADD CONSTRAINT "warehouse_warehouse_connection_buyer_warehouse_id_user_id_fk" FOREIGN KEY ("buyer_warehouse_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_warehouse_connection" ADD CONSTRAINT "warehouse_warehouse_connection_supplier_warehouse_id_user_id_fk" FOREIGN KEY ("supplier_warehouse_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "warehouseDueCollection_warehouseId_idx" ON "warehouse_due_collection" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "warehouseDueCollection_invoiceId_idx" ON "warehouse_due_collection" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wwc_buyer_supplier_idx" ON "warehouse_warehouse_connection" USING btree ("buyer_warehouse_id","supplier_warehouse_id");--> statement-breakpoint
CREATE INDEX "wwc_buyerWarehouseId_idx" ON "warehouse_warehouse_connection" USING btree ("buyer_warehouse_id");--> statement-breakpoint
CREATE INDEX "wwc_supplierWarehouseId_idx" ON "warehouse_warehouse_connection" USING btree ("supplier_warehouse_id");--> statement-breakpoint
CREATE INDEX "wwc_status_idx" ON "warehouse_warehouse_connection" USING btree ("status");