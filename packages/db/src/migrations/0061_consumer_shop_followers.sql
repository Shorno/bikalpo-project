CREATE TABLE "shop_follower" (
	"consumer_id" text NOT NULL,
	"shop_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shop_follower_consumer_shop_pk" PRIMARY KEY("consumer_id","shop_id")
);
--> statement-breakpoint
ALTER TABLE "shop_follower" ADD CONSTRAINT "shop_follower_consumer_id_user_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shop_follower" ADD CONSTRAINT "shop_follower_shop_id_user_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "shopFollower_shopId_idx" ON "shop_follower" USING btree ("shop_id");
--> statement-breakpoint
CREATE INDEX "shopFollower_consumerId_idx" ON "shop_follower" USING btree ("consumer_id");
