import { db } from "@bikalpo-project/db";
import { ensureDefaultFinancePaymentAccounts } from "@bikalpo-project/db/accounting-seed";
import { order, payment } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../index";
import { postPurchaseJournal } from "../services/purchase-accounting";
import { appendOrderPurchaseEvent } from "../services/purchase-history";
import { classifyPurchasePayment } from "../services/purchase-lifecycle";
import { localDateString } from "../utils/date";

function ownerTypeForRole(role?: string | null) {
  if (role === "shop_owner") return "shop" as const;
  if (role === "warehouse") return "warehouse" as const;
  throw new ORPCError("FORBIDDEN", {
    message: "Purchase payments require a shop or warehouse account",
  });
}

export const purchaseLifecycleRouter = {
  completePayment: protectedProcedure
    .route({
      method: "POST",
      path: "/purchase-lifecycle/payments/complete",
      tags: ["Purchase Lifecycle"],
      summary: "Record a successful purchase payment",
    })
    .input(
      z.object({
        amount: z.number().positive(),
        idempotencyKey: z.string().min(8).max(100),
        orderId: z.number().int().positive(),
        paymentAccountId: z.number().int().positive(),
        paymentId: z.number().int().positive().optional(),
        paymentMethod: z.enum(["cash", "bank", "mobile_banking"]),
        referenceNo: z.string().max(180).optional(),
        transactionId: z.string().max(255).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const ownerId = context.session.user.id;
      const ownerType = ownerTypeForRole(context.session.user.role);
      const orderData = await db.query.order.findFirst({
        where: and(
          eq(order.id, input.orderId),
          eq(order.userId, ownerId),
          eq(order.orderType, "b2b"),
        ),
      });
      if (!orderData) {
        throw new ORPCError("NOT_FOUND", { message: "Purchase order not found" });
      }
      if (["cancelled", "returned"].includes(orderData.status)) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Cancelled or returned purchases cannot be paid",
        });
      }

      const outstanding = Math.max(
        0,
        Number(orderData.total) - Number(orderData.paidAmount),
      );
      if (input.amount > outstanding + 0.001) {
        throw new ORPCError("BAD_REQUEST", {
          message: `Payment exceeds the outstanding amount of Tk${outstanding.toFixed(2)}`,
        });
      }

      const existingPayment = input.paymentId
        ? await db.query.payment.findFirst({
            where: and(
              eq(payment.id, input.paymentId),
              eq(payment.orderId, input.orderId),
            ),
          })
        : await db.query.payment.findFirst({
            where: eq(payment.idempotencyKey, input.idempotencyKey),
          });
      if (existingPayment?.status === "completed") {
        return {
          dueAmount: orderData.dueAmount,
          paymentId: existingPayment.id,
          paymentStatus: orderData.paymentStatus,
          success: true,
        };
      }
      if (
        existingPayment &&
        Math.abs(Number(existingPayment.amount) - input.amount) > 0.001
      ) {
        throw new ORPCError("CONFLICT", {
          message: "The payment amount does not match the pending payment",
        });
      }

      await ensureDefaultFinancePaymentAccounts({ ownerId, ownerType });
      const completedAt = new Date();
      const classification = classifyPurchasePayment({
        completedAt,
        receivedAt: orderData.receivedAt,
      });
      const paidAmount = Number(orderData.paidAmount) + input.amount;
      const dueAmount = Math.max(0, Number(orderData.total) - paidAmount);
      const aggregateStatus = dueAmount <= 0 ? "paid" : "partial";

      const result = await db.transaction(async (tx) => {
        let paymentId = existingPayment?.id;
        if (existingPayment) {
          const [claimed] = await tx
            .update(payment)
            .set({
              completedAt,
              paymentAccountId: input.paymentAccountId,
              paymentMethod: input.paymentMethod,
              purchasePurpose: classification.purpose,
              purchaseTiming: classification.timing,
              referenceNo: input.referenceNo ?? null,
              status: "completed",
              transactionId:
                input.transactionId ?? existingPayment.transactionId ?? null,
              verifiedAt: completedAt,
            })
            .where(
              and(
                eq(payment.id, existingPayment.id),
                eq(payment.status, existingPayment.status),
              ),
            )
            .returning({ id: payment.id });
          if (!claimed) {
            throw new ORPCError("CONFLICT", {
              message: "Payment status changed while it was being completed",
            });
          }
          paymentId = claimed.id;
        } else {
          const [created] = await tx
            .insert(payment)
            .values({
              amount: input.amount.toFixed(2),
              completedAt,
              idempotencyKey: input.idempotencyKey,
              orderId: input.orderId,
              paymentAccountId: input.paymentAccountId,
              paymentMethod: input.paymentMethod,
              paymentProvider: "manual",
              purchasePurpose: classification.purpose,
              purchaseTiming: classification.timing,
              referenceNo: input.referenceNo ?? null,
              status: "completed",
              transactionId: input.transactionId ?? null,
              verifiedAt: completedAt,
            })
            .returning({ id: payment.id });
          paymentId = created!.id;
        }

        await postPurchaseJournal(tx, {
          actorId: ownerId,
          amount: input.amount,
          idempotencyKey: `purchase-payment:${paymentId}:completed`,
          memo: `${classification.purpose === "supplier_advance" ? "Supplier advance" : "Purchase payment"} for ${orderData.orderNumber}`,
          ownerId,
          ownerType,
          paymentAccountId: input.paymentAccountId,
          sourceId: String(paymentId),
          sourceType: "payment",
          transactionDate: localDateString(completedAt),
          transactionType:
            classification.purpose === "supplier_advance"
              ? "supplier_advance_payment"
              : "supplier_payment",
        });

        await tx
          .update(order)
          .set({
            dueAmount: dueAmount.toFixed(2),
            paidAmount: paidAmount.toFixed(2),
            paymentStatus: aggregateStatus,
          })
          .where(eq(order.id, input.orderId));

        await appendOrderPurchaseEvent(tx, {
          actorId: ownerId,
          amount: input.amount,
          category: "payment",
          description:
            classification.purpose === "supplier_advance"
              ? "Supplier advance payment completed"
              : "Purchase due payment completed",
          eventType: "payment_completed",
          fromState: existingPayment?.status ?? "unpaid",
          idempotencyKey: `payment:${paymentId}:completed`,
          metadata: {
            paymentMethod: input.paymentMethod,
            purpose: classification.purpose,
            timing: classification.timing,
          },
          orderId: input.orderId,
          ownerId,
          reference: input.referenceNo ?? orderData.orderNumber,
          toState: "completed",
        });
        await appendOrderPurchaseEvent(tx, {
          actorId: ownerId,
          amount: input.amount,
          category: "accounting",
          description:
            classification.purpose === "supplier_advance"
              ? "Cash/Bank credited and Supplier Advance debited"
              : "Cash/Bank credited and Accounts Payable debited",
          eventType:
            classification.purpose === "supplier_advance"
              ? "advance_recorded"
              : "payment_settled",
          idempotencyKey: `payment:${paymentId}:accounting`,
          orderId: input.orderId,
          ownerId,
          reference: orderData.orderNumber,
        });

        return { paymentId };
      });

      return {
        dueAmount: dueAmount.toFixed(2),
        paymentId: result.paymentId,
        paymentStatus: aggregateStatus,
        success: true,
      };
    }),
};
