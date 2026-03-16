CREATE TABLE IF NOT EXISTS "customer_home_tab" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"slug" varchar(150) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_home_tab_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_home_tab_product" (
	"id" serial PRIMARY KEY NOT NULL,
	"tab_id" integer NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"image" varchar(255) NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_home_tab_product" ADD CONSTRAINT "customer_home_tab_product_tab_id_customer_home_tab_id_fk" FOREIGN KEY ("tab_id") REFERENCES "public"."customer_home_tab"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "customerHomeTab_displayOrder_idx" ON "customer_home_tab" USING btree ("display_order");
--> statement-breakpoint
CREATE INDEX "customerHomeTabProduct_tab_idx" ON "customer_home_tab_product" USING btree ("tab_id");
--> statement-breakpoint
CREATE INDEX "customerHomeTabProduct_displayOrder_idx" ON "customer_home_tab_product" USING btree ("tab_id", "display_order");