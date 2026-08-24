import { db } from "@bikalpo-project/db";
import { ensureDefaultFinancePaymentAccounts } from "@bikalpo-project/db/accounting-seed";
import {
  inventoryMovement,
  journalEntry,
  journalLine,
  order,
  orderItem,
  payment,
  purchaseEvent,
  user,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  lte,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../index";
import { postPurchaseJournal } from "../services/purchase-accounting";
import { appendOrderPurchaseEvent } from "../services/purchase-history";
import { classifyPurchasePayment } from "../services/purchase-lifecycle";
import {
  deriveFinancialStatus,
  derivePaymentAggregateStatus,
  derivePurchaseStatus,
} from "../services/purchase-lifecycle";
import { localDateString } from "../utils/date";
import { returnReceivedPurchase } from "../services/purchase-return";

function ownerTypeForRole(role?: string | null) {
  if (role === "shop_owner") return "shop" as const;
  if (role === "warehouse") return "warehouse" as const;
  throw new ORPCError("FORBIDDEN", {
    message: "Purchase payments require a shop or warehouse account",
  });
}

export const purchaseLifecycleRouter = {
  getHistory: protectedProcedure
    .route({
      method: "POST",
      path: "/purchase-lifecycle/history",
      tags: ["Purchase Lifecycle"],
      summary: "List platform purchase history",
    })
    .input(
      z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
        page: z.number().int().min(1).default(1),
        search: z.string().max(120).optional(),
        status: z
          .enum([
            "submitted",
            "accepted",
            "partially_received",
            "received",
            "cancelled",
            "returned",
          ])
          .optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const ownerId = context.session.user.id;
      ownerTypeForRole(context.session.user.role);
      const conditions: any[] = [
        eq(order.userId, ownerId),
        eq(order.orderType, "b2b"),
      ];
      if (input.search?.trim()) {
        conditions.push(ilike(order.orderNumber, `%${input.search.trim()}%`));
      }
      if (input.dateFrom) conditions.push(gte(order.createdAt, new Date(input.dateFrom)));
      if (input.dateTo) {
        const end = new Date(`${input.dateTo}T23:59:59.999`);
        conditions.push(lte(order.createdAt, end));
      }
      if (input.status === "cancelled" || input.status === "returned") {
        conditions.push(eq(order.status, input.status));
      } else if (input.status === "received") {
        conditions.push(isNotNull(order.receivedAt));
      } else if (input.status === "partially_received") {
        conditions.push(sql`exists (
          select 1
          from ${orderItem}
          where ${orderItem.orderId} = ${order.id}
            and coalesce(${orderItem.receivedQty}, 0) > 0
            and coalesce(${orderItem.receivedQty}, 0) <
              coalesce(${orderItem.modifiedQty}, ${orderItem.quantity})
        )`);
      } else if (input.status === "submitted") {
        conditions.push(eq(order.status, "pending"));
      } else if (input.status === "accepted") {
        conditions.push(
          inArray(order.status, [
            "approved",
            "confirmed",
            "processing",
            "ready_for_dispatch",
            "partially_invoiced",
            "invoiced",
            "delivered",
          ]),
        );
      }

      const where = and(...conditions);
      const countRows = await db.select({ total: count() }).from(order).where(where);
      const total = countRows[0]?.total ?? 0;
      const rows = await db.query.order.findMany({
        where,
        with: { items: true },
        orderBy: [desc(order.createdAt)],
        limit: input.limit,
        offset: (input.page - 1) * input.limit,
      });
      const orderIds = rows.map((row) => row.id);
      const warehouseIds = rows
        .map((row) => row.warehouseId)
        .filter((id): id is string => Boolean(id));
      const [sellers, payments, movements, events] = await Promise.all([
        warehouseIds.length
          ? db.query.user.findMany({ where: inArray(user.id, warehouseIds) })
          : [],
        orderIds.length
          ? db.query.payment.findMany({ where: inArray(payment.orderId, orderIds) })
          : [],
        orderIds.length
          ? db.query.inventoryMovement.findMany({
              where: inArray(inventoryMovement.orderId, orderIds),
            })
          : [],
        orderIds.length
          ? db.query.purchaseEvent.findMany({
              where: inArray(purchaseEvent.orderId, orderIds),
            })
          : [],
      ]);
      const sellerById = new Map(sellers.map((seller) => [seller.id, seller]));

      return {
        pagination: {
          limit: input.limit,
          page: input.page,
          pages: Math.max(1, Math.ceil(Number(total ?? 0) / input.limit)),
          total: Number(total ?? 0),
        },
        purchases: rows.map((row) => {
          const rowPayments = payments.filter((item) => item.orderId === row.id);
          const rowMovements = movements.filter((item) => item.orderId === row.id);
          const rowEvents = events.filter((item) => item.orderId === row.id);
          const expectedQty = row.items.reduce(
            (sum, item) => sum + Number(item.modifiedQty ?? item.quantity),
            0,
          );
          const receivedQty = row.items.reduce(
            (sum, item) => sum + Number(item.receivedQty ?? 0),
            0,
          );
          const recognizedAmount = rowMovements.reduce(
            (sum, item) =>
              sum +
              (item.direction === "out" ? -1 : 1) *
                Number(item.totalCost ?? 0),
            0,
          );
          const advances = rowPayments
            .filter(
              (item) =>
                item.entryType === "payment" &&
                item.status === "completed" &&
                item.purchasePurpose === "supplier_advance",
            )
            .reduce((sum, item) => sum + Number(item.amount), 0);
          const advanceApplied = rowEvents
            .filter((item) => item.eventType === "advance_applied")
            .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
          const settlements = rowPayments
            .filter(
              (item) =>
                item.entryType === "payment" &&
                item.status === "completed" &&
                item.purchasePurpose === "payable_settlement",
            )
            .reduce((sum, item) => sum + Number(item.amount), 0);
          const refundedAmount = rowPayments
            .filter((item) => item.entryType === "refund" && item.status === "completed")
            .reduce((sum, item) => sum + Number(item.amount), 0);
          const seller = row.warehouseId ? sellerById.get(row.warehouseId) : null;

          return {
            createdAt: row.createdAt,
            dueAmount: row.dueAmount,
            financialStatus: deriveFinancialStatus({
              advanceBalance: Math.max(0, advances - advanceApplied),
              payableBalance: Math.max(
                0,
                recognizedAmount - advanceApplied - settlements,
              ),
              recognizedAmount,
              refundedAmount,
              refundPending: rowPayments.some(
                (item) => item.status === "refund_pending",
              ),
            }),
            id: row.id,
            inventoryStatus:
              row.status === "returned"
                ? "reversed"
                : recognizedAmount <= 0
                ? "not_recognized"
                : receivedQty < expectedQty
                  ? "partially_received"
                  : "recognized",
            itemCount: row.items.length,
            orderNumber: row.orderNumber,
            paidAmount: row.paidAmount,
            paymentMethod: row.paymentMethod,
            paymentStatus: derivePaymentAggregateStatus({
              paidAmount: Number(row.paidAmount),
              purchaseTotal: Number(row.total),
              refundedAmount,
              refundPending: rowPayments.some(
                (item) => item.status === "refund_pending",
              ),
            }),
            purchaseStatus: derivePurchaseStatus({
              expectedQty,
              orderStatus: row.status,
              receivedAt: row.receivedAt,
              receivedQty,
            }),
            receivedAt: row.receivedAt,
            sellerName:
              seller?.warehouseName ?? seller?.shopName ?? seller?.name ?? "Supplier",
            total: row.total,
          };
        }),
      };
    }),

  getDetail: protectedProcedure
    .route({
      method: "GET",
      path: "/purchase-lifecycle/history/{orderId}",
      tags: ["Purchase Lifecycle"],
      summary: "Get permanent purchase histories",
    })
    .input(z.object({ orderId: z.number().int().positive() }))
    .handler(async ({ context, input }) => {
      const ownerId = context.session.user.id;
      ownerTypeForRole(context.session.user.role);
      const purchaseOrder = await db.query.order.findFirst({
        where: and(
          eq(order.id, input.orderId),
          eq(order.userId, ownerId),
          eq(order.orderType, "b2b"),
        ),
        with: { items: true },
      });
      if (!purchaseOrder) {
        throw new ORPCError("NOT_FOUND", { message: "Purchase order not found" });
      }

      const [events, payments, movements, journals] = await Promise.all([
        db.query.purchaseEvent.findMany({
          where: eq(purchaseEvent.orderId, input.orderId),
          orderBy: [desc(purchaseEvent.occurredAt)],
        }),
        db.query.payment.findMany({
          where: eq(payment.orderId, input.orderId),
          orderBy: [desc(payment.createdAt)],
        }),
        db.query.inventoryMovement.findMany({
          where: eq(inventoryMovement.orderId, input.orderId),
          orderBy: [desc(inventoryMovement.occurredAt)],
        }),
        db.query.journalEntry.findMany({
          where: and(
            eq(journalEntry.ownerId, ownerId),
            ilike(journalEntry.memo, `%${purchaseOrder.orderNumber}%`),
          ),
          orderBy: [desc(journalEntry.postedAt)],
        }),
      ]);
      const journalIds = journals.map((entry) => entry.id);
      const lines = journalIds.length
        ? await db.query.journalLine.findMany({
            where: inArray(journalLine.journalEntryId, journalIds),
          })
        : [];
      const chronologicalPayments = [...payments].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      );
      let runningDue = Number(purchaseOrder.total);
      const paymentHistory = chronologicalPayments.map((row) => {
        if (row.status === "completed" && row.entryType === "payment") {
          runningDue = Math.max(0, runningDue - Number(row.amount));
        }
        return {
          ...row,
          dueAfter: runningDue.toFixed(2),
          method: row.paymentMethod,
          purpose: row.purchasePurpose,
          timing: row.purchaseTiming,
        };
      });
      const pendingRefundPayment = payments.find(
        (row) => row.entryType === "payment" && row.status === "refund_pending",
      );
      const latestRefundStage = [
        "refund_completed",
        "refund_processed",
        "refund_approved",
        "refund_requested",
      ].find((eventType) =>
        events.some(
          (event) =>
            event.eventType === eventType &&
            (!pendingRefundPayment ||
              event.idempotencyKey.startsWith(
                `payment:${pendingRefundPayment.id}:`,
              )),
        ),
      );
      const receiptValue = movements
        .filter((movement) => movement.reason === "purchase_receipt")
        .reduce((sum, movement) => sum + Number(movement.totalCost), 0);
      const returnedValue = movements
        .filter((movement) => movement.reason === "purchase_return")
        .reduce((sum, movement) => sum + Number(movement.totalCost), 0);

      return {
        accountingHistory: journals.map((entry) => ({
          ...entry,
          lines: lines.filter((line) => line.journalEntryId === entry.id),
        })),
        inventoryHistory: movements,
        order: purchaseOrder,
        paymentHistory: paymentHistory.reverse(),
        purchaseHistory: events,
        summary: {
          dueAmount: purchaseOrder.dueAmount,
          netInventoryValue: (receiptValue - returnedValue).toFixed(2),
          paidAmount: purchaseOrder.paidAmount,
          refundStage: latestRefundStage ?? null,
          returnAmount: purchaseOrder.returnAmount,
          total: purchaseOrder.total,
        },
      };
    }),

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

  returnPurchase: protectedProcedure
    .route({
      method: "POST",
      path: "/purchase-lifecycle/returns",
      tags: ["Purchase Lifecycle"],
      summary: "Return received purchase stock",
    })
    .input(
      z.object({
        orderId: z.number().int().positive(),
        reason: z.string().trim().max(300).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const ownerId = context.session.user.id;
      const ownerType = ownerTypeForRole(context.session.user.role);
      try {
        const result = await db.transaction(async (tx) => {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.orderId})`);
          return returnReceivedPurchase(tx, {
            actorId: ownerId,
            orderId: input.orderId,
            ownerId,
            ownerType,
            reason: input.reason,
            returnedAt: new Date(),
          });
        });
        return { ...result, success: true };
      } catch (error) {
        if (error instanceof ORPCError) throw error;
        throw new ORPCError("BAD_REQUEST", {
          message:
            error instanceof Error ? error.message : "Purchase return failed",
        });
      }
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

  approveRefund: protectedProcedure
    .route({
      method: "POST",
      path: "/purchase-lifecycle/refunds/approve",
      tags: ["Purchase Lifecycle"],
      summary: "Approve a requested purchase refund",
    })
    .input(z.object({ paymentId: z.number().int().positive() }))
    .handler(async ({ context, input }) => {
      const ownerId = context.session.user.id;
      const paid = await db.query.payment.findFirst({
        where: eq(payment.id, input.paymentId),
        with: { order: true },
      });
      if (!paid || paid.order.userId !== ownerId || paid.order.orderType !== "b2b") {
        throw new ORPCError("NOT_FOUND", { message: "Purchase payment not found" });
      }
      if (paid.status !== "refund_pending") {
        throw new ORPCError("BAD_REQUEST", { message: "Refund is not pending" });
      }
      const verified = await db.query.purchaseEvent.findFirst({
        where: and(
          eq(purchaseEvent.orderId, paid.orderId),
          eq(purchaseEvent.eventType, "refund_verified"),
          ilike(purchaseEvent.idempotencyKey, `payment:${paid.id}:%`),
        ),
        orderBy: [desc(purchaseEvent.occurredAt)],
      });
      if (!verified) {
        throw new ORPCError("BAD_REQUEST", { message: "Verify the refund first" });
      }
      await appendOrderPurchaseEvent(db, {
        actorId: ownerId,
        amount: Number(paid.amount) - Number(paid.refundedAmount),
        category: "payment",
        description: "Purchase refund approved",
        eventType: "refund_approved",
        fromState: "refund_pending",
        idempotencyKey: `payment:${paid.id}:refund-approved`,
        orderId: paid.orderId,
        ownerId,
        reference: paid.referenceNo ?? paid.order.orderNumber,
        toState: "refund_approved",
      });
      return { status: "refund_approved" as const, success: true };
    }),

  verifyRefund: protectedProcedure
    .route({
      method: "POST",
      path: "/purchase-lifecycle/refunds/verify",
      tags: ["Purchase Lifecycle"],
      summary: "Verify a requested purchase refund",
    })
    .input(z.object({ paymentId: z.number().int().positive() }))
    .handler(async ({ context, input }) => {
      const ownerId = context.session.user.id;
      const paid = await db.query.payment.findFirst({
        where: eq(payment.id, input.paymentId),
        with: { order: true },
      });
      if (
        !paid ||
        !paid.order ||
        paid.order.userId !== ownerId ||
        paid.order.orderType !== "b2b"
      ) {
        throw new ORPCError("NOT_FOUND", {
          message: "Purchase payment not found",
        });
      }
      if (paid.status !== "refund_pending") {
        throw new ORPCError("BAD_REQUEST", { message: "Refund is not pending" });
      }
      const requested = await db.query.purchaseEvent.findFirst({
        where: and(
          eq(purchaseEvent.orderId, paid.orderId!),
          eq(purchaseEvent.eventType, "refund_requested"),
          ilike(purchaseEvent.idempotencyKey, `payment:${paid.id}:%`),
        ),
        orderBy: [desc(purchaseEvent.occurredAt)],
      });
      if (!requested) {
        throw new ORPCError("BAD_REQUEST", { message: "Request the refund first" });
      }
      await appendOrderPurchaseEvent(db, {
        actorId: ownerId,
        amount: Number(paid.amount) - Number(paid.refundedAmount),
        category: "payment",
        description: "Purchase refund verified",
        eventType: "refund_verified",
        fromState: "refund_pending",
        idempotencyKey: `payment:${paid.id}:refund-verified`,
        orderId: paid.orderId!,
        ownerId,
        reference: paid.referenceNo ?? paid.order.orderNumber,
        toState: "refund_verified",
      });
      return { status: "refund_verified" as const, success: true };
    }),

  processRefund: protectedProcedure
    .route({
      method: "POST",
      path: "/purchase-lifecycle/refunds/process",
      tags: ["Purchase Lifecycle"],
      summary: "Mark an approved purchase refund as processing",
    })
    .input(z.object({ paymentId: z.number().int().positive() }))
    .handler(async ({ context, input }) => {
      const ownerId = context.session.user.id;
      const paid = await db.query.payment.findFirst({
        where: eq(payment.id, input.paymentId),
        with: { order: true },
      });
      if (!paid || paid.order.userId !== ownerId || paid.order.orderType !== "b2b") {
        throw new ORPCError("NOT_FOUND", { message: "Purchase payment not found" });
      }
      if (paid.status !== "refund_pending") {
        throw new ORPCError("BAD_REQUEST", { message: "Refund is not pending" });
      }
      const approved = await db.query.purchaseEvent.findFirst({
        where: and(
          eq(purchaseEvent.orderId, paid.orderId),
          eq(purchaseEvent.eventType, "refund_approved"),
          ilike(purchaseEvent.idempotencyKey, `payment:${paid.id}:%`),
        ),
        orderBy: [desc(purchaseEvent.occurredAt)],
      });
      if (!approved) {
        throw new ORPCError("BAD_REQUEST", { message: "Approve the refund first" });
      }
      await appendOrderPurchaseEvent(db, {
        actorId: ownerId,
        amount: Number(paid.amount) - Number(paid.refundedAmount),
        category: "payment",
        description: "Purchase refund is being processed",
        eventType: "refund_processed",
        fromState: "refund_approved",
        idempotencyKey: `payment:${paid.id}:refund-processed`,
        orderId: paid.orderId,
        ownerId,
        reference: paid.referenceNo ?? paid.order.orderNumber,
        toState: "refund_processed",
      });
      return { status: "refund_processed" as const, success: true };
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
      const processed = await db.query.purchaseEvent.findFirst({
        where: and(
          eq(purchaseEvent.orderId, paid.orderId),
          eq(purchaseEvent.eventType, "refund_processed"),
          ilike(purchaseEvent.idempotencyKey, `payment:${paid.id}:%`),
        ),
        orderBy: [desc(purchaseEvent.occurredAt)],
      });
      if (!processed) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Approve and process the refund before completion",
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
            paid.order.status === "cancelled" &&
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
            returnAmount:
              paid.order.status === "returned"
                ? paid.order.returnAmount
                : (Number(paid.order.returnAmount) + input.amount).toFixed(2),
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
