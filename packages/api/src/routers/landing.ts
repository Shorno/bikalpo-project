import { eq, asc, sql } from "drizzle-orm";
import { db } from "@bikalpo-project/db";
import { landingPricingPlan, user, product, order } from "@bikalpo-project/db/schema";
import { publicProcedure } from "../index";
import { registeredSellers } from "./helpers/seller-directory";
import { platformDayRange } from "../lib/platform-stats";

export const landingRouter = {
    // Aggregate-only public data: no account, seller or order records exposed.
    getPlatformStats: publicProcedure
        .route({ method: "GET", path: "/landing/platform-stats", tags: ["Landing"] })
        .handler(async () => {
            const { start, end } = platformDayRange();
            const result = await db.execute(sql`${registeredSellers}
                select
                  (select count(*)::int from ${user}) as "registeredUsers",
                  (select count(distinct id)::int from canonical) as "activeSellers",
                  (select count(*)::int from ${product}
                    where ${product.status} = 'active' and ${product.visibility} = 'public') as "productsAndServices",
                  (select count(*)::int from ${order}
                    where ${order.createdAt} >= ${start.toISOString()}::timestamp
                      and ${order.createdAt} < ${end.toISOString()}::timestamp
                      and ${order.status} <> 'cancelled') as "dailyOrders"
            `);
            const row = result.rows[0];
            if (!row) throw new Error("Platform counts unavailable");
            return {
                registeredUsers: Number(row.registeredUsers),
                activeSellers: Number(row.activeSellers),
                productsAndServices: Number(row.productsAndServices),
                dailyOrders: Number(row.dailyOrders),
            };
        }),
    // Public: get active pricing plans
    getPricingPlans: publicProcedure
        .route({
            method: "GET",
            path: "/landing/pricing-plans",
            tags: ["Landing"],
            summary: "Get active pricing plans",
            description: "Get all active pricing plans for public display",
        })
        .handler(async () => {
            return db
                .select()
                .from(landingPricingPlan)
                .where(eq(landingPricingPlan.active, true))
                .orderBy(asc(landingPricingPlan.sortOrder));
        }),
};
