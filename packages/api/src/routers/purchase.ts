import { db } from "@bikalpo-project/db";
import { purchase, purchaseItem, supplier, financialLedger } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

/** Generate unique purchase number: PO-YYYYMMDD-NNN */
async function generatePurchaseNumber(warehouseId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const prefix = `PO-${dateStr}-`;

    const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(purchase)
        .where(and(eq(purchase.warehouseId, warehouseId), ilike(purchase.purchaseNumber, `${prefix}%`)));

    const seq = (result?.count ?? 0) + 1;
    return `${prefix}${String(seq).padStart(3, "0")}`;
}

export const purchaseRouter = {
    /** Create a purchase with line items */
    create: protectedProcedure
        .route({ method: "POST", path: "/purchases/create", tags: ["Purchase Management"], summary: "Create purchase" })
        .input(
            z.object({
                supplierId: z.number().int(),
                purchaseDate: z.string().optional(),
                supplierInvoiceNo: z.string().max(100).optional(),
                paymentType: z.enum(["cash", "credit"]),
                transportCost: z.string().optional(),
                discount: z.string().optional(),
                note: z.string().optional(),
                items: z.array(
                    z.object({
                        productName: z.string().min(1),
                        variantId: z.number().int().optional().nullable(),
                        quantity: z.string().min(1),
                        unitCost: z.string().min(1),
                    }),
                ).min(1, "At least one item is required"),
            }),
        )
        .handler(async ({ context, input }) => {
            const ownerId = context.session.user.id;

            // Verify supplier belongs to this user
            const sup = await db.query.supplier.findFirst({
                where: and(eq(supplier.id, input.supplierId), eq(supplier.addedBy, ownerId)),
            });
            if (!sup) throw new ORPCError("NOT_FOUND", { message: "Supplier not found" });

            // Calculate totals
            let subtotal = 0;
            const parsedItems = input.items.map((item) => {
                const qty = parseFloat(item.quantity);
                const cost = parseFloat(item.unitCost);
                const totalCost = qty * cost;
                subtotal += totalCost;
                return { ...item, quantity: String(qty), unitCost: String(cost), totalCost: String(totalCost) };
            });

            const discount = parseFloat(input.discount || "0");
            const transportCost = parseFloat(input.transportCost || "0");
            const total = subtotal - discount + transportCost;

            const purchaseNumber = await generatePurchaseNumber(ownerId);

            // Insert purchase
            const [created] = await db
                .insert(purchase)
                .values({
                    purchaseNumber,
                    supplierId: input.supplierId,
                    warehouseId: ownerId,
                    supplierInvoiceNo: input.supplierInvoiceNo || null,
                    purchaseDate: input.purchaseDate || new Date().toISOString().slice(0, 10),
                    subtotal: String(subtotal),
                    discount: String(discount),
                    total: String(total),
                    transportCost: String(transportCost),
                    paymentType: input.paymentType,
                    status: "received",
                    note: input.note || null,
                    receivedAt: new Date(),
                })
                .returning();

            // Insert line items
            await db.insert(purchaseItem).values(
                parsedItems.map((item) => ({
                    purchaseId: created!.id,
                    variantId: item.variantId || null,
                    productName: item.productName,
                    quantity: item.quantity,
                    unitCost: item.unitCost,
                    totalCost: item.totalCost,
                    receivedQty: item.quantity,
                })),
            );

            // If credit purchase, increase supplier's currentPayable
            if (input.paymentType === "credit") {
                await db
                    .update(supplier)
                    .set({
                        currentPayable: sql`${supplier.currentPayable}::numeric + ${total}`,
                    })
                    .where(eq(supplier.id, input.supplierId));
            }

            // Create financial ledger entry
            await db.insert(financialLedger).values({
                entryType: input.paymentType === "credit" ? "purchase_credit" : "purchase_cash",
                amount: String(total),
                direction: "debit",
                referenceType: "purchase",
                referenceId: created!.id,
                description: `Purchase from ${sup.name} (${purchaseNumber}) — ${input.paymentType}`,
                ownerId,
                ownerType: "warehouse",
            });

            return { purchase: created, message: `Purchase ${purchaseNumber} created (${input.paymentType})` };
        }),

    /** List purchases */
    list: protectedProcedure
        .route({ method: "POST", path: "/purchases/list", tags: ["Purchase Management"], summary: "List purchases" })
        .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional())
        .handler(async ({ context, input }) => {
            return db.query.purchase.findMany({
                where: eq(purchase.warehouseId, context.session.user.id),
                orderBy: [desc(purchase.createdAt)],
                limit: input?.limit ?? 50,
                with: {
                    supplier: { columns: { name: true } },
                    items: { columns: { productName: true, quantity: true, unitCost: true, totalCost: true } },
                },
            });
        }),

    /** List suppliers for dropdown */
    getSuppliers: protectedProcedure
        .route({ method: "POST", path: "/purchases/suppliers", tags: ["Purchase Management"], summary: "Get suppliers for purchase" })
        .input(z.object({}).optional())
        .handler(async ({ context }) => {
            return db.query.supplier.findMany({
                where: and(eq(supplier.addedBy, context.session.user.id), eq(supplier.status, "active")),
                orderBy: [desc(supplier.createdAt)],
                columns: { id: true, name: true, company: true, phone: true, creditLimit: true, currentPayable: true },
            });
        }),

    /** Get products from admin catalog with variants for purchase dropdown */
    getProducts: protectedProcedure
        .route({ method: "POST", path: "/purchases/products", tags: ["Purchase Management"], summary: "Get products for purchase" })
        .input(z.object({ search: z.string().optional() }).optional())
        .handler(async ({ input }) => {
            const { product, productVariant } = await import("@bikalpo-project/db/schema");
            const conditions = [eq(product.status, "active")];
            if (input?.search?.trim()) {
                conditions.push(ilike(product.name, `%${input.search.trim()}%`));
            }
            return db.query.product.findMany({
                where: and(...conditions),
                orderBy: [desc(product.createdAt)],
                limit: 50,
                columns: { id: true, name: true },
                with: {
                    variants: {
                        columns: { id: true, sku: true, unitLabel: true, weightKg: true, price: true, packagingType: true },
                    },
                },
            });
        }),
};
