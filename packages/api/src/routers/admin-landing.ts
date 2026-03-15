import { eq, asc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import { landingPricingPlan } from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";

const pricingPlanInput = z.object({
    name: z.string().min(1),
    subtitle: z.string().optional().default(""),
    priceMonthly: z.number().int().min(0),
    priceYearly: z.number().int().min(0).optional(),
    features: z.array(z.string()).default([]),
    isPopular: z.boolean().default(false),
    ctaText: z.string().default("Choose Plan"),
    sortOrder: z.number().int().default(0),
});

export const adminLandingRouter = {
    // ─── Pricing Plans CRUD ──────────────────────────────────────────────

    getAllPlans: adminProcedure
        .route({
            method: "GET",
            path: "/admin/landing/pricing-plans",
            tags: ["Admin Landing"],
            summary: "Get all pricing plans",
            description: "Get all pricing plans for admin management",
        })
        .handler(async () => {
            return db
                .select()
                .from(landingPricingPlan)
                .orderBy(asc(landingPricingPlan.sortOrder));
        }),

    createPlan: adminProcedure
        .route({
            method: "POST",
            path: "/admin/landing/pricing-plans",
            tags: ["Admin Landing"],
            summary: "Create pricing plan",
            description: "Create a new pricing plan",
        })
        .input(pricingPlanInput)
        .handler(async ({ input }) => {
            await db.insert(landingPricingPlan).values(input);
            return { message: "Pricing plan created" };
        }),

    updatePlan: adminProcedure
        .route({
            method: "PUT",
            path: "/admin/landing/pricing-plans/update",
            tags: ["Admin Landing"],
            summary: "Update pricing plan",
            description: "Update an existing pricing plan",
        })
        .input(
            z.object({
                id: z.number().int(),
                data: pricingPlanInput.partial(),
            }),
        )
        .handler(async ({ input }) => {
            await db
                .update(landingPricingPlan)
                .set({ ...input.data, updatedAt: new Date() })
                .where(eq(landingPricingPlan.id, input.id));
            return { message: "Pricing plan updated" };
        }),

    togglePlanActive: adminProcedure
        .route({
            method: "PATCH",
            path: "/admin/landing/pricing-plans/toggle-active",
            tags: ["Admin Landing"],
            summary: "Toggle pricing plan active status",
            description: "Activate or deactivate a pricing plan",
        })
        .input(z.object({ id: z.number().int(), active: z.boolean() }))
        .handler(async ({ input }) => {
            await db
                .update(landingPricingPlan)
                .set({ active: input.active, updatedAt: new Date() })
                .where(eq(landingPricingPlan.id, input.id));
            return {
                message: `Plan ${input.active ? "activated" : "deactivated"}`,
            };
        }),

    deletePlan: adminProcedure
        .route({
            method: "DELETE",
            path: "/admin/landing/pricing-plans/delete",
            tags: ["Admin Landing"],
            summary: "Delete pricing plan",
            description: "Delete a pricing plan",
        })
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ input }) => {
            await db
                .delete(landingPricingPlan)
                .where(eq(landingPricingPlan.id, input.id));
            return { message: "Pricing plan deleted" };
        }),
};
