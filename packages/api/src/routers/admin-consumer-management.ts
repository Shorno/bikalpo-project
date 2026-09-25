import { createHash } from "node:crypto";
import { db } from "@bikalpo-project/db";
import {
  address,
  product,
  productReview,
  session,
  shopFollower,
  toletBookingRequest,
  toletProperty,
  user,
  userProfile,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure } from "../index";

const filtersSchema = z.object({
  search: z.string().default(""),
  status: z.enum(["all", "active", "blocked"]).default("all"),
  accountType: z.enum(["all", "consumer"]).default("all"),
  location: z.string().default("all"),
});

const listSchema = filtersSchema.extend({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
});

const consumerIdSchema = z.object({ userId: z.string().min(1) });
const accessSchema = consumerIdSchema.extend({
  action: z.enum(["suspend", "block", "activate"]),
});

function rows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return (result as { rows?: T[] }).rows ?? [];
}

function consumerNumber(id: string) {
  return `CON-${createHash("md5").update(id).digest("hex").slice(0, 12).toUpperCase()}`;
}

// A default saved address takes precedence over the last order's delivery area.
const consumerProjection = sql`
  consumer_rows AS (
    SELECT u.id, 'CON-' || UPPER(SUBSTRING(MD5(u.id) FROM 1 FOR 12)) AS "idNumber",
      u.name, u.email, u.phone_number AS "phoneNumber",
      u.image,
      (u.banned IS TRUE AND (u.ban_expires IS NULL OR u.ban_expires > NOW())) AS banned,
      u.ban_expires AS "banExpires", u.created_at AS "createdAt",
      COALESCE(saved.location, delivery.location, 'Unknown') AS location,
      COALESCE(orders.count, 0)::int AS "orderCount",
      orders.last_order AS "lastOrder"
    FROM "user" u
    LEFT JOIN LATERAL (
      SELECT COALESCE(NULLIF(a.area, ''), a.city) AS location
      FROM address a WHERE a.user_id = u.id
      ORDER BY a.is_default DESC, a.updated_at DESC LIMIT 1
    ) saved ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(NULLIF(o.shipping_area, ''), o.shipping_city) AS location
      FROM "order" o WHERE o.user_id = u.id AND o.order_type = 'b2c'
      ORDER BY o.created_at DESC LIMIT 1
    ) delivery ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS count, MAX(o.created_at) AS last_order
      FROM "order" o
      WHERE o.user_id = u.id AND o.order_type = 'b2c'
        AND o.parent_order_id IS NULL
    ) orders ON true
    WHERE u.role = 'consumer'
  )
`;

type ConsumerRow = {
  id: string;
  idNumber: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  image: string | null;
  banned: boolean | null;
  banExpires: Date | null;
  createdAt: Date;
  location: string;
  orderCount: number;
  lastOrder: Date | null;
};

export const adminConsumerManagementRouter = {
  list: adminProcedure
    .route({
      method: "GET",
      path: "/admin/consumers",
      tags: ["User Management"],
    })
    .input(listSchema)
    .handler(async ({ input }) => {
      const search = `%${input.search.trim()}%`;
      const location = input.location === "Other" ? "Unknown" : input.location;
      const where = sql`
        WHERE (${input.search.trim() === ""} OR c.name ILIKE ${search}
          OR c.email ILIKE ${search} OR c."phoneNumber" ILIKE ${search}
          OR c.id ILIKE ${search} OR c."idNumber" ILIKE ${search})
          AND (${input.status === "all"}
            OR (${input.status === "blocked"} AND c.banned IS TRUE)
            OR (${input.status === "active"} AND c.banned IS NOT TRUE))
          AND (${input.location === "all"} OR c.location = ${location})
      `;
      const [listed, counted] = await Promise.all([
        db.execute<ConsumerRow>(sql`
          WITH ${consumerProjection}
          SELECT * FROM consumer_rows c ${where}
          ORDER BY c."createdAt" DESC, c.id DESC
          LIMIT ${input.pageSize} OFFSET ${(input.page - 1) * input.pageSize}
        `),
        db.execute<{ count: number }>(sql`
          WITH ${consumerProjection}
          SELECT COUNT(*)::int AS count FROM consumer_rows c ${where}
        `),
      ]);
      const totalCount = Number(
        rows<{ count: number }>(counted)[0]?.count ?? 0,
      );
      return {
        consumers: rows<ConsumerRow>(listed).map((row) => ({
          ...row,
          orderCount: Number(row.orderCount),
          accountType: "Consumer" as const,
          status: row.banned
            ? row.banExpires
              ? ("Suspended" as const)
              : ("Blocked" as const)
            : ("Active" as const),
        })),
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / input.pageSize),
        },
      };
    }),

  overview: adminProcedure
    .route({
      method: "GET",
      path: "/admin/consumers/overview",
      tags: ["User Management"],
    })
    .input(filtersSchema)
    .handler(async ({ input }) => {
      const search = `%${input.search.trim()}%`;
      const location = input.location === "Other" ? "Unknown" : input.location;
      const filter = sql`
        WHERE (${input.search.trim() === ""} OR c.name ILIKE ${search}
          OR c.email ILIKE ${search} OR c."phoneNumber" ILIKE ${search}
          OR c.id ILIKE ${search} OR c."idNumber" ILIKE ${search})
          AND (${input.location === "all"} OR c.location = ${location})
      `;
      const now = new Date();
      const monthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
      const dayStart = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() - 29,
        ),
      );
      const previousStart = new Date(
        dayStart.getTime() - 30 * 24 * 60 * 60 * 1000,
      );
      const [summaryResult, orderResult, trendResult, locationsResult] =
        await Promise.all([
          db.execute<{
            total: number;
            blocked: number;
            newUsers: number;
            priorNewUsers: number;
          }>(sql`
          WITH ${consumerProjection}
          SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE c.banned IS TRUE)::int AS blocked,
            COUNT(*) FILTER (WHERE c."createdAt" >= ${dayStart})::int AS "newUsers",
            COUNT(*) FILTER (WHERE c."createdAt" >= ${previousStart}
              AND c."createdAt" < ${dayStart})::int AS "priorNewUsers"
          FROM consumer_rows c ${filter}
        `),
          db.execute<{ count: number }>(sql`
          WITH ${consumerProjection}
          SELECT COUNT(*)::int AS count FROM "order" o
          INNER JOIN consumer_rows c ON c.id = o.user_id
          ${filter} AND o.order_type = 'b2c' AND o.parent_order_id IS NULL
            AND o.created_at >= ${monthStart}
        `),
          db.execute<{ date: string; count: number }>(sql`
          WITH ${consumerProjection}
          SELECT TO_CHAR(c."createdAt", 'YYYY-MM-DD') AS date,
            COUNT(*)::int AS count
          FROM consumer_rows c ${filter}
            AND c."createdAt" >= ${dayStart}
          GROUP BY 1 ORDER BY 1
        `),
          db.execute<{ location: string }>(sql`
          WITH ${consumerProjection}
          SELECT DISTINCT c.location FROM consumer_rows c
          WHERE c.location <> 'Unknown' ORDER BY c.location
        `),
        ]);
      const summary = rows<{
        total: number;
        blocked: number;
        newUsers: number;
        priorNewUsers: number;
      }>(summaryResult)[0];
      const current = Number(summary?.newUsers ?? 0);
      const previous = Number(summary?.priorNewUsers ?? 0);
      const byDate = new Map(
        rows<{ date: string; count: number }>(trendResult).map((r) => [
          r.date,
          Number(r.count),
        ]),
      );
      const points = Array.from({ length: 30 }, (_, index) => {
        const date = new Date(dayStart.getTime() + index * 24 * 60 * 60 * 1000);
        const key = date.toISOString().slice(0, 10);
        return { date: key, registrations: byDate.get(key) ?? 0 };
      });
      return {
        total: Number(summary?.total ?? 0),
        blocked: Number(summary?.blocked ?? 0),
        newUsers: current,
        growthPercent:
          previous > 0
            ? Math.round(((current - previous) / previous) * 1000) / 10
            : null,
        ordersThisMonth: Number(
          rows<{ count: number }>(orderResult)[0]?.count ?? 0,
        ),
        points,
        locations: rows<{ location: string }>(locationsResult).map(
          (r) => r.location,
        ),
      };
    }),

  getById: adminProcedure
    .route({
      method: "GET",
      path: "/admin/consumers/{userId}",
      tags: ["User Management"],
    })
    .input(consumerIdSchema)
    .handler(async ({ input }) => {
      const consumer = await db.query.user.findFirst({
        where: and(eq(user.id, input.userId), eq(user.role, "consumer")),
      });
      if (!consumer)
        throw new ORPCError("NOT_FOUND", { message: "Consumer not found" });

      const [
        profile,
        addresses,
        orders,
        bookings,
        reviews,
        complaints,
        properties,
        follows,
        notes,
        countsResult,
      ] = await Promise.all([
        db.query.userProfile.findFirst({
          where: eq(userProfile.userId, input.userId),
        }),
        db
          .select()
          .from(address)
          .where(eq(address.userId, input.userId))
          .orderBy(desc(address.isDefault), desc(address.updatedAt)),
        db.execute<{
          id: number;
          orderNumber: string;
          createdAt: Date;
          status: string;
          shopName: string | null;
          itemCount: number;
          total: string;
        }>(sql`
          SELECT o.id, o.order_number AS "orderNumber", o.created_at AS "createdAt",
            o.status,
            CASE WHEN child.shop_count > 1 THEN 'Multiple stores'
              ELSE COALESCE(s.shop_name, s.name, child.shop_name) END AS "shopName",
            o.total,
            COALESCE((SELECT SUM(oi.quantity)::int FROM order_item oi WHERE oi.order_id = o.id), 0)::int AS "itemCount"
          FROM "order" o LEFT JOIN "user" s ON s.id = o.shop_id
          LEFT JOIN LATERAL (
            SELECT COUNT(DISTINCT sub.shop_id)::int AS shop_count,
              MIN(COALESCE(store.shop_name, store.name)) AS shop_name
            FROM "order" sub LEFT JOIN "user" store ON store.id = sub.shop_id
            WHERE sub.parent_order_id = o.id
          ) child ON true
          WHERE o.user_id = ${input.userId} AND o.order_type = 'b2c'
            AND o.parent_order_id IS NULL
          ORDER BY o.created_at DESC LIMIT 100
        `),
        db
          .select()
          .from(toletBookingRequest)
          .where(eq(toletBookingRequest.requesterUserId, input.userId))
          .orderBy(desc(toletBookingRequest.createdAt))
          .limit(30),
        db
          .select({
            id: productReview.id,
            productName: product.name,
            rating: productReview.rating,
            text: productReview.comment,
            createdAt: productReview.createdAt,
          })
          .from(productReview)
          .innerJoin(product, eq(product.id, productReview.productId))
          .where(eq(productReview.userId, input.userId))
          .orderBy(desc(productReview.createdAt))
          .limit(30),
        db.execute<{
          id: number;
          complaintNumber: string;
          createdAt: Date;
          type: string;
          orderNumber: string;
          sellerName: string | null;
          description: string;
          status: string;
          assignedAdmin: string | null;
          resolvedAt: Date | null;
          resolution: string | null;
        }>(sql`
          SELECT c.id, c.complaint_number AS "complaintNumber", c.created_at AS "createdAt",
            c.type, o.order_number AS "orderNumber", s.shop_name AS "sellerName",
            c.description, c.status, a.name AS "assignedAdmin", c.resolved_at AS "resolvedAt", c.resolution
          FROM complaint c INNER JOIN "order" o ON o.id = c.order_id
          LEFT JOIN "user" s ON s.id = o.shop_id
          LEFT JOIN "user" a ON a.id = c.assigned_admin_id
          WHERE c.user_id = ${input.userId} ORDER BY c.created_at DESC LIMIT 30
        `),
        db
          .select({
            name: toletProperty.name,
            publicNumber: toletProperty.publicNumber,
          })
          .from(toletProperty)
          .where(eq(toletProperty.ownerUserId, input.userId))
          .limit(10),
        db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(shopFollower)
          .where(eq(shopFollower.consumerId, input.userId)),
        db.execute<{
          id: number;
          note: string;
          createdAt: Date;
          ticketNumber: string;
          createdBy: string | null;
        }>(sql`
          SELECT n.id, n.note, n.created_at AS "createdAt",
            t.ticket_number AS "ticketNumber", a.name AS "createdBy"
          FROM support_ticket_note n
          INNER JOIN support_ticket t ON t.id = n.ticket_id
          LEFT JOIN "user" a ON a.id = n.user_id
          WHERE t.customer_id = ${input.userId}
          ORDER BY n.created_at DESC LIMIT 30
        `),
        db.execute<{
          totalOrders: number;
          completedOrders: number;
          cancelledOrders: number;
          reviewCount: number;
        }>(sql`
          SELECT
            (SELECT COUNT(*)::int FROM "order" o WHERE o.user_id = ${input.userId}
              AND o.order_type = 'b2c' AND o.parent_order_id IS NULL) AS "totalOrders",
            (SELECT COUNT(*)::int FROM "order" o WHERE o.user_id = ${input.userId}
              AND o.order_type = 'b2c' AND o.parent_order_id IS NULL
              AND o.status = 'delivered') AS "completedOrders",
            (SELECT COUNT(*)::int FROM "order" o WHERE o.user_id = ${input.userId}
              AND o.order_type = 'b2c' AND o.parent_order_id IS NULL
              AND o.status = 'cancelled') AS "cancelledOrders",
            (SELECT COUNT(*)::int FROM product_review r WHERE r.user_id = ${input.userId}) AS "reviewCount"
        `),
      ]);
      const counts = rows<{
        totalOrders: number;
        completedOrders: number;
        cancelledOrders: number;
        reviewCount: number;
      }>(countsResult)[0];
      const allOrders = rows<{
        id: number;
        orderNumber: string;
        createdAt: Date;
        status: string;
        shopName: string | null;
        itemCount: number;
        total: string;
      }>(orders);
      return {
        consumer: {
          id: consumer.id,
          idNumber: consumerNumber(consumer.id),
          name: consumer.name,
          email: consumer.email,
          phoneNumber: consumer.phoneNumber,
          image: consumer.image,
          createdAt: consumer.createdAt,
          status:
            consumer.banned &&
            (!consumer.banExpires || consumer.banExpires > new Date())
              ? consumer.banExpires
                ? ("Suspended" as const)
                : ("Blocked" as const)
              : ("Active" as const),
          accountType: "Consumer" as const,
          whatsapp: profile?.whatsapp ?? null,
          facebook: profile?.facebook ?? null,
          properties,
        },
        overview: {
          totalOrders: Number(counts?.totalOrders ?? 0),
          completedOrders: Number(counts?.completedOrders ?? 0),
          cancelledOrders: Number(counts?.cancelledOrders ?? 0),
          followedStores: Number(follows[0]?.count ?? 0),
          reviewCount: Number(counts?.reviewCount ?? 0),
        },
        addresses,
        orders: allOrders,
        bookings: bookings.map((booking) => ({
          id: booking.id,
          publicNumber: booking.publicNumber,
          createdAt: booking.createdAt,
          status: booking.status,
          title: booking.offerSnapshot.listing.title,
          location:
            booking.offerSnapshot.property.location.fullAddress ??
            booking.offerSnapshot.property.location.area,
        })),
        reviews,
        complaints: rows<{
          id: number;
          complaintNumber: string;
          createdAt: Date;
          type: string;
          orderNumber: string;
          sellerName: string | null;
          description: string;
          status: string;
          assignedAdmin: string | null;
          resolvedAt: Date | null;
          resolution: string | null;
        }>(complaints),
        notes: rows<{
          id: number;
          note: string;
          createdAt: Date;
          ticketNumber: string;
          createdBy: string | null;
        }>(notes),
      };
    }),

  setAccess: adminProcedure
    .route({
      method: "POST",
      path: "/admin/consumers/{userId}/access",
      tags: ["User Management"],
    })
    .input(accessSchema)
    .handler(async ({ input }) => {
      const consumer = await db.query.user.findFirst({
        where: and(eq(user.id, input.userId), eq(user.role, "consumer")),
        columns: { id: true },
      });
      if (!consumer)
        throw new ORPCError("NOT_FOUND", { message: "Consumer not found" });
      await db.transaction(async (tx) => {
        await tx
          .update(user)
          .set(
            input.action === "activate"
              ? { banned: false, banReason: null, banExpires: null }
              : input.action === "suspend"
                ? {
                    banned: true,
                    banReason: "Suspended by admin",
                    banExpires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                  }
                : {
                    banned: true,
                    banReason: "Blocked by admin",
                    banExpires: null,
                  },
          )
          .where(eq(user.id, input.userId));
        if (input.action !== "activate") {
          await tx.delete(session).where(eq(session.userId, input.userId));
        }
      });
      return { success: true };
    }),
};
