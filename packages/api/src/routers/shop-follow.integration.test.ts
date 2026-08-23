import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import dotenv from "dotenv";

dotenv.config({ path: "apps/server/.env" });

const runDatabaseIntegration = process.env.RUN_SHOP_FOLLOW_DB_TEST === "1";

type ProcedureLike = {
  "~orpc": {
    handler(args: { context: unknown; input: unknown }): Promise<unknown>;
  };
};

async function invokeProcedure<Result>(
  procedure: unknown,
  context: unknown,
  input: unknown,
) {
  return (procedure as ProcedureLike)["~orpc"].handler({
    context,
    input,
  }) as Promise<Result>;
}

test(
  "a consumer can follow a shop once and unfollow it",
  { skip: !runDatabaseIntegration },
  async () => {
    const [{ db }, schema, drizzle, routerModule] = await Promise.all([
      import("@bikalpo-project/db"),
      import("@bikalpo-project/db/schema"),
      import("drizzle-orm"),
      import("./customer"),
    ]);
    const { shopFollower, user } = schema;
    const { inArray } = drizzle;
    const { customerRouter } = routerModule;
    const suffix = randomUUID();
    const consumerId = `follow-consumer-${suffix}`;
    const shopId = `follow-shop-${suffix}`;
    const shopSlug = `follow-shop-${suffix}`;
    const userIds = [consumerId, shopId];
    const consumerContext = {
      session: { user: { id: consumerId, role: "consumer" } },
    };

    try {
      await db.insert(user).values([
        {
          id: consumerId,
          name: "Follower Consumer",
          email: `${consumerId}@example.test`,
          role: "consumer",
        },
        {
          id: shopId,
          name: "Follow Shop Owner",
          email: `${shopId}@example.test`,
          role: "shop_owner",
          isSeller: true,
          sellerStatus: "approved",
          shopName: "Follow Shop",
          shopSlug,
        },
      ]);

      const initial = await invokeProcedure<{
        followState: { followerCount: number; isFollowing: boolean };
      }>(customerRouter.getShopBySlug, consumerContext, {
        slug: shopSlug,
        sort: "recommended",
        page: 1,
        limit: 12,
      });
      assert.deepEqual(initial.followState, {
        followerCount: 0,
        isFollowing: false,
      });

      const followed = await invokeProcedure<{
        followerCount: number;
        isFollowing: boolean;
      }>(customerRouter.setShopFollow, consumerContext, {
        shopId,
        follow: true,
      });
      assert.deepEqual(
        {
          followerCount: followed.followerCount,
          isFollowing: followed.isFollowing,
        },
        { followerCount: 1, isFollowing: true },
      );

      const followedAgain = await invokeProcedure<{
        followerCount: number;
        isFollowing: boolean;
      }>(customerRouter.setShopFollow, consumerContext, {
        shopId,
        follow: true,
      });
      assert.equal(followedAgain.followerCount, 1);

      const publicView = await invokeProcedure<{
        followState: { followerCount: number; isFollowing: boolean };
      }>(
        customerRouter.getShopBySlug,
        { session: null },
        {
          slug: shopSlug,
          sort: "recommended",
          page: 1,
          limit: 12,
        },
      );
      assert.deepEqual(publicView.followState, {
        followerCount: 1,
        isFollowing: false,
      });

      const unfollowed = await invokeProcedure<{
        followerCount: number;
        isFollowing: boolean;
      }>(customerRouter.setShopFollow, consumerContext, {
        shopId,
        follow: false,
      });
      assert.deepEqual(
        {
          followerCount: unfollowed.followerCount,
          isFollowing: unfollowed.isFollowing,
        },
        { followerCount: 0, isFollowing: false },
      );
    } finally {
      await db
        .delete(shopFollower)
        .where(inArray(shopFollower.shopId, [shopId]));
      await db.delete(user).where(inArray(user.id, userIds));
    }
  },
);
