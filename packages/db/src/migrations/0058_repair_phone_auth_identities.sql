UPDATE "user" AS target
SET
	"phone_number" = '+' || split_part(target."email", '@', 1),
	"phone_number_verified" = false,
	"updated_at" = now()
WHERE target."email" ~ '^8801[3-9][0-9]{8}@bikalpo\.com$'
	AND (
		target."phone_number" IS NULL
		OR target."phone_number" !~ '^\+8801[3-9][0-9]{8}$'
	)
	AND NOT EXISTS (
		SELECT 1
		FROM "user" AS existing
		WHERE existing."id" <> target."id"
			AND existing."phone_number" = '+' || split_part(target."email", '@', 1)
	);
