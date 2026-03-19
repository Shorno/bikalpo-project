import { eq, asc, desc, and } from "drizzle-orm";
import { db } from "@bikalpo-project/db";
import { landingPricingPlan, blogPost } from "@bikalpo-project/db/schema";
import { publicProcedure } from "../index";
import { z } from "zod";

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

    // Public: get published blog posts
    getBlogPosts: publicProcedure
        .route({
            method: "GET",
            path: "/landing/blog",
            tags: ["Landing"],
            summary: "Get published blog posts for landing page",
        })
        .input(
            z
                .object({
                    limit: z.number().default(6),
                    category: z.string().optional(),
                })
                .optional(),
        )
        .handler(async ({ input }) => {
            const conditions = [eq(blogPost.isPublished, true)];
            if (input?.category) {
                conditions.push(eq(blogPost.category, input.category));
            }

            return db.query.blogPost.findMany({
                where: and(...conditions),
                columns: {
                    id: true,
                    title: true,
                    slug: true,
                    excerpt: true,
                    image: true,
                    category: true,
                    publishedAt: true,
                },
                with: {
                    author: {
                        columns: { name: true, image: true },
                    },
                },
                orderBy: [desc(blogPost.publishedAt)],
                limit: input?.limit || 6,
            });
        }),

    // Public: get single blog post by slug
    getBlogPost: publicProcedure
        .route({
            method: "GET",
            path: "/landing/blog/{slug}",
            tags: ["Landing"],
            summary: "Get a single published blog post by slug",
        })
        .input(z.object({ slug: z.string() }))
        .handler(async ({ input }) => {
            const post = await db.query.blogPost.findFirst({
                where: and(
                    eq(blogPost.slug, input.slug),
                    eq(blogPost.isPublished, true),
                ),
                with: {
                    author: {
                        columns: { name: true, image: true },
                    },
                },
            });
            return post || null;
        }),
};
