import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@bikalpo-project/db";
import { invoice, invoiceItem, order } from "@bikalpo-project/db/schema";

type NewInvoice = typeof invoice.$inferInsert;
type NewInvoiceItem = typeof invoiceItem.$inferInsert;

async function generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    const latestInvoice = await db.query.invoice.findFirst({
        where: sql`${invoice.invoiceNumber} LIKE ${prefix + "%"}`,
        orderBy: [desc(invoice.invoiceNumber)],
    });

    let sequence = 1;
    if (latestInvoice) {
        const lastSequence = Number.parseInt(latestInvoice.invoiceNumber.split("-")[2]!, 10);
        sequence = lastSequence + 1;
    }

    return `${prefix}${sequence.toString().padStart(4, "0")}`;
}

/**
 * Generate invoice from an order (called when order is confirmed).
 * Pure data logic — no auth checks or revalidation.
 */
export async function generateInvoiceFromOrder(orderId: number) {
    const existingInvoice = await db.query.invoice.findFirst({
        where: and(eq(invoice.orderId, orderId), eq(invoice.invoiceType, "main")),
    });

    if (existingInvoice) throw new Error("Invoice already exists for this order");

    const orderData = await db.query.order.findFirst({
        where: eq(order.id, orderId),
        with: { items: true },
    });

    if (!orderData) throw new Error("Order not found");

    const invoiceNumber = await generateInvoiceNumber();

    const result = await db
        .insert(invoice)
        .values({
            invoiceNumber,
            orderId: orderData.id,
            customerId: orderData.userId,
            invoiceType: "main",
            paymentStatus: "unpaid",
            deliveryStatus: "not_assigned",
            subtotal: orderData.subtotal,
            discountAmount: orderData.discount,
            deliveryCharge: orderData.shippingCost,
            taxAmount: "0",
            grandTotal: orderData.total,
            customerNotes: orderData.customerNote,
        } satisfies NewInvoice)
        .returning();

    const newInvoice = result[0]!;

    const invoiceItems = orderData.items
        .map((item) => {
            const quantity = item.modifiedQty ?? item.quantity;
            const unitPrice = item.modifiedUnitPrice ?? item.unitPrice;
            const lineTotal = (Number(unitPrice) * quantity).toFixed(2);

            return {
                item,
                quantity,
                unitPrice,
                lineTotal,
            };
        })
        .filter((item) => item.quantity > 0);

    if (invoiceItems.length > 0) {
        await db.insert(invoiceItem).values(
            invoiceItems.map(
                ({ item, quantity, unitPrice, lineTotal }) =>
                    ({
                        invoiceId: newInvoice.id,
                        orderItemId: item.id,
                        productId: item.productId,
                        variantId: item.variantId,
                        productName: item.productName,
                        productSku: item.productSize,
                        productImage: item.productImage,
                        quantity,
                        quantityUnit: item.quantityUnit,
                        inventoryUnit: item.inventoryUnit,
                        conversionFactor: item.conversionFactor,
                        inventoryQty: item.inventoryQty,
                        unitPrice,
                        lineTotal,
                    }) satisfies NewInvoiceItem,
            ),
        );
    }

    return newInvoice;
}
