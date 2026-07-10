CREATE TABLE "admin_product_generation_template" (
	"core_product_id" integer PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"details" jsonb NOT NULL,
	"created_by_id" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_product_generation_template"
ADD CONSTRAINT "admin_product_generation_template_core_product_id_core_product_identity_id_fk"
FOREIGN KEY ("core_product_id") REFERENCES "public"."core_product_identity"("id")
ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "admin_product_generation_template"
ADD CONSTRAINT "admin_product_generation_template_created_by_id_user_id_fk"
FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id")
ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "admin_product_generation_template" (
	"core_product_id",
	"version",
	"details",
	"created_by_id",
	"createdAt",
	"updatedAt"
)
SELECT DISTINCT ON (p."core_product_id")
	p."core_product_id",
	1,
	jsonb_build_object(
		'name', cp."name",
		'slug', cp."slug",
		'description', p."description",
		'shortDescription', p."short_description",
		'videoUrl', p."video_url",
		'size', p."size",
		'price', p."price"::text,
		'image', p."image",
		'additionalImages', COALESCE(
			(
				SELECT jsonb_agg(pi."image_url" ORDER BY pi."id")
				FROM "product_image" pi
				WHERE pi."product_id" = p."id"
			),
			'[]'::jsonb
		),
		'features', COALESCE(p."features", '[]'::jsonb),
		'inStock', p."in_stock",
		'isFeatured', p."is_featured",
		'reorderLevel', p."reorder_level",
		'supplier', p."supplier",
		'isReturnablePack', p."is_returnable_pack",
		'defaultPackDepositAmount', COALESCE(p."default_pack_deposit_amount", 0)::text,
		'allowedPackBrands', COALESCE(p."allowed_pack_brands", '[]'::jsonb),
		'allowedPackSizes', COALESCE(p."allowed_pack_sizes", '[]'::jsonb),
		'returnPolicyEnabled', p."return_policy_enabled",
		'trackingType', p."tracking_type"::text,
		'expiryEnabled', p."expiry_enabled",
		'damageControlEnabled', p."damage_control_enabled",
		'stockTrackingEnabled', p."stock_tracking_enabled",
		'minimumOrderEnabled', p."minimum_order_enabled",
		'minimumOrderQty', p."minimum_order_qty"::text,
		'inventoryUnit', p."inventory_unit",
		'conversionEnabled', p."conversion_enabled",
		'inventoryLooseUnitEnabled', p."inventory_loose_unit_enabled",
		'inventoryLooseUnit', p."inventory_loose_unit",
		'visibility', p."visibility"::text,
		'scheduledAt', p."scheduled_at",
		'status', p."status"::text
	),
	cp."created_by_id",
	p."createdAt",
	NOW()
FROM "product" p
INNER JOIN "core_product_identity" cp ON cp."id" = p."core_product_id"
WHERE p."created_by_warehouse_id" IS NULL
  AND p."core_product_id" IS NOT NULL
  AND cp."creator_source" = 'admin'
ORDER BY p."core_product_id", p."id";
