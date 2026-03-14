import { desc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import { offer } from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";

const normalizeVarchar20 = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 20);
};

// Helper function to clean up optional string fields
const cleanupOptionalFields = (data: any) => ({
  ...data,
  discountPercentage:
    typeof data.discountPercentage === "number"
      ? Math.max(0, Math.min(100, Math.round(data.discountPercentage)))
      : data.discountPercentage,
  originalPrice:
    typeof data.originalPrice === "number"
      ? Math.max(0, Math.round(data.originalPrice))
      : undefined,
  comboPrice:
    typeof data.comboPrice === "number"
      ? Math.max(0, Math.round(data.comboPrice))
      : undefined,
  priority:
    typeof data.priority === "number"
      ? Math.max(0, Math.round(data.priority))
      : 0,
  bannerImage:
    data.bannerImage &&
    typeof data.bannerImage === "string" &&
    data.bannerImage.trim()
      ? data.bannerImage
      : undefined,
  products:
    data.products && typeof data.products === "string" && data.products.trim()
      ? data.products
      : undefined,
  badge:
    data.badge && typeof data.badge === "string" && data.badge.trim()
      ? data.badge
      : undefined,
  startDate: normalizeVarchar20(data.startDate),
  endDate: normalizeVarchar20(data.endDate),
});

const offerBaseSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional().default(""),
  type: z
    .enum(["Weekly Offers", "Combo Deals", "Brand Campaigns", "More Offers"])
    .default("Weekly Offers"),
  discountPercentage: z.coerce.number().min(0).max(100).default(0),
  originalPrice: z.coerce.number().nonnegative().optional(),
  comboPrice: z.coerce.number().nonnegative().optional(),
  bannerImage: z.string().optional().or(z.literal("")),
  products: z.string().optional(), // JSON string of products
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  priority: z.coerce.number().default(0),
  badge: z.string().optional().or(z.literal("")),
  active: z.boolean().default(true),
});

const offerInput = offerBaseSchema.transform(cleanupOptionalFields);
const offerUpdateInput = offerBaseSchema
  .partial()
  .transform(cleanupOptionalFields);

export const adminOfferRouter = {
  getAll: adminProcedure
    .route({
      method: "GET",
      path: "/admin/offers",
      tags: ["Admin Offers"],
      summary: "Get all offers",
      description: "Get all offers for admin management",
    })
    .handler(async () => {
      return db
        .select()
        .from(offer)
        .orderBy(desc(offer.priority), desc(offer.createdAt));
    }),

  create: adminProcedure
    .route({
      method: "POST",
      path: "/admin/offers",
      tags: ["Admin Offers"],
      summary: "Create offer",
      description: "Create a new offer",
    })
    .input(offerInput)
    .handler(async ({ input }) => {
      try {
        const result = await db
          .insert(offer)
          .values({
            title: input.title,
            description: input.description,
            type: input.type,
            discountPercentage: input.discountPercentage,
            originalPrice: input.originalPrice,
            comboPrice: input.comboPrice,
            imageUrl: input.bannerImage,
            bannerImage: input.bannerImage,
            products: input.products,
            targetProducts: input.products,
            startDate: input.startDate,
            endDate: input.endDate,
            priority: input.priority,
            badge: input.badge,
            active: input.active,
          })
          .returning();
        return { message: "Offer created", offer: result[0] };
      } catch (error) {
        console.error("[adminOffer.create] Failed to create offer", {
          error,
          input,
        });
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message:
            error instanceof Error
              ? `Create offer failed: ${error.message}`
              : "Create offer failed",
        });
      }
    }),

  update: adminProcedure
    .route({
      method: "PUT",
      path: "/admin/offers/update",
      tags: ["Admin Offers"],
      summary: "Update offer",
      description: "Update an existing offer",
    })
    .input(
      z.object({
        id: z.number().int(),
        data: offerUpdateInput,
      }),
    )
    .handler(async ({ input }) => {
      try {
        const updateData: any = { ...input.data, updatedAt: new Date() };
        if (Object.prototype.hasOwnProperty.call(updateData, "bannerImage")) {
          updateData.imageUrl = updateData.bannerImage;
        }
        if (Object.prototype.hasOwnProperty.call(updateData, "products")) {
          updateData.targetProducts = updateData.products;
        }
        await db.update(offer).set(updateData).where(eq(offer.id, input.id));
        return { message: "Offer updated" };
      } catch (error) {
        console.error("[adminOffer.update] Failed to update offer", {
          error,
          input,
        });
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message:
            error instanceof Error
              ? `Update offer failed: ${error.message}`
              : "Update offer failed",
        });
      }
    }),

  toggleActive: adminProcedure
    .route({
      method: "PATCH",
      path: "/admin/offers/toggle-active",
      tags: ["Admin Offers"],
      summary: "Toggle offer active status",
      description: "Activate or deactivate an offer",
    })
    .input(z.object({ id: z.number().int(), active: z.boolean() }))
    .handler(async ({ input }) => {
      await db
        .update(offer)
        .set({ active: input.active, updatedAt: new Date() })
        .where(eq(offer.id, input.id));
      return {
        message: `Offer ${input.active ? "activated" : "deactivated"}`,
      };
    }),

  delete: adminProcedure
    .route({
      method: "DELETE",
      path: "/admin/offers/delete",
      tags: ["Admin Offers"],
      summary: "Delete offer",
      description: "Delete an offer",
    })
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      await db.delete(offer).where(eq(offer.id, input.id));
      return { message: "Offer deleted" };
    }),
};
