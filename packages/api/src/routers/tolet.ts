import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import { toletListing } from "@bikalpo-project/db/schema";
import { adminProcedure, publicProcedure } from "../index";

const toletInput = z.object({
  title: z.string().min(5),
  description: z.string().optional().default(""),
  location: z.string().min(3),
  rent: z.preprocess((value) => {
    if (typeof value === "string") {
      const n = Number(value);
      return Number.isNaN(n) ? value : n;
    }
    return value;
  }, z.number().min(0)),
  area: z.preprocess((value) => {
    if (value == null) return undefined;
    return String(value);
  }, z.string().optional()),
  bedrooms: z.preprocess((value) => {
    if (typeof value === "string" && value.trim() !== "") {
      const n = Number(value);
      return Number.isNaN(n) ? value : n;
    }
    return value;
  }, z.number().int().nonnegative().optional()),
  bathrooms: z.preprocess((value) => {
    if (typeof value === "string" && value.trim() !== "") {
      const n = Number(value);
      return Number.isNaN(n) ? value : n;
    }
    return value;
  }, z.number().int().nonnegative().optional()),
  contactInfo: z.string().min(5),
  imageUrl: z
    .preprocess(
      (value) => {
        if (value == null || value === "") return "";
        return String(value).trim();
      },
      z.union([z.string().url(), z.literal("")]),
    )
    .optional(),
  active: z.preprocess((value) => {
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
    }
    return value;
  }, z.boolean().optional().default(true)),
});

export const toLetRouter = {
  getAll: publicProcedure
    .route({
      method: "GET",
      path: "/to-let",
      tags: ["To-Let"],
      summary: "Get active To-Let listings",
      description: "Get all publicly visible To-Let listings",
    })
    .handler(async () => {
      return db
        .select()
        .from(toletListing)
        .where(eq(toletListing.active, true))
        .orderBy(desc(toletListing.createdAt));
    }),

  getById: publicProcedure
    .route({
      method: "GET",
      path: "/to-let/{id}",
      tags: ["To-Let"],
      summary: "Get To-Let listing by id",
      description: "Get a specific To-Let listing by id",
    })
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const item = await db
        .select()
        .from(toletListing)
        .where(
          and(eq(toletListing.id, input.id), eq(toletListing.active, true)),
        )
        .limit(1)
        .then((rows) => rows[0] || null);

      if (!item) {
        throw new Error("Not found");
      }

      return item;
    }),
};

export const adminToLetRouter = {
  getAll: adminProcedure
    .route({
      method: "GET",
      path: "/admin/to-let",
      tags: ["Admin To-Let"],
      summary: "Admin: get all To-Let listings",
      description: "Get all To-Let listings for admin management",
    })
    .handler(async () => {
      return db
        .select()
        .from(toletListing)
        .orderBy(desc(toletListing.createdAt));
    }),

  create: adminProcedure
    .route({
      method: "POST",
      path: "/admin/to-let",
      tags: ["Admin To-Let"],
      summary: "Admin: create To-Let listing",
      description: "Create a new To-Let listing",
    })
    .input(toletInput)
    .handler(async ({ input }) => {
      await db.insert(toletListing).values({
        ...input,
        rent: input.rent.toString(),
      });
      return { message: "To-Let listing created" };
    }),

  update: adminProcedure
    .route({
      method: "PUT",
      path: "/admin/to-let/update",
      tags: ["Admin To-Let"],
      summary: "Admin: update To-Let listing",
      description: "Update an existing To-Let listing",
    })
    .input(z.object({ id: z.number().int(), data: toletInput.partial() }))
    .handler(async ({ input }) => {
      const data: Record<string, unknown> = {
        ...input.data,
        updatedAt: new Date(),
      };
      if (input.data.rent != null) {
        data.rent = String(input.data.rent);
      }
      await db
        .update(toletListing)
        .set(data as any)
        .where(eq(toletListing.id, input.id));
      return { message: "To-Let listing updated" };
    }),

  delete: adminProcedure
    .route({
      method: "DELETE",
      path: "/admin/to-let/delete",
      tags: ["Admin To-Let"],
      summary: "Admin: delete To-Let listing",
      description: "Delete a To-Let listing",
    })
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      await db.delete(toletListing).where(eq(toletListing.id, input.id));
      return { message: "To-Let listing deleted" };
    }),
};
