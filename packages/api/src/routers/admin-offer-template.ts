import { db } from "@bikalpo-project/db";
import { offerTemplate } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure } from "../index";

const templateProductSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional(),
  catalogVariantId: z.number().int().positive().optional(),
  name: z.string().min(1),
  variantName: z.string().min(1).optional(),
  brandName: z.string().min(1).optional(),
  sku: z.string().min(1).nullable().optional(),
  category: z.string().min(1),
  regularPrice: z.string().min(1),
  quantity: z.number().int().positive(),
});

const offerTemplateSchema = z
  .object({
    code: z.string().trim().min(3).max(40).optional(),
    name: z.string().trim().min(3, "Offer name must be at least 3 characters"),
    description: z.string().trim().max(2000).optional().default(""),
    type: z.enum(["discount", "cashback", "combo"]),
    comboRule: z.enum(["buy_x_get_y", "fixed_discount"]).nullable().optional(),
    buyProducts: z.array(templateProductSchema).default([]),
    getProducts: z.array(templateProductSchema).default([]),
    benefitType: z.enum([
      "free_product",
      "percentage_discount",
      "fixed_price",
      "fixed_discount",
      "cashback_amount",
    ]),
    benefitValue: z.coerce.number().nonnegative().nullable().optional(),
    applyOn: z.enum(["product", "category", "full_store"]).default("product"),
    targetSelection: z
      .array(
        z.object({
          id: z.number().int().positive(),
          label: z.string().min(1),
          kind: z.enum(["product", "category"]),
        }),
      )
      .default([]),
    targetRetailers: z.boolean().default(true),
    targetWholesalers: z.boolean().default(true),
    applyLocations: z
      .array(
        z.enum(["all_stores", "selected_stores", "warehouse", "online_store"]),
      )
      .min(1),
    minimumOrderAmount: z.coerce.number().nonnegative().default(0),
    maxUsePerCustomer: z.coerce.number().int().positive().default(1),
    totalUsageLimit: z.coerce.number().int().positive().nullable().optional(),
    startDate: z.string().datetime().nullable().optional(),
    endDate: z.string().datetime().nullable().optional(),
    status: z.enum(["active", "draft", "disabled"]),
  })
  .superRefine((value, context) => {
    if (value.type === "combo" && value.comboRule === "buy_x_get_y") {
      if (value.buyProducts.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["buyProducts"],
          message: "Add at least one buy product",
        });
      }
      if (value.getProducts.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["getProducts"],
          message: "Add at least one get product",
        });
      }
    }
    if (
      value.benefitType !== "free_product" &&
      (value.benefitValue == null || value.benefitValue <= 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["benefitValue"],
        message: "Enter a benefit value greater than zero",
      });
    }
    if (value.startDate && value.endDate) {
      if (new Date(value.endDate) <= new Date(value.startDate)) {
        context.addIssue({
          code: "custom",
          path: ["endDate"],
          message: "End date must be after the start date",
        });
      }
    }
    if (!value.targetRetailers && !value.targetWholesalers) {
      context.addIssue({
        code: "custom",
        path: ["targetRetailers"],
        message: "Select at least one target user group",
      });
    }
  });

const toDate = (value: string | null | undefined) =>
  value ? new Date(value) : null;

const makeCode = (name: string) => {
  const label = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 18);
  return `${label || "OFFER"}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
};

const toDatabaseValues = (input: z.infer<typeof offerTemplateSchema>) => ({
  code: input.code || makeCode(input.name),
  name: input.name,
  description: input.description || null,
  type: input.type,
  comboRule: input.type === "combo" ? input.comboRule : null,
  buyProducts: input.type === "combo" ? input.buyProducts : [],
  getProducts: input.type === "combo" ? input.getProducts : [],
  benefitType: input.benefitType,
  benefitValue:
    input.benefitValue == null ? null : input.benefitValue.toFixed(2),
  applyOn: input.applyOn,
  targetSelection: input.targetSelection,
  targetRetailers: input.targetRetailers,
  targetWholesalers: input.targetWholesalers,
  applyLocations: input.applyLocations,
  minimumOrderAmount: input.minimumOrderAmount.toFixed(2),
  maxUsePerOrder: 1,
  maxUsePerCustomer: input.maxUsePerCustomer,
  totalUsageLimit: input.totalUsageLimit ?? null,
  startDate: toDate(input.startDate),
  endDate: toDate(input.endDate),
  status: input.status,
});

export const adminOfferTemplateRouter = {
  getAll: adminProcedure
    .route({
      method: "GET",
      path: "/admin/offer-templates",
      tags: ["Admin Offer Templates"],
      summary: "Get global offer structures",
      description: "List reusable offer templates created by Admin",
    })
    .handler(() =>
      db
        .select()
        .from(offerTemplate)
        .orderBy(desc(offerTemplate.updatedAt), desc(offerTemplate.createdAt)),
    ),

  create: adminProcedure
    .route({
      method: "POST",
      path: "/admin/offer-templates",
      tags: ["Admin Offer Templates"],
      summary: "Create a global offer structure",
    })
    .input(offerTemplateSchema)
    .handler(async ({ input }) => {
      try {
        const [created] = await db
          .insert(offerTemplate)
          .values(toDatabaseValues(input))
          .returning();
        return { message: "Offer template created", template: created };
      } catch (error) {
        console.error("[adminOfferTemplate.create] Failed", { error });
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message:
            error instanceof Error
              ? `Create template failed: ${error.message}`
              : "Create template failed",
        });
      }
    }),

  update: adminProcedure
    .route({
      method: "PUT",
      path: "/admin/offer-templates/{id}",
      tags: ["Admin Offer Templates"],
      summary: "Update a global offer structure",
    })
    .input(
      z.object({ id: z.number().int().positive(), data: offerTemplateSchema }),
    )
    .handler(async ({ input }) => {
      const [updated] = await db
        .update(offerTemplate)
        .set({ ...toDatabaseValues(input.data), updatedAt: new Date() })
        .where(eq(offerTemplate.id, input.id))
        .returning();
      if (!updated) {
        throw new ORPCError("NOT_FOUND", {
          message: "Offer template not found",
        });
      }
      return { message: "Offer template updated", template: updated };
    }),

  setStatus: adminProcedure
    .route({
      method: "PATCH",
      path: "/admin/offer-templates/{id}/status",
      tags: ["Admin Offer Templates"],
      summary: "Change offer template status",
    })
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["active", "draft", "disabled"]),
      }),
    )
    .handler(async ({ input }) => {
      const [updated] = await db
        .update(offerTemplate)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(offerTemplate.id, input.id))
        .returning();
      if (!updated) {
        throw new ORPCError("NOT_FOUND", {
          message: "Offer template not found",
        });
      }
      return { message: "Template status updated", template: updated };
    }),
};
