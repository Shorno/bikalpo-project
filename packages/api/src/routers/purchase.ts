import { db } from "@bikalpo-project/db";
import {
    financialLedger,
    inventoryMovement,
    journalEntry,
    journalLine,
    payment,
    purchase,
    purchaseEvent,
    purchaseItem,
    supplier,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import {
    advanceManualPurchaseRefund,
    cancelManualPurchase,
    confirmManualPurchaseReceipt,
    persistManualPurchaseDraft,
    recordManualPurchasePayment,
} from "../services/manual-purchase";
import { localDateStamp, localDateString } from "../utils/date";

/** Generate unique purchase number: PO-YYYYMMDD-NNN */
async function generatePurchaseNumber(warehouseId: string): Promise<string> {
    const today = new Date();
    const dateStr = localDateStamp(today);
    const prefix = `PO-${dateStr}-`;

    const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(purchase)
        .where(and(eq(purchase.warehouseId, warehouseId), ilike(purchase.purchaseNumber, `${prefix}%`)));

    const seq = (result?.count ?? 0) + 1;
    return `${prefix}${String(seq).padStart(3, "0")}`;
}

function manualPurchaseScope(user: { id: string; role?: string | null }) {
    if (user.role === "shop_owner") {
        return { actorId: user.id, ownerId: user.id, ownerType: "shop" as const };
    }
    if (user.role === "warehouse") {
        return {
            actorId: user.id,
            ownerId: user.id,
            ownerType: "warehouse" as const,
        };
    }
    throw new ORPCError("FORBIDDEN", {
        message: "Manual purchases require a shop or warehouse account",
    });
}

const manualPurchaseInput = z.object({
    attachmentName: z.string().max(255).optional().nullable(),
    attachmentUrl: z.string().url().max(2000).optional().nullable(),
    discount: z.number().min(0).default(0),
    entryMode: z.enum(["new", "exchange"]).default("new"),
    idempotencyKey: z.string().min(8).max(120),
    items: z.array(z.object({
        batchNo: z.string().max(100).optional().nullable(),
        exchangeQty: z.number().min(0).default(0),
        expiryDate: z.string().optional().nullable(),
        inventoryId: z.number().int().positive(),
        quantity: z.number().positive(),
        unitCost: z.number().min(0),
    })).min(1),
    note: z.string().max(2000).optional().nullable(),
    paidAmount: z.number().min(0).default(0),
    paymentAccountId: z.number().int().positive().optional().nullable(),
    paymentMethod: z.string().max(50).optional().nullable(),
    purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    supplierId: z.number().int().positive(),
    supplierInvoiceNo: z.string().max(100).optional().nullable(),
    vatAmount: z.number().min(0).default(0),
});

export const purchaseRouter = {
    advanceManualRefund: protectedProcedure
        .route({
            method: "POST",
            path: "/purchases/manual/refunds",
            tags: ["Purchase Management"],
            summary: "Advance a manual purchase refund stage",
        })
        .input(z.object({
            action: z.enum(["request", "verify", "approve", "process", "complete"]),
            amount: z.number().positive().optional(),
            idempotencyKey: z.string().min(8).max(120).optional(),
            paymentAccountId: z.number().int().positive().optional(),
            paymentId: z.number().int().positive(),
            reason: z.string().max(500).optional().nullable(),
            referenceNo: z.string().max(180).optional().nullable(),
        }))
        .handler(async ({ context, input }) => {
            const scope = manualPurchaseScope(context.session.user);
            try {
                const result = await db.transaction((tx) =>
                    advanceManualPurchaseRefund(tx, scope, input),
                );
                return { ...result, success: true };
            } catch (error) {
                throw new ORPCError("BAD_REQUEST", {
                    message:
                        error instanceof Error ? error.message : "Refund failed",
                });
            }
        }),

    cancelManual: protectedProcedure
        .route({
            method: "POST",
            path: "/purchases/manual/cancel",
            tags: ["Purchase Management"],
            summary: "Cancel a manual purchase and reverse connected records",
        })
        .input(z.object({
            purchaseId: z.number().int().positive(),
            reason: z.string().max(500).optional().nullable(),
        }))
        .handler(async ({ context, input }) => {
            const scope = manualPurchaseScope(context.session.user);
            try {
                const purchaseRecord = await db.transaction((tx) =>
                    cancelManualPurchase(tx, scope, input),
                );
                return { purchase: purchaseRecord, success: true };
            } catch (error) {
                throw new ORPCError("BAD_REQUEST", {
                    message:
                        error instanceof Error
                            ? error.message
                            : "Purchase cancellation failed",
                });
            }
        }),

    listManual: protectedProcedure
        .route({
            method: "POST",
            path: "/purchases/manual",
            tags: ["Purchase Management"],
            summary: "List manual purchase history",
        })
        .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }))
        .handler(async ({ context, input }) => {
            const scope = manualPurchaseScope(context.session.user);
            return db.query.purchase.findMany({
                where: and(
                    eq(purchase.warehouseId, scope.ownerId),
                    eq(purchase.ownerType, scope.ownerType),
                ),
                orderBy: [desc(purchase.createdAt)],
                limit: input.limit,
                with: { items: true, supplier: true },
            });
        }),

    getManualDetail: protectedProcedure
        .route({
            method: "POST",
            path: "/purchases/manual/detail",
            tags: ["Purchase Management"],
            summary: "Get separate manual purchase histories",
        })
        .input(z.object({ purchaseId: z.number().int().positive() }))
        .handler(async ({ context, input }) => {
            const scope = manualPurchaseScope(context.session.user);
            const purchaseRecord = await db.query.purchase.findFirst({
                where: and(
                    eq(purchase.id, input.purchaseId),
                    eq(purchase.warehouseId, scope.ownerId),
                    eq(purchase.ownerType, scope.ownerType),
                ),
                with: {
                    items: { with: { variant: true } },
                    paymentAccount: true,
                    supplier: true,
                },
            });
            if (!purchaseRecord) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Manual purchase was not found",
                });
            }

            const [paymentHistory, purchaseHistory, inventoryHistory] =
                await Promise.all([
                    db.query.payment.findMany({
                        where: eq(payment.purchaseId, input.purchaseId),
                        orderBy: [desc(payment.createdAt)],
                        with: { paymentAccount: true },
                    }),
                    db.query.purchaseEvent.findMany({
                        where: and(
                            eq(purchaseEvent.purchaseId, input.purchaseId),
                            eq(purchaseEvent.ownerId, scope.ownerId),
                        ),
                        orderBy: [desc(purchaseEvent.occurredAt)],
                    }),
                    db.query.inventoryMovement.findMany({
                        where: and(
                            eq(inventoryMovement.purchaseId, input.purchaseId),
                            eq(inventoryMovement.ownerId, scope.ownerId),
                        ),
                        orderBy: [desc(inventoryMovement.occurredAt)],
                        with: { variant: true },
                    }),
                ]);
            const paymentIds = paymentHistory.map((row) => String(row.id));
            const accountingEntries = await db.query.journalEntry.findMany({
                where: and(
                    eq(journalEntry.ownerId, scope.ownerId),
                    eq(journalEntry.ownerType, scope.ownerType),
                    or(
                        and(
                            eq(journalEntry.sourceType, "purchase"),
                            eq(journalEntry.sourceId, String(input.purchaseId)),
                        ),
                        paymentIds.length
                            ? and(
                                eq(journalEntry.sourceType, "payment"),
                                inArray(journalEntry.sourceId, paymentIds),
                            )
                            : undefined,
                    ),
                ),
                orderBy: [desc(journalEntry.postedAt)],
            });
            const entryIds = accountingEntries.map((row) => row.id);
            const accountingLines = entryIds.length
                ? await db.query.journalLine.findMany({
                    where: inArray(journalLine.journalEntryId, entryIds),
                    orderBy: [journalLine.lineOrder],
                })
                : [];
            const accountingHistory = accountingEntries.map((entry) => ({
                ...entry,
                lines: accountingLines.filter(
                    (line) => line.journalEntryId === entry.id,
                ),
            }));

            return {
                accountingHistory,
                inventoryHistory,
                paymentHistory,
                purchase: purchaseRecord,
                purchaseHistory,
            };
        }),

    saveManualDraft: protectedProcedure
        .route({
            method: "POST",
            path: "/purchases/manual/draft",
            tags: ["Purchase Management"],
            summary: "Save and verify a manual purchase draft",
        })
        .input(manualPurchaseInput)
        .handler(async ({ context, input }) => {
            const scope = manualPurchaseScope(context.session.user);
            const result = await db.transaction((tx) =>
                persistManualPurchaseDraft(tx, scope, input),
            );
            return {
                purchase: result.purchase,
                verificationStatus: result.purchase.verificationStatus,
            };
        }),

    confirmManual: protectedProcedure
        .route({
            method: "POST",
            path: "/purchases/manual/confirm",
            tags: ["Purchase Management"],
            summary: "Confirm a verified manual purchase and add stock",
        })
        .input(manualPurchaseInput)
        .handler(async ({ context, input }) => {
            const scope = manualPurchaseScope(context.session.user);
            try {
                return await db.transaction(async (tx) => {
                    const draft = await persistManualPurchaseDraft(tx, scope, input);
                    if (draft.purchase.verificationStatus !== "verified") {
                        return {
                            confirmed: false,
                            purchase: draft.purchase,
                            verificationStatus: draft.purchase.verificationStatus,
                        };
                    }
                    const received = await confirmManualPurchaseReceipt(
                        tx,
                        scope,
                        draft.purchase.id,
                    );
                    if (input.paidAmount > 0) {
                        if (!input.paymentAccountId || !input.paymentMethod) {
                            throw new Error(
                                "Select a payment method and cash or bank account",
                            );
                        }
                        await recordManualPurchasePayment(tx, scope, {
                            amount: input.paidAmount,
                            idempotencyKey: `${input.idempotencyKey}:initial-payment`,
                            paymentAccountId: input.paymentAccountId,
                            paymentMethod: input.paymentMethod,
                            purchaseId: received.id,
                            referenceNo: input.supplierInvoiceNo,
                        });
                    }
                    const complete = await tx.query.purchase.findFirst({
                        where: eq(purchase.id, received.id),
                        with: { items: true, supplier: true },
                    });
                    return {
                        confirmed: true,
                        purchase: complete!,
                        verificationStatus: "verified" as const,
                    };
                });
            } catch (error) {
                if (error instanceof ORPCError) throw error;
                throw new ORPCError("BAD_REQUEST", {
                    message:
                        error instanceof Error
                            ? error.message
                            : "Manual purchase confirmation failed",
                });
            }
        }),

    addManualPayment: protectedProcedure
        .route({
            method: "POST",
            path: "/purchases/manual/payments",
            tags: ["Purchase Management"],
            summary: "Add an advance or due payment to a manual purchase",
        })
        .input(z.object({
            amount: z.number().positive(),
            idempotencyKey: z.string().min(8).max(120),
            paymentAccountId: z.number().int().positive(),
            paymentMethod: z.string().min(1).max(50),
            purchaseId: z.number().int().positive(),
            referenceNo: z.string().max(180).optional().nullable(),
            transactionId: z.string().max(255).optional().nullable(),
        }))
        .handler(async ({ context, input }) => {
            const scope = manualPurchaseScope(context.session.user);
            try {
                const paymentRecord = await db.transaction((tx) =>
                    recordManualPurchasePayment(tx, scope, input),
                );
                return { payment: paymentRecord, success: true };
            } catch (error) {
                throw new ORPCError("BAD_REQUEST", {
                    message:
                        error instanceof Error ? error.message : "Payment failed",
                });
            }
        }),

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
                    purchaseDate: input.purchaseDate || localDateString(),
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
            const { product } = await import("@bikalpo-project/db/schema");
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
