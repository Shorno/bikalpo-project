import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@bikalpo-project/db";
import {
    marketingMaterial,
    marketingMaterialRequest,
} from "@bikalpo-project/db/schema";

import { protectedProcedure } from "../index";

// ── Helpers ─────────────────────────────────────────────────────────
async function generateRequestNumber(): Promise<string> {
    const result = await db
        .select({ cnt: count() })
        .from(marketingMaterialRequest);
    const next = (result[0]?.cnt ?? 0) + 1;
    return `MR-${String(next).padStart(3, "0")}`;
}

// ── Router ──────────────────────────────────────────────────────────
export const marketingRouter = {
    /** List active materials for sellers to browse */
    listMaterials: protectedProcedure
        .input(
            z
                .object({
                    category: z
                        .enum([
                            "shop_branding",
                            "warehouse_branding",
                            "product_promotion",
                            "campaign",
                        ])
                        .optional(),
                    type: z
                        .enum(["banner", "sticker", "leaflet", "poster", "standee", "qr_sticker"])
                        .optional(),
                })
                .optional(),
        )
        .handler(async ({ input }) => {
            const conditions = [eq(marketingMaterial.status, "active")];
            if (input?.category)
                conditions.push(eq(marketingMaterial.category, input.category));
            if (input?.type) conditions.push(eq(marketingMaterial.type, input.type));

            const materials = await db.query.marketingMaterial.findMany({
                where: and(...conditions),
                orderBy: [desc(marketingMaterial.createdAt)],
            });
            return { materials };
        }),

    /** Get single material detail */
    getMaterial: protectedProcedure
        .input(z.object({ id: z.string() }))
        .handler(async ({ input }) => {
            const material = await db.query.marketingMaterial.findFirst({
                where: and(
                    eq(marketingMaterial.id, input.id),
                    eq(marketingMaterial.status, "active"),
                ),
            });
            return material ?? null;
        }),

    /** Submit a material request */
    submitRequest: protectedProcedure
        .input(
            z.object({
                materialId: z.string(),
                quantity: z.number().int().min(1),
                deliveryType: z
                    .enum(["courier", "warehouse_pickup", "sales_delivery"])
                    .default("courier"),
                paymentType: z.enum(["free", "subsidized", "paid"]).default("free"),
                paymentAmount: z.number().int().min(0).default(0),
                deliveryAddress: z.string().optional(),
                deliveryContact: z.string().optional(),
            }),
        )
        .handler(async ({ input, context }) => {
            // Verify the material exists and is active
            const material = await db.query.marketingMaterial.findFirst({
                where: and(
                    eq(marketingMaterial.id, input.materialId),
                    eq(marketingMaterial.status, "active"),
                ),
            });
            if (!material) throw new Error("Material not found or not available");

            const requestNumber = await generateRequestNumber();

            // Determine user type from role
            const role = context.session.user.role;
            let userType = "retailer";
            if (role === "warehouse") userType = "warehouse";
            else if (role === "shop_owner") {
                // For shop owners we default to retailer; could be wholesaler based on business type
                userType = "retailer";
            }

            const [created] = await db
                .insert(marketingMaterialRequest)
                .values({
                    requestNumber,
                    materialId: input.materialId,
                    requestedByUserId: context.session.user.id,
                    userType,
                    quantity: input.quantity,
                    deliveryType: input.deliveryType,
                    paymentType: input.paymentType,
                    paymentAmount: input.paymentAmount,
                    deliveryAddress: input.deliveryAddress,
                    deliveryContact: input.deliveryContact,
                    status: "pending",
                })
                .returning();

            return created;
        }),

    /** List current user's requests */
    myRequests: protectedProcedure
        .input(
            z
                .object({
                    status: z.string().optional(),
                })
                .optional(),
        )
        .handler(async ({ input, context }) => {
            const conditions = [
                eq(
                    marketingMaterialRequest.requestedByUserId,
                    context.session.user.id,
                ),
            ];
            if (input?.status)
                conditions.push(eq(marketingMaterialRequest.status, input.status));

            const requests = await db.query.marketingMaterialRequest.findMany({
                where: and(...conditions),
                with: { material: true },
                orderBy: [desc(marketingMaterialRequest.createdAt)],
            });
            return { requests };
        }),

    /** Get single request detail */
    getRequest: protectedProcedure
        .input(z.object({ id: z.string() }))
        .handler(async ({ input, context }) => {
            const request = await db.query.marketingMaterialRequest.findFirst({
                where: and(
                    eq(marketingMaterialRequest.id, input.id),
                    eq(
                        marketingMaterialRequest.requestedByUserId,
                        context.session.user.id,
                    ),
                ),
                with: { material: true },
            });
            return request ?? null;
        }),
};
