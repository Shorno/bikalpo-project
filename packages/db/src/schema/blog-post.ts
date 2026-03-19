import { relations } from "drizzle-orm";
import {
    boolean,
    index,
    integer,
    pgTable,
    text,
    timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/**
 * Blog Post — admin-managed blog posts displayed on the landing/B2B page.
 */
export const blogPost = pgTable(
    "blog_post",
    {
        id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
        title: text("title").notNull(),
        slug: text("slug").notNull().unique(),
        excerpt: text("excerpt"), // short summary for cards
        content: text("content"), // full blog content (markdown or HTML)
        image: text("image"), // cover image URL
        category: text("category").notNull().default("General"),
        authorId: text("author_id").references(() => user.id, {
            onDelete: "set null",
        }),
        isPublished: boolean("is_published").notNull().default(false),
        publishedAt: timestamp("published_at"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        index("blog_post_slug_idx").on(table.slug),
        index("blog_post_published_idx").on(table.isPublished),
        index("blog_post_category_idx").on(table.category),
    ],
);

export const blogPostRelations = relations(blogPost, ({ one }) => ({
    author: one(user, {
        fields: [blogPost.authorId],
        references: [user.id],
    }),
}));

export type BlogPost = typeof blogPost.$inferSelect;
export type NewBlogPost = typeof blogPost.$inferInsert;
