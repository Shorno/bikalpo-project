/**
 * Admin Blog ORPC Router
 *
 * CRUD endpoints for managing blog posts from the admin dashboard.
 */
import { ORPCError } from "@orpc/server";
import { db } from "@bikalpo-project/db";
import { blogPost } from "@bikalpo-project/db/schema";
import { and, desc, eq, ilike, count } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure } from "../index";

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

// ════════════════════════════════════════════════════════════════
// ROUTER
// ════════════════════════════════════════════════════════════════

export const adminBlogRouter = {
    // ── List Blog Posts ──────────────────────────────────────────

    list: adminProcedure
        .route({
            method: "GET",
            path: "/admin/blog",
            tags: ["Admin Blog"],
            summary: "List all blog posts (admin)",
        })
        .input(
            z.object({
                search: z.string().optional(),
                category: z.string().optional(),
                published: z.boolean().optional(),
                page: z.number().default(1),
                limit: z.number().default(20),
            }),
        )
        .handler(async ({ input }) => {
            const conditions = [];
            if (input.search) {
                conditions.push(ilike(blogPost.title, `%${input.search}%`));
            }
            if (input.category) {
                conditions.push(eq(blogPost.category, input.category));
            }
            if (input.published !== undefined) {
                conditions.push(eq(blogPost.isPublished, input.published));
            }

            const where =
                conditions.length > 0 ? and(...conditions) : undefined;

            const [posts, totalResult] = await Promise.all([
                db.query.blogPost.findMany({
                    where,
                    with: {
                        author: {
                            columns: { id: true, name: true, image: true },
                        },
                    },
                    orderBy: [desc(blogPost.createdAt)],
                    limit: input.limit,
                    offset: (input.page - 1) * input.limit,
                }),
                db
                    .select({ count: count(blogPost.id) })
                    .from(blogPost)
                    .where(where),
            ]);

            return {
                posts,
                total: totalResult[0]?.count || 0,
                page: input.page,
                totalPages: Math.ceil(
                    (totalResult[0]?.count || 0) / input.limit,
                ),
            };
        }),

    // ── Get Single Blog Post ─────────────────────────────────────

    getById: adminProcedure
        .route({
            method: "GET",
            path: "/admin/blog/{id}",
            tags: ["Admin Blog"],
            summary: "Get a single blog post by ID (admin)",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ input }) => {
            const post = await db.query.blogPost.findFirst({
                where: eq(blogPost.id, input.id),
                with: {
                    author: {
                        columns: { id: true, name: true, image: true },
                    },
                },
            });

            if (!post) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Blog post not found",
                });
            }

            return post;
        }),

    // ── Create Blog Post ─────────────────────────────────────────

    create: adminProcedure
        .route({
            method: "POST",
            path: "/admin/blog",
            tags: ["Admin Blog"],
            summary: "Create a new blog post",
        })
        .input(
            z.object({
                title: z.string().min(1, "Title is required"),
                excerpt: z.string().optional(),
                content: z.string().optional(),
                image: z.string().optional(),
                category: z.string().default("General"),
                isPublished: z.boolean().default(false),
            }),
        )
        .handler(async ({ input, context }) => {
            const slug = slugify(input.title);

            // Check slug uniqueness
            const existing = await db.query.blogPost.findFirst({
                where: eq(blogPost.slug, slug),
            });
            const finalSlug = existing
                ? `${slug}-${Date.now()}`
                : slug;

            const [post] = await db
                .insert(blogPost)
                .values({
                    title: input.title,
                    slug: finalSlug,
                    excerpt: input.excerpt || null,
                    content: input.content || null,
                    image: input.image || null,
                    category: input.category,
                    authorId: context.session.user.id,
                    isPublished: input.isPublished,
                    publishedAt: input.isPublished ? new Date() : null,
                })
                .returning();

            return { success: true, post };
        }),

    // ── Update Blog Post ─────────────────────────────────────────

    update: adminProcedure
        .route({
            method: "POST",
            path: "/admin/blog/{id}/update",
            tags: ["Admin Blog"],
            summary: "Update an existing blog post",
        })
        .input(
            z.object({
                id: z.number(),
                title: z.string().min(1).optional(),
                excerpt: z.string().optional(),
                content: z.string().optional(),
                image: z.string().optional(),
                category: z.string().optional(),
                isPublished: z.boolean().optional(),
            }),
        )
        .handler(async ({ input }) => {
            const existing = await db.query.blogPost.findFirst({
                where: eq(blogPost.id, input.id),
            });

            if (!existing) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Blog post not found",
                });
            }

            const updateData: Record<string, unknown> = {};
            if (input.title !== undefined) {
                updateData.title = input.title;
                updateData.slug = slugify(input.title);
            }
            if (input.excerpt !== undefined)
                updateData.excerpt = input.excerpt || null;
            if (input.content !== undefined)
                updateData.content = input.content || null;
            if (input.image !== undefined)
                updateData.image = input.image || null;
            if (input.category !== undefined)
                updateData.category = input.category;
            if (input.isPublished !== undefined) {
                updateData.isPublished = input.isPublished;
                if (input.isPublished && !existing.publishedAt) {
                    updateData.publishedAt = new Date();
                }
            }

            const [updated] = await db
                .update(blogPost)
                .set(updateData)
                .where(eq(blogPost.id, input.id))
                .returning();

            return { success: true, post: updated };
        }),

    // ── Delete Blog Post ─────────────────────────────────────────

    delete: adminProcedure
        .route({
            method: "POST",
            path: "/admin/blog/{id}/delete",
            tags: ["Admin Blog"],
            summary: "Delete a blog post",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ input }) => {
            const existing = await db.query.blogPost.findFirst({
                where: eq(blogPost.id, input.id),
            });

            if (!existing) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Blog post not found",
                });
            }

            await db.delete(blogPost).where(eq(blogPost.id, input.id));

            return { success: true, message: "Blog post deleted" };
        }),

    // ── Toggle Publish ───────────────────────────────────────────

    togglePublish: adminProcedure
        .route({
            method: "POST",
            path: "/admin/blog/{id}/toggle-publish",
            tags: ["Admin Blog"],
            summary: "Toggle publish status of a blog post",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ input }) => {
            const existing = await db.query.blogPost.findFirst({
                where: eq(blogPost.id, input.id),
            });

            if (!existing) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Blog post not found",
                });
            }

            const newPublished = !existing.isPublished;
            const [updated] = await db
                .update(blogPost)
                .set({
                    isPublished: newPublished,
                    publishedAt: newPublished
                        ? existing.publishedAt || new Date()
                        : existing.publishedAt,
                })
                .where(eq(blogPost.id, input.id))
                .returning();

            return {
                success: true,
                post: updated,
                message: newPublished ? "Post published" : "Post unpublished",
            };
        }),
};
