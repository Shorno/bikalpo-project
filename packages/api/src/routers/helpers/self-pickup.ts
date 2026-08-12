import { db } from "@bikalpo-project/db";
import { invoice, order } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, sql } from "drizzle-orm";
import {
    fulfillmentInvoiceOwnerCondition,
    type FulfillmentOwner,
} from "./fulfillment-owner";
import { syncOrderFromDeliveredInvoice } from "./invoice-fulfillment";
import {
    type RetailerCylinderHandoffInput,
    settleRetailerCylinderHandoff,
} from "./retailer-cylinder-handoff";

type SelfPickupPaymentStatus = "collected" | "settled";

/**
 * Completes a self-pickup invoice after the owner verifies the consumer's
 * four-digit code. This is the single owner-scoped seam used by warehouse and
 * retailer routers.
 */
export async function completeSelfPickupInvoice(input: {
    owner: FulfillmentOwner;
    invoiceId: number;
    otp: string;
    paymentStatus: SelfPickupPaymentStatus;
    markOrderPaid: boolean;
} & RetailerCylinderHandoffInput) {
    return db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.invoiceId})`);

        const existingInvoice = await tx.query.invoice.findFirst({
            where: and(
                eq(invoice.id, input.invoiceId),
                fulfillmentInvoiceOwnerCondition(input.owner),
            ),
            with: { order: true },
        });

        if (!existingInvoice?.order) {
            throw new ORPCError("NOT_FOUND", { message: "Invoice not found" });
        }
        if (existingInvoice.fulfillmentMode !== "self_pickup") {
            throw new ORPCError("BAD_REQUEST", {
                message: "This invoice is not in self pickup mode",
            });
        }
        if (
            existingInvoice.deliveryStatus === "delivered" ||
            existingInvoice.completionOtpVerifiedAt
        ) {
            throw new ORPCError("BAD_REQUEST", {
                message: "Self pickup has already been completed",
            });
        }
        if (!existingInvoice.completionOtp) {
            throw new ORPCError("BAD_REQUEST", {
                message: "Pickup OTP is not available for this invoice",
            });
        }
        if (existingInvoice.completionOtp !== input.otp) {
            throw new ORPCError("BAD_REQUEST", {
                message: "Invalid pickup OTP",
            });
        }

        const cylinderSettlement =
            input.owner.kind === "shop"
                ? await settleRetailerCylinderHandoff(tx, {
                      shopId: input.owner.id,
                      invoiceId: input.invoiceId,
                      actorId: input.owner.id,
                      acceptedReturns: input.acceptedReturns,
                      handoffBalancePaid: input.handoffBalancePaid,
                      handoffPaymentMethod: input.handoffPaymentMethod,
                      handoffPaymentReference: input.handoffPaymentReference,
                  })
                : null;

        const completedAt = new Date();
        const [completedInvoice] = await tx
            .update(invoice)
            .set({
                deliveryStatus: "delivered",
                paymentStatus: input.paymentStatus,
                deliveredAt: completedAt,
                settledAt:
                    input.paymentStatus === "settled" ? completedAt : null,
                completionOtpVerifiedAt: completedAt,
            })
            .where(
                and(
                    eq(invoice.id, input.invoiceId),
                    eq(invoice.deliveryStatus, "pending"),
                ),
            )
            .returning({ id: invoice.id });

        if (!completedInvoice) {
            throw new ORPCError("BAD_REQUEST", {
                message: "Self pickup was already processed",
            });
        }

        const sync = await syncOrderFromDeliveredInvoice(tx, input.invoiceId, {
            markReceived: true,
        });

        if (input.markOrderPaid) {
            await tx
                .update(order)
                .set({ paymentStatus: "paid" })
                .where(eq(order.id, existingInvoice.order.id));
        }

        return {
            success: true,
            orderId: existingInvoice.order.id,
            fullyDelivered: sync.fullyDelivered,
            cylinderSettlement,
            message: "Self pickup completed successfully",
        };
    });
}
