import { shopPortalShopId } from "@bikalpo-project/auth/shop-staff-access";
import { db } from "@bikalpo-project/db";
import { storeItemRequest, user } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { consumerProcedure, shopPermissionProcedure } from "../index";
import { shopSessionUser } from "../shop-portal-scope";

const pagination = z.object({ page: z.number().int().min(1).default(1) });
const fields = z.object({
  shopId: z.string().min(1),
  itemName: z.string().trim().min(2).max(200),
  brand: z.string().trim().max(100).optional(),
  quantity: z.number().int().min(1).max(10000),
  description: z.string().trim().max(2000).optional(),
});

export const storeItemRequestRouter = {
  create: consumerProcedure
    .input(fields)
    .handler(async ({ context, input }) => {
      const shop = await db.query.user.findFirst({
        where: and(
          eq(user.id, input.shopId),
          eq(user.role, "shop_owner"),
          eq(user.sellerStatus, "approved"),
        ),
        columns: { id: true },
      });
      if (!shop)
        throw new ORPCError("NOT_FOUND", { message: "Store is unavailable" });
      const [request] = await db
        .insert(storeItemRequest)
        .values({ ...input, customerId: context.session.user.id })
        .returning();
      return request;
    }),
  mine: consumerProcedure
    .input(pagination.extend({ shopId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const where = and(
        eq(storeItemRequest.customerId, context.session.user.id),
        eq(storeItemRequest.shopId, input.shopId),
      );
      const [requests, totals] = await Promise.all([
        db
          .select()
          .from(storeItemRequest)
          .where(where)
          .orderBy(desc(storeItemRequest.createdAt), desc(storeItemRequest.id))
          .limit(20)
          .offset((input.page - 1) * 20),
        db.select({ total: count() }).from(storeItemRequest).where(where),
      ]);
      return { requests, total: totals[0]?.total ?? 0 };
    }),
  inbox: shopPermissionProcedure("shop_support", "view")
    .input(pagination)
    .handler(async ({ context, input }) => {
      const shopId = shopPortalShopId(shopSessionUser(context.session.user));
      if (!shopId) throw new ORPCError("FORBIDDEN");
      const where = eq(storeItemRequest.shopId, shopId);
      const [requests, totals] = await Promise.all([
        db
          .select({ request: storeItemRequest, customerName: user.name })
          .from(storeItemRequest)
          .innerJoin(user, eq(user.id, storeItemRequest.customerId))
          .where(where)
          .orderBy(desc(storeItemRequest.createdAt), desc(storeItemRequest.id))
          .limit(20)
          .offset((input.page - 1) * 20),
        db.select({ total: count() }).from(storeItemRequest).where(where),
      ]);
      return { requests, total: totals[0]?.total ?? 0 };
    }),
  respond: shopPermissionProcedure("shop_support", "update")
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["available", "unavailable"]),
        response: z.string().trim().min(2).max(2000),
      }),
    )
    .handler(async ({ context, input }) => {
      const shopId = shopPortalShopId(shopSessionUser(context.session.user));
      if (!shopId) throw new ORPCError("FORBIDDEN");
      const [request] = await db
        .update(storeItemRequest)
        .set({
          status: input.status,
          response: input.response,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(storeItemRequest.id, input.id),
            eq(storeItemRequest.shopId, shopId),
          ),
        )
        .returning();
      if (!request)
        throw new ORPCError("NOT_FOUND", { message: "Request not found" });
      return request;
    }),
};
