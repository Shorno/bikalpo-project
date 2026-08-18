import type { db } from "@bikalpo-project/db";
import {
  emptyPack,
  invoice,
  order,
  orderItem,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, sql } from "drizzle-orm";
import { settleRetailerCylinderReturns } from "../../services/retailer-cylinder-sale";
import { fulfillmentInvoiceOwnerCondition } from "./fulfillment-owner";
import {
  consumeRetailerOrderStock,
  createRetailerOrderStockWriter,
  RetailerOrderStockError,
} from "./retailer-order-stock";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type RetailerCylinderHandoffInput = {
  acceptedReturns?: Array<{ orderItemId: number; quantity: number }>;
  handoffBalancePaid?: boolean;
  handoffPaymentMethod?: string | null;
  handoffPaymentReference?: string | null;
};

export async function settleRetailerCylinderHandoff(
  tx: DbTransaction,
  input: RetailerCylinderHandoffInput & {
    shopId: string;
    invoiceId: number;
    actorId: string;
    deliveryGroupInvoiceId?: number | null;
  },
) {
  const invoiceRecord = await tx.query.invoice.findFirst({
    where: and(
      eq(invoice.id, input.invoiceId),
      fulfillmentInvoiceOwnerCondition({ kind: "shop", id: input.shopId }),
    ),
    with: {
      order: {
        with: {
          items: { with: { variant: true } },
        },
      },
    },
  });
  if (!invoiceRecord?.order) {
    throw new ORPCError("NOT_FOUND", {
      message: "Retailer invoice was not found for cylinder handoff",
    });
  }

  const acceptedByOrderItem = new Map<number, number>();
  for (const accepted of input.acceptedReturns ?? []) {
    if (acceptedByOrderItem.has(accepted.orderItemId)) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Order item ${accepted.orderItemId} is duplicated`,
      });
    }
    acceptedByOrderItem.set(accepted.orderItemId, accepted.quantity);
  }

  const exchangeLines = invoiceRecord.order.items.filter(
    (item) => item.expectedEmptyPackQty > 0,
  );
  const exchangeLineIds = new Set(exchangeLines.map((item) => item.id));
  for (const orderItemId of acceptedByOrderItem.keys()) {
    if (!exchangeLineIds.has(orderItemId)) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Order item ${orderItemId} is not an Exchange line on this invoice`,
      });
    }
  }

  let settlement: ReturnType<typeof settleRetailerCylinderReturns>;
  try {
    settlement = settleRetailerCylinderReturns(
      exchangeLines.map((item) => ({
        orderItemId: item.id,
        expectedEmptyPackQty: item.expectedEmptyPackQty,
        // The lightweight flow treats an Exchange selection as a completed
        // one-for-one handoff unless a caller explicitly records otherwise.
        acceptedEmptyPackQty:
          acceptedByOrderItem.get(item.id) ?? item.expectedEmptyPackQty,
        exchangeCreditAmount: item.exchangeCreditAmount,
      })),
    );
  } catch (error) {
    throw new ORPCError("BAD_REQUEST", {
      message:
        error instanceof Error
          ? error.message
          : "Invalid empty cylinder return",
    });
  }

  if (Number(settlement.handoffBalance) > 0 && !input.handoffBalancePaid) {
    throw new ORPCError("BAD_REQUEST", {
      message: `Collect the ৳${settlement.handoffBalance} Handoff Balance before completing this handoff`,
    });
  }

  for (const line of settlement.lines) {
    const source = exchangeLines.find((item) => item.id === line.orderItemId)!;
    await tx
      .update(orderItem)
      .set({
        collectedEmptyPackQty: line.collectedEmptyPackQty,
        convertedToNewQty: line.convertedToNewQty,
      })
      .where(eq(orderItem.id, line.orderItemId));

    if (line.collectedEmptyPackQty > 0) {
      await tx.insert(emptyPack).values({
        deliveryGroupInvoiceId: input.deliveryGroupInvoiceId ?? null,
        shopId: input.shopId,
        invoiceId: invoiceRecord.id,
        orderItemId: source.id,
        variantId: source.variantId,
        brandId: source.variant?.brandId ?? null,
        packDescription: source.productSize,
        quantityCollected: line.collectedEmptyPackQty,
        status: "verified",
        verifiedBy: input.actorId,
        verifiedAt: new Date(),
        depositAmount: source.exchangeCreditAmount,
        notes: "Accepted exact-match empty cylinder at consumer handoff",
      });
    }
  }

  const handoffBalance = Number(settlement.handoffBalance);
  await tx
    .update(invoice)
    .set({
      handoffBalance: settlement.handoffBalance,
      handoffPaymentMethod:
        handoffBalance > 0 ? (input.handoffPaymentMethod ?? null) : null,
      handoffPaymentReference:
        handoffBalance > 0 ? (input.handoffPaymentReference ?? null) : null,
      handoffAdjustedAt: new Date(),
      subtotal: sql`${invoice.subtotal}::numeric + ${handoffBalance}`,
      grandTotal: sql`${invoice.grandTotal}::numeric + ${handoffBalance}`,
    })
    .where(eq(invoice.id, invoiceRecord.id));
  if (handoffBalance > 0) {
    await tx
      .update(order)
      .set({
        subtotal: sql`${order.subtotal}::numeric + ${handoffBalance}`,
        total: sql`${order.total}::numeric + ${handoffBalance}`,
      })
      .where(eq(order.id, invoiceRecord.order.id));
  }

  try {
    await consumeRetailerOrderStock(
      createRetailerOrderStockWriter(tx),
      input.shopId,
      invoiceRecord.order.items,
    );
  } catch (error) {
    if (error instanceof RetailerOrderStockError) {
      throw new ORPCError("BAD_REQUEST", { message: error.message });
    }
    throw error;
  }

  return settlement;
}
