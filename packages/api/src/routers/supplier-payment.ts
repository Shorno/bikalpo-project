import { db } from "@bikalpo-project/db";
import { supplier, financialLedger } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { shopOrWarehouseOwnerScope } from "../shop-portal-scope";

export const supplierPaymentRouter = {
    /** Pay a supplier — reduces currentPayable + creates ledger entry */
    paySupplier: protectedProcedure
        .route({
            method: "POST",
            path: "/supplier-payments/pay",
            tags: ["Supplier Payments"],
            summary: "Pay supplier",
            description: "Make a payment to a supplier. Reduces outstanding payable.",
        })
        .input(
            z.object({
                supplierId: z.number().int(),
                amount: z.string().min(1),
                paymentMethod: z.enum(["cash", "bank", "mobile_banking"]),
                referenceNo: z.string().max(100).optional().nullable(),
                note: z.string().optional().nullable(),
                ownerType: z.enum(["warehouse", "shop", "restaurant"]),
            }),
        )
        .handler(async ({ context, input }) => {
            const amount = parseFloat(input.amount);
            if (isNaN(amount) || amount <= 0) {
                throw new ORPCError("BAD_REQUEST", { message: "Amount must be greater than 0" });
            }

            const { ownerId } = shopOrWarehouseOwnerScope(
                context.session.user,
                "purchase",
            );

            // Verify supplier exists and belongs to this shop or warehouse
            const sup = await db.query.supplier.findFirst({
                where: and(
                    eq(supplier.id, input.supplierId),
                    eq(supplier.addedBy, ownerId),
                ),
            });
            if (!sup) throw new ORPCError("NOT_FOUND", { message: "Supplier not found" });

            const currentPayable = parseFloat(sup.currentPayable);
            if (amount > currentPayable) {
                throw new ORPCError("BAD_REQUEST", {
                    message: `Payment amount (৳${amount}) exceeds outstanding payable (৳${currentPayable})`,
                });
            }

            // Reduce supplier payable
            const newPayable = (currentPayable - amount).toFixed(2);
            await db
                .update(supplier)
                .set({ currentPayable: newPayable, updatedAt: new Date() })
                .where(eq(supplier.id, input.supplierId));

            // Create ledger entry (debit = cash going out to pay supplier)
            await db.insert(financialLedger).values({
                entryType: "supplier_payment",
                amount: input.amount,
                direction: "debit",
                referenceType: "supplier_payment",
                referenceId: input.supplierId,
                description: `Supplier payment: ${sup.name} — ৳${amount} (${input.paymentMethod})`,
                ownerId,
                ownerType: input.ownerType,
            });

            return {
                message: `Payment of ৳${amount} to ${sup.name} recorded. New payable: ৳${newPayable}`,
                newPayable,
            };
        }),

    /** Get payment history for a supplier (from ledger) */
    getSupplierLedger: protectedProcedure
        .route({
            method: "POST",
            path: "/supplier-payments/ledger",
            tags: ["Supplier Payments"],
            summary: "Supplier payment ledger",
        })
        .input(z.object({ supplierId: z.number().int() }))
        .handler(async ({ context, input }) => {
            return db.query.financialLedger.findMany({
                where: and(
                    eq(financialLedger.ownerId, shopOrWarehouseOwnerScope(context.session.user, "purchase").ownerId),
                    eq(financialLedger.referenceType, "supplier_payment"),
                    eq(financialLedger.referenceId, input.supplierId),
                ),
                orderBy: [desc(financialLedger.createdAt)],
            });
        }),

    /** Get total outstanding payables across all suppliers */
    getPayableSummary: protectedProcedure
        .route({
            method: "POST",
            path: "/supplier-payments/summary",
            tags: ["Supplier Payments"],
            summary: "Payable summary",
        })
        .handler(async ({ context }) => {
            const suppliers = await db.query.supplier.findMany({
                where: and(
                    eq(supplier.addedBy, shopOrWarehouseOwnerScope(context.session.user, "purchase").ownerId),
                    eq(supplier.isActive, true),
                    gt(supplier.currentPayable, "0"),
                ),
                columns: {
                    id: true,
                    name: true,
                    currentPayable: true,
                    creditLimit: true,
                },
                orderBy: [desc(supplier.currentPayable)],
            });

            const totalPayable = suppliers.reduce(
                (sum, s) => sum + parseFloat(s.currentPayable),
                0,
            );

            return {
                suppliers,
                totalPayable: totalPayable.toFixed(2),
                supplierCount: suppliers.length,
            };
        }),
};
