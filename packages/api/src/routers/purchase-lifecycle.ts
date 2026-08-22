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

  requestRefund: protectedProcedure
    .route({
      method: "POST",
      path: "/purchase-lifecycle/refunds/request",
      tags: ["Purchase Lifecycle"],
      summary: "Request a purchase payment refund",
    })
    .input(
      z.object({
        paymentId: z.number().int().positive(),
        reason: z.string().min(3).max(500),
      }),
    )
    .handler(async ({ context, input }) => {
      const ownerId = context.session.user.id;
      const paid = await db.query.payment.findFirst({
        where: eq(payment.id, input.paymentId),
        with: { order: true },
      });
      if (!paid || paid.order.userId !== ownerId || paid.order.orderType !== "b2b") {
        throw new ORPCError("NOT_FOUND", { message: "Purchase payment not found" });
      }
      if (!["cancelled", "returned"].includes(paid.order.status)) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Cancel or return the purchase before requesting a refund",
        });
      }
      if (!['completed', 'partially_refunded'].includes(paid.status)) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Only completed purchase payments can be refunded",
        });
      }

      await db.transaction(async (tx) => {
        await tx
          .update(payment)
          .set({ status: "refund_pending" })
          .where(eq(payment.id, paid.id));
        await appendOrderPurchaseEvent(tx, {
          actorId: ownerId,
          amount: Number(paid.amount) - Number(paid.refundedAmount),
          category: "payment",
          description: input.reason,
          eventType: "refund_requested",
          fromState: paid.status,
          idempotencyKey: `payment:${paid.id}:refund-requested`,
          orderId: paid.orderId,
          ownerId,
          reference: paid.referenceNo ?? paid.order.orderNumber,
          toState: "refund_pending",
        });
      });

      return { status: "refund_pending" as const, success: true };
    }),

  completeRefund: protectedProcedure
    .route({
      method: "POST",
      path: "/purchase-lifecycle/refunds/complete",
      tags: ["Purchase Lifecycle"],
      summary: "Complete a purchase payment refund",
    })
    .input(
      z.object({
        amount: z.number().positive(),
        idempotencyKey: z.string().min(8).max(100),
        paymentAccountId: z.number().int().positive(),
        paymentId: z.number().int().positive(),
        referenceNo: z.string().max(180).optional(),
        transactionId: z.string().max(255).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const ownerId = context.session.user.id;
      const ownerType = ownerTypeForRole(context.session.user.role);
      const paid = await db.query.payment.findFirst({
        where: eq(payment.id, input.paymentId),
        with: { order: true },
      });
      if (!paid || paid.order.userId !== ownerId || paid.order.orderType !== "b2b") {
        throw new ORPCError("NOT_FOUND", { message: "Purchase payment not found" });
      }
      if (paid.status !== "refund_pending") {
        throw new ORPCError("BAD_REQUEST", {
          message: "The purchase payment is not awaiting a refund",
        });
      }
      const refundable = Number(paid.amount) - Number(paid.refundedAmount);
      if (input.amount > refundable + 0.001) {
        throw new ORPCError("BAD_REQUEST", {
          message: `Refund exceeds the refundable amount of Tk${refundable.toFixed(2)}`,
        });
      }

      await ensureDefaultFinancePaymentAccounts({ ownerId, ownerType });
      const refundedAt = new Date();
      const refundedAmount = Number(paid.refundedAmount) + input.amount;
      const fullyRefunded = refundedAmount >= Number(paid.amount) - 0.001;

      const result = await db.transaction(async (tx) => {
        const [refund] = await tx
          .insert(payment)
          .values({
            amount: input.amount.toFixed(2),
            completedAt: refundedAt,
            entryType: "refund",
            idempotencyKey: input.idempotencyKey,
            orderId: paid.orderId,
            paymentAccountId: input.paymentAccountId,
            paymentMethod: paid.paymentMethod,
            paymentProvider: paid.paymentProvider,
            purchasePurpose: paid.purchasePurpose,
            purchaseTiming: paid.purchaseTiming,
            referenceNo: input.referenceNo ?? paid.referenceNo,
            relatedPaymentId: paid.id,
            status: "completed",
            transactionId: input.transactionId ?? null,
            verifiedAt: refundedAt,
          })
          .returning({ id: payment.id });

        await postPurchaseJournal(tx, {
          actorId: ownerId,
          amount: input.amount,
          idempotencyKey: `purchase-refund:${refund!.id}:completed`,
          memo: `Purchase refund for ${paid.order.orderNumber}`,
          ownerId,
          ownerType,
          paymentAccountId: input.paymentAccountId,
          sourceId: String(refund!.id),
          sourceType: "payment",
          transactionDate: localDateString(refundedAt),
          transactionType:
            paid.purchasePurpose === "supplier_advance"
              ? "supplier_advance_refunded"
              : "supplier_refund_received",
        });

        await tx
          .update(payment)
          .set({
            refundedAmount: refundedAmount.toFixed(2),
            status: fullyRefunded ? "refunded" : "partially_refunded",
          })
          .where(eq(payment.id, paid.id));
        await tx
          .update(order)
          .set({
            paymentStatus: fullyRefunded ? "refunded" : "partially_refunded",
            returnAmount: (
              Number(paid.order.returnAmount) + input.amount
            ).toFixed(2),
          })
          .where(eq(order.id, paid.orderId));
        await appendOrderPurchaseEvent(tx, {
          actorId: ownerId,
          amount: input.amount,
          category: "payment",
          description: "Purchase refund completed",
          eventType: "refund_completed",
          fromState: "refund_pending",
          idempotencyKey: `payment:${paid.id}:refund:${refund!.id}:completed`,
          orderId: paid.orderId,
          ownerId,
          reference: input.referenceNo ?? paid.order.orderNumber,
          toState: fullyRefunded ? "refunded" : "partially_refunded",
        });

        return refund!;
      });

      return {
        paymentStatus: fullyRefunded ? "refunded" : "partially_refunded",
        refundId: result.id,
        success: true,
      };
    }),
};
