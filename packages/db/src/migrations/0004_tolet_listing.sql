CREATE TABLE IF NOT EXISTS "tolet_listing" (
    "id" serial PRIMARY KEY NOT NULL,
    "title" varchar(255) NOT NULL,
    "description" text,
    "location" varchar(255) NOT NULL,
    "rent" numeric(12, 2) NOT NULL DEFAULT 0,
    "area" varchar(100),
    "bedrooms" integer,
    "bathrooms" integer,
    "contact_info" varchar(255) NOT NULL,
    "image_url" varchar(1024),
    "active" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "tolet_listing_created_at_idx" ON "tolet_listing" ("createdAt");
