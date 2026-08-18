import { invoice, order, orderItem } from "@bikalpo-project/db/schema";
import { eq } from "drizzle-orm";
import { convertB2bOrderToRetailInventory } from "./b2b-conversion";
import { consumeB2bOrderReservations } from "./b2b-inventory-movement";
import {
    creditRetailerExchangeOrder,
    creditWarehouseExchangeOrder,
} from "./empty-pack-stock";

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
        const exactLinkedItem = deliveredItem.orderItemId
            ? orderItems.find(
                (item: typeof orderItem.$inferSelect) =>
                    item.id === deliveredItem.orderItemId,
            )
            : null;
        const exactVariantItems = deliveredItem.variantId
            ? orderItems.filter(
                (item: typeof orderItem.$inferSelect) =>
                    item.variantId === deliveredItem.variantId,
            )
            : [];
        const matchedItem =
            exactLinkedItem ??
            (exactVariantItems.length === 1 ? exactVariantItems[0] : null);

        if (!matchedItem) {
            throw new Error(
                `Invoice item ${deliveredItem.id} cannot be matched to one exact order variant`,
            );
        }

        const targetQty = matchedItem.modifiedQty ?? matchedItem.quantity;
        const deliveredSoFar = matchedItem.deliveredQty ?? 0;
        const nextDeliveredQty = deliveredSoFar + deliveredItem.quantity;
        if (nextDeliveredQty > targetQty) {
            throw new Error(
                `Invoice item ${deliveredItem.id} exceeds its approved order quantity`,
            );
        }

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
            for (const item of refreshedItems) {
                await tx
                    .update(orderItem)
                    .set({ receivedQty: item.deliveredQty ?? 0 })
                    .where(eq(orderItem.id, item.id));
            }
        }
    }

    if (Object.keys(nextOrderState).length > 0) {
        await tx
            .update(order)
            .set(nextOrderState)
            .where(eq(order.id, deliveredInvoice.orderId));
    }

    if (
        fullyDelivered &&
        deliveredInvoice.order.orderType === "b2b" &&
        deliveredInvoice.order.warehouseId
    ) {
        await consumeB2bOrderReservations(tx, {
            warehouseId: deliveredInvoice.order.warehouseId,
            orderId: deliveredInvoice.orderId,
        });
        await creditWarehouseExchangeOrder(tx, {
            warehouseId: deliveredInvoice.order.warehouseId,
            orderId: deliveredInvoice.orderId,
        });
    }

    if (
        fullyDelivered &&
        options.markReceived &&
        deliveredInvoice.order.orderType === "b2b"
    ) {
        await convertB2bOrderToRetailInventory(tx, deliveredInvoice.orderId);
    }

    if (
        fullyDelivered &&
        deliveredInvoice.order.orderType === "b2c" &&
        deliveredInvoice.order.shopId
    ) {
        await creditRetailerExchangeOrder(tx, {
            shopId: deliveredInvoice.order.shopId,
            orderId: deliveredInvoice.orderId,
        });
    }

    return {
        orderId: deliveredInvoice.orderId,
        fullyDelivered,
    };
}
