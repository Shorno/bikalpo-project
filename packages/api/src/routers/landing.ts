import { eq, asc } from "drizzle-orm";
import { db } from "@bikalpo-project/db";
import { landingPricingPlan } from "@bikalpo-project/db/schema";
import { publicProcedure } from "../index";

export const landingRouter = {
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
