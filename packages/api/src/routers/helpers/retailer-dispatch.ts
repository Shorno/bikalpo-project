import { db } from "@bikalpo-project/db";
import { invoice, invoiceItem, order, user } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import {
    applyFulfillmentMode,
    calculateDispatchInvoiceSnapshot,
    type DispatchFulfillmentMode,
} from "./order-dispatch";
import {
    persistedInvoiceFulfillmentMode,
    type FulfillmentOwner,
} from "./fulfillment-owner";
import { getRetailerOrderTransition } from "./retailer-consumer-flow";

function money(value: number) {
    return (Math.round(Math.max(0, value) * 100) / 100).toFixed(2);
}

/**
 * Creates the retailer's one full invoice and selects its fulfillment mode.
 * This intentionally shares the dispatch pricing/mode seam with warehouse
 * dispatch while keeping retailer ownership and full-invoice rules local.
 */
export async function createRetailerDispatchInvoiceForOrder(input: {
    shopId: string;
    orderId: number;
    fulfillmentMode?: DispatchFulfillmentMode;
}) {
    const fulfillmentMode = input.fulfillmentMode ?? "delivery";
    const owner: FulfillmentOwner = { kind: "shop", id: input.shopId };

    return db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.orderId})`);

        const existingOrder = await tx.query.order.findFirst({
            where: and(
                eq(order.id, input.orderId),
                eq(order.shopId, input.shopId),
                eq(order.orderType, "b2c"),
            ),
            with: { items: true },
        });
        if (!existingOrder) {
            throw new ORPCError("NOT_FOUND", {
                message: "Order not found or not owned by your shop",
            });
        }

        const existingInvoice = await tx.query.invoice.findFirst({
            where: and(
                eq(invoice.orderId, existingOrder.id),
                eq(invoice.invoiceType, "main"),
            ),
            orderBy: [desc(invoice.createdAt)],
        });
        if (existingInvoice) {
            const requestedMode = persistedInvoiceFulfillmentMode(
                owner,
                fulfillmentMode,
            );
            if (
                existingInvoice.fulfillmentMode &&
                existingInvoice.fulfillmentMode !== requestedMode
            ) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "Fulfillment mode has already been selected",
                });
            }
            return {
                success: true,
                status: "invoiced" as const,
                invoice: existingInvoice,
                completionOtp: null,
            };
        }

        if (fulfillmentMode === "self_pickup") {
            const shop = await tx.query.user.findFirst({
                where: eq(user.id, input.shopId),
                columns: { shopAddress: true },
            });
            if (!shop?.shopAddress?.trim()) {
                throw new ORPCError("BAD_REQUEST", {
                    message:
                        "Add a shop address before offering self pickup to consumers",
                });
            }
        }

        const transition = getRetailerOrderTransition(
            existingOrder.status,
            "create_invoice",
        );
        if (!transition) {
            throw new ORPCError("BAD_REQUEST", {
                message: "Confirm the order before creating its invoice",
            });
        }
        if (existingOrder.items.length === 0) {
            throw new ORPCError("BAD_REQUEST", {
                message: "Cannot invoice an order without items",
            });
        }

        const deliveryFee = Number(existingOrder.deliveryFee);
        let shippingFee = Number(existingOrder.shippingFee);
        if (deliveryFee === 0 && shippingFee === 0) {
            shippingFee = Number(existingOrder.shippingCost);
        }
        const invoiceSnapshot = calculateDispatchInvoiceSnapshot({
            subtotal: Number(existingOrder.subtotal),
            approvedSubtotal: Number(existingOrder.subtotal),
            fullyInvoiced: true,
            hasExistingInvoices: false,
            fulfillmentMode,
            orderTotals: {
                discount: Number(existingOrder.discount),
                productDiscount: Number(existingOrder.productDiscount),
                couponDiscount: Number(existingOrder.couponDiscount),
                rewardDiscount: Number(existingOrder.rewardDiscount),
                taxAmount: Number(existingOrder.taxAmount),
                deliveryFee,
                shippingFee,
                paidAmount: Number(existingOrder.paidAmount),
                returnAmount: Number(existingOrder.returnAmount),
            },
            allocated: {
                discount: 0,
                productDiscount: 0,
                couponDiscount: 0,
                rewardDiscount: 0,
                taxAmount: 0,
                paidAmount: 0,
                returnAmount: 0,
            },
        });
        const persistedMode = persistedInvoiceFulfillmentMode(
            owner,
            fulfillmentMode,
        );

        const [createdInvoice] = await tx
            .insert(invoice)
            .values({
                invoiceNumber: `INV-${existingOrder.orderNumber}`,
                orderId: existingOrder.id,
                customerId: existingOrder.userId,
                invoiceType: "main",
                paymentStatus:
                    invoiceSnapshot.dueAmount <= 0 ? "collected" : "unpaid",
                deliveryStatus: "not_assigned",
                fulfillmentMode: persistedMode,
                subtotal: money(Number(existingOrder.subtotal)),
                discountAmount: money(invoiceSnapshot.discountAmount),
                productDiscount: money(invoiceSnapshot.productDiscount),
                couponDiscount: money(invoiceSnapshot.couponDiscount),
                rewardDiscount: money(invoiceSnapshot.rewardDiscount),
                deliveryCharge: money(invoiceSnapshot.deliveryCharge),
                shippingCharge: money(invoiceSnapshot.shippingCharge),
                taxAmount: money(invoiceSnapshot.taxAmount),
                grandTotal: money(invoiceSnapshot.grandTotal),
                paidAmount: money(invoiceSnapshot.paidAmount),
                dueAmount: money(invoiceSnapshot.dueAmount),
                returnAmount: money(invoiceSnapshot.returnAmount),
                promotionCode: existingOrder.promotionCode,
                paymentPlan: existingOrder.paymentPlan,
                paymentDueAt: existingOrder.paymentDueAt,
                billedName:
                    existingOrder.invoiceName ?? existingOrder.shippingName,
                billedPhone:
                    existingOrder.invoicePhone ?? existingOrder.shippingPhone,
                billedEmail:
                    existingOrder.invoiceEmail ?? existingOrder.shippingEmail,
                customerNotes: existingOrder.customerNote,
            })
            .returning();
        if (!createdInvoice) {
            throw new ORPCError("INTERNAL_SERVER_ERROR", {
                message: "Failed to create invoice",
            });
        }

        await tx.insert(invoiceItem).values(
            existingOrder.items.map((item) => ({
                invoiceId: createdInvoice.id,
                orderItemId: item.id,
                productId: item.productId,
                variantId: item.variantId,
                productName: item.productName,
                productSku: item.productSize,
                productImage: item.productImage,
                quantity: item.quantity,
                quantityUnit: item.quantityUnit,
                inventoryUnit: item.inventoryUnit,
                conversionFactor: item.conversionFactor,
                inventoryQty: item.inventoryQty,
                unitPrice: item.unitPrice,
                lineTotal: item.totalPrice,
            })),
        );

        const orderTotals =
            fulfillmentMode === "self_pickup"
                ? {
                      shippingCost: "0.00",
                      deliveryFee: "0.00",
                      shippingFee: "0.00",
                      total: money(invoiceSnapshot.grandTotal),
                      dueAmount: money(invoiceSnapshot.dueAmount),
                  }
                : {};
        await tx
            .update(order)
            .set({
                status: transition.nextStatus,
                readyAt: existingOrder.readyAt ?? new Date(),
                ...orderTotals,
            })
            .where(
                and(
                    eq(order.id, existingOrder.id),
                    eq(order.status, existingOrder.status),
                ),
            );

        const fulfillment = await applyFulfillmentMode(tx, {
            invoiceId: createdInvoice.id,
            orderId: existingOrder.id,
            orderReadyAt: existingOrder.readyAt,
            fulfillmentMode,
            persistedMode,
        });

        return {
            success: true,
            status: "invoiced" as const,
            invoice: createdInvoice,
            completionOtp: fulfillment.completionOtp,
        };
    });
}
