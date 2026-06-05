import { invoice, order, orderItem } from "@bikalpo-project/db/schema";
import { eq } from "drizzle-orm";
import { convertB2bOrderToRetailInventory } from "./b2b-conversion";

type Executor = any;

type SyncOptions = {
    markReceived?: boolean;
};

/**
 * Sync invoice completion back into order items/status so split invoices,
 * self pickup, and internal delivery all update the parent order consistently.
 */
export async function syncOrderFromDeliveredInvoice(
    tx: Executor,
    invoiceId: number,
    options: SyncOptions = {},
) {
    const deliveredInvoice = await tx.query.invoice.findFirst({
        where: eq(invoice.id, invoiceId),
        with: {
            items: true,
            order: true,
        },
    });

    if (!deliveredInvoice?.order) {
        throw new Error("Invoice or parent order not found");
    }

    const orderItems = await tx.query.orderItem.findMany({
        where: eq(orderItem.orderId, deliveredInvoice.orderId),
    });

    for (const deliveredItem of deliveredInvoice.items) {
        const sameProductItems = orderItems.filter(
            (item: typeof orderItem.$inferSelect) =>
                item.productId === deliveredItem.productId,
        );

        const matchedItem =
            sameProductItems.find(
                (item: typeof orderItem.$inferSelect) =>
                    item.productSize === deliveredItem.productSku,
            )
            ?? sameProductItems[0];

        if (!matchedItem) continue;

        const targetQty = matchedItem.modifiedQty ?? matchedItem.quantity;
        const deliveredSoFar = matchedItem.deliveredQty ?? 0;
        const nextDeliveredQty = Math.min(
            targetQty,
            deliveredSoFar + deliveredItem.quantity,
        );

        await tx
            .update(orderItem)
            .set({ deliveredQty: nextDeliveredQty })
            .where(eq(orderItem.id, matchedItem.id));

        matchedItem.deliveredQty = nextDeliveredQty;
    }

    const refreshedItems = await tx.query.orderItem.findMany({
        where: eq(orderItem.orderId, deliveredInvoice.orderId),
    });

    const anyDelivered = refreshedItems.some(
        (item: typeof orderItem.$inferSelect) => (item.deliveredQty ?? 0) > 0,
    );
    const fullyDelivered = refreshedItems.every(
        (item: typeof orderItem.$inferSelect) =>
            (item.deliveredQty ?? 0) >= (item.modifiedQty ?? item.quantity),
    );

    const nextOrderState: Partial<typeof order.$inferInsert> = {};

    if (anyDelivered) {
        nextOrderState.status = fullyDelivered ? "delivered" : "processing";
        nextOrderState.processingStartedAt =
            deliveredInvoice.order.processingStartedAt ?? new Date();
        nextOrderState.shippedAt = deliveredInvoice.order.shippedAt ?? new Date();
    }

    if (fullyDelivered) {
        nextOrderState.deliveredAt =
            deliveredInvoice.order.deliveredAt ?? new Date();
        if (options.markReceived) {
            nextOrderState.receivedAt =
                deliveredInvoice.order.receivedAt ?? new Date();
        }
    }

    if (Object.keys(nextOrderState).length > 0) {
        await tx
            .update(order)
            .set(nextOrderState)
            .where(eq(order.id, deliveredInvoice.orderId));
    }

    if (fullyDelivered) {
        try {
            await convertB2bOrderToRetailInventory(tx, deliveredInvoice.orderId);
        } catch (error) {
            console.error(
                `[INVOICE-FULFILLMENT] B2B conversion failed for order #${deliveredInvoice.orderId}:`,
                error,
            );
        }
    }

    return {
        orderId: deliveredInvoice.orderId,
        fullyDelivered,
    };
}
