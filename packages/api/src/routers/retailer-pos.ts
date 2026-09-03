import { db } from "@bikalpo-project/db";
import {
  inventory,
  invoice,
  order,
  retailerOfferApplication,
  warehousePosCart as posCart,
  warehousePosCustomer as posCustomer,
  warehousePosPayment as posPayment,
  warehousePosSale as posSale,
  warehousePosSaleItem as posSaleItem,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import { shopModuleProcedure } from "../index";
import { shopTenantId } from "../shop-portal-scope";
import {
  calculatePosCheckout,
  normalizePosPhone,
  type PosAdjustment,
  type PosOwner,
  validatePosDueCustomer,
} from "../services/owner-pos";
import {
  createHeldCartReference,
  ensurePosWalkInCustomer,
  findOrCreatePosCustomer,
  getOwnerPosCatalog,
  nextRetailerReceiptNumber,
  ownerColumns,
  posCartOwnerCondition,
  resolveOwnerPosSaleLines,
} from "../services/owner-pos-store";
import { evaluateRetailerOffer } from "../services/retailer-offer-engine";

const adjustmentSchema = z.object({
  mode: z.enum(["fixed", "percentage"]),
  value: z.number().nonnegative(),
});

const catalogFilterSchema = z.object({
  search: z.string().trim().max(120).optional(),
  typeId: z.number().int().optional(),
  categoryId: z.number().int().optional(),
  subCategoryId: z.number().int().optional(),
  coreProductId: z.number().int().optional(),
  brandId: z.number().int().optional(),
  pack: z.string().optional(),
});

const cartItemSchema = z.object({
  variantId: z.number().int().positive(),
  quantity: z.number().positive(),
  expectedUnitPrice: z.number().nonnegative().optional(),
});

const paymentMethodSchema = z.enum(["cash", "bkash", "nagad", "bank"]);

function shopOwner(context: { session: { user: { id: string; role?: string | null } } }): PosOwner {
  return { kind: "shop", id: shopTenantId(context.session.user) };
}

function money(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return (Number.isFinite(parsed) ? parsed : 0).toFixed(2);
}

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function saleOwnerCondition(shopId: string) {
  return eq(posSale.shopId, shopId);
}

function adjustmentOrDefault(value?: PosAdjustment) {
  return value ?? { mode: "fixed" as const, value: 0 };
}

function calculateRetailerCheckout(
  input: Parameters<typeof calculatePosCheckout>[0],
) {
  try {
    return calculatePosCheckout(input);
  } catch (error) {
    throw new ORPCError("BAD_REQUEST", {
      message: error instanceof Error ? error.message : "Invalid POS totals",
    });
  }
}

function assertExpectedPrices(
  requested: Array<{ variantId: number; expectedUnitPrice?: number }>,
  lines: Array<{ variantId: number; unitPrice: number; productName: string }>,
) {
  for (const item of requested) {
    if (item.expectedUnitPrice === undefined) continue;
    const current = lines.find((line) => line.variantId === item.variantId);
    if (current && Math.abs(current.unitPrice - item.expectedUnitPrice) >= 0.005) {
      throw new ORPCError("CONFLICT", {
        message: `Price changed for ${current.productName}. Refresh the cart before checkout.`,
      });
    }
  }
}

function paymentLabel(method: string | null | undefined) {
  if (method === "bkash") return "bKash";
  if (method === "nagad") return "Nagad";
  if (method === "bank" || method === "bank_transfer") return "Bank";
  if (method === "due") return "Due";
  return "Cash";
}

function parseDate(value: string | undefined, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return date;
}

async function getOwnedPosCustomer(shopId: string, customerId: number) {
  const customer = await db.query.warehousePosCustomer.findFirst({
    where: and(eq(posCustomer.id, customerId), eq(posCustomer.shopId, shopId)),
  });
  if (!customer) {
    throw new ORPCError("NOT_FOUND", { message: "POS Customer not found" });
  }
  return customer;
}

export const retailerPosRouter = {
  getBootstrap: shopModuleProcedure("sales")
    .route({
      method: "GET",
      path: "/retailer-pos/bootstrap",
      tags: ["Retailer POS"],
      summary: "Get retailer POS profile and defaults",
    })
    .input(z.object({}).optional())
    .handler(async ({ context }) => {
      const owner = shopOwner(context);
      const walkIn = await ensurePosWalkInCustomer(owner, owner.id);
      return {
        today: new Date().toISOString(),
        shop: {
          id: owner.id,
          name: context.session.user.shopName || context.session.user.name,
          ownerName: context.session.user.ownerName || context.session.user.name,
          address: context.session.user.shopAddress || null,
          phone: context.session.user.phoneNumber || null,
        },
        defaultCustomer: {
          id: walkIn.id,
          name: walkIn.name,
          phone: walkIn.phone,
          isDefault: true,
        },
        paymentMethods: ["cash", "bkash", "nagad", "bank"] as const,
      };
    }),

  getCatalog: shopModuleProcedure("sales")
    .route({
      method: "GET",
      path: "/retailer-pos/catalog",
      tags: ["Retailer POS"],
      summary: "Get shop-owned POS stock and progressive filters",
    })
    .input(catalogFilterSchema.optional())
    .handler(async ({ context, input }) => {
      const rows = await getOwnerPosCatalog(shopOwner(context));
      const filter = input ?? {};
      const search = filter.search?.toLocaleLowerCase();
      const searched = search
        ? rows.filter((row) =>
            [
              row.productName,
              row.coreProductName,
              row.brandName,
              row.pack,
              row.sku,
              row.localSku,
              row.globalSku,
            ].some((value) => value?.toLocaleLowerCase().includes(search)),
          )
        : rows;

      const progressivelyFiltered = (stopBefore?: keyof typeof filter) =>
        searched.filter((row) => {
          if (stopBefore === "typeId") return true;
          if (filter.typeId && row.typeId !== filter.typeId) return false;
          if (stopBefore === "categoryId") return true;
          if (filter.categoryId && row.categoryId !== filter.categoryId) return false;
          if (stopBefore === "subCategoryId") return true;
          if (filter.subCategoryId && row.subCategoryId !== filter.subCategoryId) return false;
          if (stopBefore === "coreProductId") return true;
          if (filter.coreProductId && row.coreProductId !== filter.coreProductId) return false;
          if (stopBefore === "brandId") return true;
          if (filter.brandId && row.brandId !== filter.brandId) return false;
          if (stopBefore === "pack") return true;
          if (filter.pack && row.pack !== filter.pack) return false;
          return true;
        });

      const unique = <T extends { id: number }>(values: T[]) =>
        [...new Map(values.map((value) => [value.id, value])).values()].sort((a, b) =>
          String((a as T & { name: string }).name).localeCompare(String((b as T & { name: string }).name)),
        );

      return {
        variants: progressivelyFiltered().sort((a, b) =>
          a.productName.localeCompare(b.productName),
        ),
        options: {
          types: unique(
            progressivelyFiltered("typeId").map((row) => ({ id: row.typeId, name: row.typeName })),
          ),
          categories: unique(
            progressivelyFiltered("categoryId").map((row) => ({
              id: row.categoryId,
              name: row.categoryName,
              typeId: row.typeId,
            })),
          ),
          subCategories: unique(
            progressivelyFiltered("subCategoryId")
              .filter((row) => row.subCategoryId !== null)
              .map((row) => ({
                id: row.subCategoryId as number,
                name: row.subCategoryName,
                categoryId: row.categoryId,
              })),
          ),
          coreProducts: unique(
            progressivelyFiltered("coreProductId")
              .filter((row) => row.coreProductId !== null)
              .map((row) => ({
                id: row.coreProductId as number,
                name: row.coreProductName,
                subCategoryId: row.subCategoryId,
              })),
          ),
          brands: unique(
            progressivelyFiltered("brandId")
              .filter((row) => row.brandId !== null)
              .map((row) => ({ id: row.brandId as number, name: row.brandName })),
          ),
          packs: [...new Set(progressivelyFiltered("pack").map((row) => row.pack))].sort(),
        },
      };
    }),

  searchCustomers: shopModuleProcedure("sales")
    .route({
      method: "GET",
      path: "/retailer-pos/customers",
      tags: ["Retailer POS"],
      summary: "Search the shop customer book",
    })
    .input(z.object({ search: z.string().trim().max(100).optional() }).optional())
    .handler(async ({ context, input }) => {
      const shopId = context.session.user.id;
      const term = input?.search?.toLocaleLowerCase();
      const localCustomers = await db.query.warehousePosCustomer.findMany({
        where: eq(posCustomer.shopId, shopId),
        orderBy: [desc(posCustomer.isDefault), desc(posCustomer.createdAt)],
      });
      const onlineCustomers = await db
        .select({
          linkedUserId: order.userId,
          name: order.shippingName,
          phone: order.shippingPhone,
          address: order.shippingAddress,
          lastOrderAt: sql<Date>`max(${order.createdAt})`,
        })
        .from(order)
        .where(and(eq(order.shopId, shopId), eq(order.orderType, "b2c")))
        .groupBy(order.userId, order.shippingName, order.shippingPhone, order.shippingAddress);

      const byPhone = new Map<string, {
        key: string;
        id: number | null;
        linkedUserId: string | null;
        name: string;
        phone: string | null;
        address: string | null;
        isDefault: boolean;
        source: "pos" | "online" | "both";
      }>();
      for (const customer of localCustomers) {
        const key = customer.normalizedPhone || `pos:${customer.id}`;
        byPhone.set(key, {
          key: `pos:${customer.id}`,
          id: customer.id,
          linkedUserId: customer.linkedUserId,
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          isDefault: customer.isDefault,
          source: "pos",
        });
      }
      for (const customer of onlineCustomers) {
        const normalized = normalizePosPhone(customer.phone) || `consumer:${customer.linkedUserId}`;
        const existing = byPhone.get(normalized);
        if (existing) {
          existing.linkedUserId ||= customer.linkedUserId;
          existing.source = "both";
        } else {
          byPhone.set(normalized, {
            key: `consumer:${customer.linkedUserId}`,
            id: null,
            linkedUserId: customer.linkedUserId,
            name: customer.name,
            phone: customer.phone,
            address: customer.address,
            isDefault: false,
            source: "online",
          });
        }
      }
      const customers = [...byPhone.values()].filter((customer) =>
        !term || [customer.name, customer.phone, customer.address].some((value) =>
          value?.toLocaleLowerCase().includes(term),
        ),
      );

      return { customers: customers.slice(0, 100) };
    }),

  createCustomer: shopModuleProcedure("sales")
    .route({
      method: "POST",
      path: "/retailer-pos/customers",
      tags: ["Retailer POS"],
      summary: "Create or reuse a shop POS Customer",
    })
    .input(z.object({
      name: z.string().trim().min(2).max(150),
      phone: z.string().trim().min(7).max(30),
      address: z.string().trim().max(500).optional(),
      linkedUserId: z.string().optional(),
    }))
    .handler(async ({ context, input }) => {
      if (input.linkedUserId) {
        const relationship = await db.query.order.findFirst({
          where: and(
            eq(order.shopId, context.session.user.id),
            eq(order.userId, input.linkedUserId),
            eq(order.orderType, "b2c"),
          ),
          columns: { id: true },
        });
        if (!relationship) {
          throw new ORPCError("NOT_FOUND", { message: "Consumer has no order relationship with this shop" });
        }
      }
      return { customer: await findOrCreatePosCustomer({
        owner: shopOwner(context),
        actorId: context.session.user.id,
        ...input,
      }) };
    }),

  getCustomerDetail: shopModuleProcedure("sales")
    .route({
      method: "GET",
      path: "/retailer-pos/customers/{customerKey}",
      tags: ["Retailer POS"],
      summary: "Get a shop-scoped unified customer history",
    })
    .input(z.object({ customerKey: z.string().trim().min(3).max(160) }))
    .handler(async ({ context, input }) => {
      const shopId = context.session.user.id;
      const [kind, rawId] = input.customerKey.split(":", 2);
      let customer: {
        key: string;
        id: number | null;
        linkedUserId: string | null;
        name: string;
        phone: string | null;
        address: string | null;
        isDefault: boolean;
        source: "pos" | "online" | "both";
      };

      if (kind === "pos") {
        const customerId = Number(rawId);
        if (!Number.isInteger(customerId) || customerId <= 0) {
          throw new ORPCError("BAD_REQUEST", { message: "Invalid POS Customer" });
        }
        const owned = await getOwnedPosCustomer(shopId, customerId);
        let linkedUserId = owned.linkedUserId;
        if (!linkedUserId && owned.phone) {
          const relatedConsumers = await db
            .select({ userId: order.userId, phone: order.shippingPhone })
            .from(order)
            .where(and(eq(order.shopId, shopId), eq(order.orderType, "b2c")));
          linkedUserId = relatedConsumers.find(
            (candidate) =>
              normalizePosPhone(candidate.phone) === normalizePosPhone(owned.phone),
          )?.userId ?? null;
        }
        customer = {
          key: input.customerKey,
          id: owned.id,
          linkedUserId,
          name: owned.name,
          phone: owned.phone,
          address: owned.address,
          isDefault: owned.isDefault,
          source: linkedUserId ? "both" : "pos",
        };
      } else if (kind === "consumer" && rawId) {
        const relatedOrder = await db.query.order.findFirst({
          where: and(
            eq(order.shopId, shopId),
            eq(order.orderType, "b2c"),
            eq(order.userId, rawId),
          ),
          orderBy: [desc(order.createdAt)],
        });
        if (!relatedOrder) {
          throw new ORPCError("NOT_FOUND", { message: "Customer not found" });
        }
        customer = {
          key: input.customerKey,
          id: null,
          linkedUserId: rawId,
          name: relatedOrder.shippingName,
          phone: relatedOrder.shippingPhone,
          address: relatedOrder.shippingAddress,
          isDefault: false,
          source: "online",
        };
      } else {
        throw new ORPCError("BAD_REQUEST", { message: "Invalid customer reference" });
      }

      const posConditions: SQL[] = [eq(posSale.shopId, shopId)];
      if (customer.id) {
        posConditions.push(eq(posSale.customerId, customer.id));
      } else if (customer.linkedUserId) {
        const linkedCustomers = await db.query.warehousePosCustomer.findMany({
          where: and(
            eq(posCustomer.shopId, shopId),
            eq(posCustomer.linkedUserId, customer.linkedUserId),
          ),
          columns: { id: true },
        });
        const linkedIds = linkedCustomers.map((row) => row.id);
        if (linkedIds.length === 0) {
          posConditions.push(sql`false`);
        } else {
          posConditions.push(inArray(posSale.customerId, linkedIds));
        }
      }
      const posSales = await db.query.warehousePosSale.findMany({
        where: and(...posConditions),
        orderBy: [desc(posSale.createdAt)],
        limit: 50,
      });

      const onlineSales = customer.linkedUserId
        ? await db
            .select({
              invoiceNo: invoice.invoiceNumber,
              orderNumber: order.orderNumber,
              total: invoice.grandTotal,
              paymentStatus: invoice.paymentStatus,
              createdAt: invoice.createdAt,
            })
            .from(invoice)
            .innerJoin(order, eq(invoice.orderId, order.id))
            .where(and(
              eq(order.shopId, shopId),
              eq(order.userId, customer.linkedUserId),
              eq(order.orderType, "b2c"),
              eq(order.status, "delivered"),
            ))
            .orderBy(desc(invoice.createdAt))
            .limit(50)
        : [];

      const payments = customer.id
        ? await db
            .select({
              id: posPayment.id,
              saleId: posPayment.saleId,
              entryType: posPayment.entryType,
              paymentMethod: posPayment.paymentMethod,
              amount: posPayment.amount,
              transactionRef: posPayment.transactionRef,
              paidAt: posPayment.paidAt,
            })
            .from(posPayment)
            .innerJoin(posSale, eq(posPayment.saleId, posSale.id))
            .where(and(eq(posSale.shopId, shopId), eq(posSale.customerId, customer.id)))
            .orderBy(desc(posPayment.paidAt))
            .limit(50)
        : [];

      return {
        customer,
        posSales,
        onlineSales,
        payments,
        summary: {
          counterPurchases: posSales.length,
          onlinePurchases: onlineSales.length,
          lifetimeValue: money(
            posSales
              .filter((sale) => sale.status !== "cancelled")
              .reduce((sum, sale) => sum + numeric(sale.total), 0) +
              onlineSales.reduce((sum, sale) => sum + numeric(sale.total), 0),
          ),
          outstanding: money(
            posSales
              .filter((sale) => sale.status !== "cancelled")
              .reduce((sum, sale) => sum + numeric(sale.due), 0),
          ),
        },
      };
    }),

  listHeldCarts: shopModuleProcedure("sales")
    .route({ method: "GET", path: "/retailer-pos/held-carts", tags: ["Retailer POS"] })
    .input(z.object({}).optional())
    .handler(async ({ context }) => ({
      carts: await db.query.warehousePosCart.findMany({
        where: and(eq(posCart.shopId, context.session.user.id), eq(posCart.status, "held")),
        with: { customer: true },
        orderBy: [desc(posCart.createdAt)],
        limit: 40,
      }),
    })),

  holdCart: shopModuleProcedure("sales")
    .route({ method: "POST", path: "/retailer-pos/held-carts", tags: ["Retailer POS"] })
    .input(z.object({
      customerId: z.number().int().positive().optional(),
      discount: adjustmentSchema.optional(),
      tax: adjustmentSchema.optional(),
      note: z.string().trim().max(500).optional(),
      items: z.array(cartItemSchema).min(1),
    }))
    .handler(async ({ context, input }) => {
      const owner = shopOwner(context);
      if (input.customerId) await getOwnedPosCustomer(owner.id, input.customerId);
      const lines = await resolveOwnerPosSaleLines(owner, input.items);
      assertExpectedPrices(input.items, lines);
      const totals = calculateRetailerCheckout({
        lines,
        discount: input.discount,
        tax: input.tax,
      });
      const [cart] = await db.insert(posCart).values({
        ...ownerColumns(owner),
        customerId: input.customerId ?? null,
        heldRef: createHeldCartReference(),
        cartData: {
          saleType: "retail",
          items: lines.map((line) => ({
            ...line,
            quantity: money(line.quantity),
            unitPrice: money(line.unitPrice),
            lineTotal: money(line.lineTotal),
          })),
          discount: adjustmentOrDefault(input.discount),
          tax: adjustmentOrDefault(input.tax),
          note: input.note || null,
        },
        subtotal: money(totals.subtotal),
        discount: money(totals.discount),
        tax: money(totals.tax),
        total: money(totals.total),
        heldById: owner.id,
      }).returning();
      return { cart };
    }),

  cancelHeldCart: shopModuleProcedure("sales")
    .route({ method: "DELETE", path: "/retailer-pos/held-carts/{cartId}", tags: ["Retailer POS"] })
    .input(z.object({ cartId: z.number().int().positive() }))
    .handler(async ({ context, input }) => {
      const owner = shopOwner(context);
      const [cart] = await db.update(posCart).set({ status: "cancelled" }).where(and(
        eq(posCart.id, input.cartId),
        posCartOwnerCondition(owner),
        eq(posCart.status, "held"),
      )).returning({ id: posCart.id, status: posCart.status });
      if (!cart) throw new ORPCError("NOT_FOUND", { message: "Held Cart not found" });
      return { cart };
    }),

  completeSale: shopModuleProcedure("sales")
    .route({ method: "POST", path: "/retailer-pos/sales", tags: ["Retailer POS"] })
    .input(z.object({
      checkoutRequestId: z.string().trim().min(8).max(80),
      customerId: z.number().int().positive().optional(),
      paymentMethod: paymentMethodSchema,
      tenderedAmount: z.number().nonnegative(),
      transactionRef: z.string().trim().max(100).optional(),
      discount: adjustmentSchema.optional(),
      tax: adjustmentSchema.optional(),
      note: z.string().trim().max(500).optional(),
      heldCartId: z.number().int().positive().optional(),
      items: z.array(cartItemSchema).min(1),
    }))
    .handler(async ({ context, input }) => {
      const owner = shopOwner(context);
      const duplicate = await db.query.warehousePosSale.findFirst({
        where: and(saleOwnerCondition(owner.id), eq(posSale.checkoutRequestId, input.checkoutRequestId)),
      });
      if (duplicate) return { saleId: duplicate.id, invoiceNo: duplicate.invoiceNo, duplicate: true };

      const customer = input.customerId
        ? await getOwnedPosCustomer(owner.id, input.customerId)
        : await ensurePosWalkInCustomer(owner, owner.id);
      if (input.heldCartId) {
        const heldCart = await db.query.warehousePosCart.findFirst({
          where: and(
            eq(posCart.id, input.heldCartId),
            eq(posCart.shopId, owner.id),
            eq(posCart.status, "held"),
          ),
          columns: { id: true },
        });
        if (!heldCart) {
          throw new ORPCError("NOT_FOUND", { message: "Held Cart not found or already completed" });
        }
      }
      const lines = await resolveOwnerPosSaleLines(owner, input.items);
      assertExpectedPrices(input.items, lines);
      const manualTotals = calculateRetailerCheckout({
        lines,
        discount: input.discount,
        tax: input.tax,
        tenderedAmount: input.tenderedAmount,
      });
      const automaticOffer = await evaluateRetailerOffer({
        shopId: owner.id,
        lines,
        customerKey: `pos:${customer.id}`,
      });
      const appliedOffer =
        automaticOffer && automaticOffer.discountAmount >= manualTotals.discount
          ? automaticOffer
          : null;
      const checkoutDiscount = appliedOffer
        ? { mode: "fixed" as const, value: appliedOffer.discountAmount }
        : input.discount;
      const offerTotals = calculateRetailerCheckout({
        lines,
        discount: checkoutDiscount,
        tax: input.tax,
      });
      const effectiveTenderedAmount =
        appliedOffer && input.paymentMethod !== "cash"
          ? Math.min(input.tenderedAmount, offerTotals.total)
          : input.tenderedAmount;
      const totals = calculateRetailerCheckout({
        lines,
        discount: checkoutDiscount,
        tax: input.tax,
        tenderedAmount: effectiveTenderedAmount,
      });
      try {
        validatePosDueCustomer(customer, totals);
      } catch (error) {
        throw new ORPCError("BAD_REQUEST", {
          message: error instanceof Error ? error.message : "Named customer required for Due sale",
        });
      }
      if (input.paymentMethod !== "cash" && totals.change > 0) {
        throw new ORPCError("BAD_REQUEST", { message: "Non-cash payment cannot exceed the sale total" });
      }

      const invoiceNo = await nextRetailerReceiptNumber();
      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.checkoutRequestId}))`);
        const concurrentDuplicate = await tx.query.warehousePosSale.findFirst({
          where: and(
            eq(posSale.shopId, owner.id),
            eq(posSale.checkoutRequestId, input.checkoutRequestId),
          ),
        });
        if (concurrentDuplicate) {
          return { sale: concurrentDuplicate, duplicate: true };
        }
        for (const line of lines) {
          const updated = await tx.update(inventory).set({
            availableQty: sql`CAST(${inventory.availableQty} AS numeric) - ${line.quantity}`,
          }).where(and(
            eq(inventory.ownerType, "shop"),
            eq(inventory.ownerId, owner.id),
            eq(inventory.variantId, line.variantId),
            sql`CAST(${inventory.availableQty} AS numeric) >= ${line.quantity}`,
          )).returning({ id: inventory.id });
          if (updated.length === 0) {
            throw new ORPCError("CONFLICT", {
              message: `Stock changed before checkout for ${line.productName}. Refresh the cart.`,
            });
          }
        }

        const discount = adjustmentOrDefault(checkoutDiscount);
        const tax = adjustmentOrDefault(input.tax);
        const [created] = await tx.insert(posSale).values({
          ...ownerColumns(owner),
          saleType: "retail",
          invoiceNo,
          checkoutRequestId: input.checkoutRequestId,
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerAddress: customer.address,
          subtotal: money(totals.subtotal),
          discount: money(totals.discount),
          discountMode: discount.mode,
          discountValue: money(discount.value),
          tax: money(totals.tax),
          taxMode: tax.mode,
          taxValue: money(tax.value),
          total: money(totals.total),
          paid: money(totals.paid),
          due: money(totals.due),
          tenderedAmount: money(effectiveTenderedAmount),
          changeAmount: money(totals.change),
          paymentMethod: totals.paid === 0 ? "due" : input.paymentMethod,
          note: input.note || null,
          heldCartId: input.heldCartId ?? null,
          soldById: owner.id,
        }).returning();
        if (!created) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Sale was not created" });

        await tx.insert(posSaleItem).values(lines.map((line) => ({
          saleId: created.id,
          variantId: line.variantId,
          productId: line.productId,
          sku: line.sku,
          productName: line.productName,
          variantLabel: line.variantLabel,
          quantity: money(line.quantity),
          unitLabel: line.unitLabel,
          unitPrice: money(line.unitPrice),
          lineTotal: money(line.lineTotal),
        })));
        if (appliedOffer) {
          await tx.insert(retailerOfferApplication).values({
            retailerOfferId: appliedOffer.offerId,
            shopId: owner.id,
            posSaleId: created.id,
            customerKey: `pos:${customer.id}`,
            discountAmount: money(appliedOffer.discountAmount),
            salesAmount: money(appliedOffer.salesAmount),
          });
        }
        if (totals.paid > 0) {
          await tx.insert(posPayment).values({
            saleId: created.id,
            entryType: "payment",
            idempotencyKey: `checkout:${input.checkoutRequestId}`,
            paymentMethod: input.paymentMethod,
            amount: money(totals.paid),
            tenderedAmount: money(effectiveTenderedAmount),
            transactionRef: input.transactionRef || null,
            createdById: owner.id,
          });
        }
        if (input.heldCartId) {
          await tx.update(posCart).set({ status: "converted" }).where(and(
            eq(posCart.id, input.heldCartId),
            eq(posCart.shopId, owner.id),
            eq(posCart.status, "held"),
          ));
        }
        return { sale: created, duplicate: false };
      });

      return {
        saleId: result.sale.id,
        invoiceNo: result.sale.invoiceNo,
        duplicate: result.duplicate,
        totals,
        appliedOffer,
      };
    }),

  getSale: shopModuleProcedure("sales")
    .route({ method: "GET", path: "/retailer-pos/sales/{saleId}", tags: ["Retailer POS"] })
    .input(z.object({ saleId: z.number().int().positive() }))
    .handler(async ({ context, input }) => {
      const sale = await db.query.warehousePosSale.findFirst({
        where: and(eq(posSale.id, input.saleId), saleOwnerCondition(context.session.user.id)),
        with: {
          items: { orderBy: [posSaleItem.id] },
          payments: { orderBy: [posPayment.paidAt] },
          soldBy: { columns: { id: true, name: true } },
          voidedBy: { columns: { id: true, name: true } },
        },
      });
      if (!sale) throw new ORPCError("NOT_FOUND", { message: "POS Sale not found" });
      return {
        sale,
        shop: {
          name: context.session.user.shopName || context.session.user.name,
          ownerName: context.session.user.ownerName || context.session.user.name,
          address: context.session.user.shopAddress || null,
          phone: context.session.user.phoneNumber || null,
        },
      };
    }),

  listSales: shopModuleProcedure("sales")
    .route({ method: "GET", path: "/retailer-pos/sales", tags: ["Retailer POS"] })
    .input(z.object({
      search: z.string().trim().max(100).optional(),
      source: z.enum(["all", "pos", "online"]).default("all"),
      status: z.enum(["all", "completed", "due", "cancelled"]).default("all"),
      payment: z.enum(["all", "cash", "bkash", "nagad", "bank", "due"]).default("all"),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      page: z.number().int().positive().default(1),
      limit: z.number().int().min(1).max(100).default(20),
    }).optional())
    .handler(async ({ context, input }) => {
      const filter = input ?? { source: "all" as const, status: "all" as const, payment: "all" as const, page: 1, limit: 20 };
      const shopId = context.session.user.id;
      const start = parseDate(filter.dateFrom);
      const end = parseDate(filter.dateTo, true);
      const posConditions: SQL[] = [eq(posSale.shopId, shopId)];
      if (start) posConditions.push(gte(posSale.createdAt, start));
      if (end) posConditions.push(lte(posSale.createdAt, end));
      const posRows = filter.source === "online" ? [] : await db.query.warehousePosSale.findMany({
        where: and(...posConditions),
        orderBy: [desc(posSale.createdAt)],
      });

      const onlineConditions: SQL[] = [
        eq(order.shopId, shopId),
        eq(order.orderType, "b2c"),
        eq(order.status, "delivered"),
      ];
      if (start) onlineConditions.push(gte(invoice.createdAt, start));
      if (end) onlineConditions.push(lte(invoice.createdAt, end));
      const onlineRows = filter.source === "pos" ? [] : await db.select({
        id: invoice.id,
        invoiceNo: invoice.invoiceNumber,
        createdAt: invoice.createdAt,
        customerName: order.shippingName,
        customerPhone: order.shippingPhone,
        total: invoice.grandTotal,
        paymentStatus: invoice.paymentStatus,
        paymentMethod: order.paymentMethod,
        orderNumber: order.orderNumber,
      }).from(invoice).innerJoin(order, eq(invoice.orderId, order.id)).where(and(...onlineConditions));

      const rows = [
        ...posRows.map((sale) => ({
          key: `pos:${sale.id}`,
          kind: "pos" as const,
          id: sale.id,
          invoiceNo: sale.invoiceNo,
          date: sale.createdAt,
          customerName: sale.customerName,
          customerPhone: sale.customerPhone,
          total: numeric(sale.total),
          paid: numeric(sale.paid),
          due: sale.status === "cancelled" ? 0 : numeric(sale.due),
          paymentMethod: sale.paymentMethod,
          paymentLabel: paymentLabel(sale.paymentMethod),
          status: sale.status === "cancelled" ? "cancelled" : numeric(sale.due) > 0 ? "due" : "completed",
          source: "pos" as const,
          sourceLabel: "Counter Sale",
          sourceRef: null,
        })),
        ...onlineRows.map((row) => ({
          key: `online:${row.id}`,
          kind: "online" as const,
          id: row.id,
          invoiceNo: row.invoiceNo,
          date: row.createdAt,
          customerName: row.customerName,
          customerPhone: row.customerPhone,
          total: numeric(row.total),
          paid: row.paymentStatus === "unpaid" ? 0 : numeric(row.total),
          due: row.paymentStatus === "unpaid" ? numeric(row.total) : 0,
          paymentMethod: row.paymentMethod,
          paymentLabel: paymentLabel(row.paymentMethod),
          status: row.paymentStatus === "unpaid" ? "due" : "completed",
          source: "online" as const,
          sourceLabel: "Online Order",
          sourceRef: row.orderNumber,
        })),
      ].filter((row) => {
        if (filter.status !== "all" && row.status !== filter.status) return false;
        if (filter.payment !== "all") {
          if (filter.payment === "due" && row.due <= 0) return false;
          if (filter.payment !== "due" && row.paymentMethod !== filter.payment && !(filter.payment === "bank" && row.paymentMethod === "bank_transfer")) return false;
        }
        const term = filter.search?.toLocaleLowerCase();
        return !term || [row.invoiceNo, row.customerName, row.customerPhone, row.sourceRef].some((value) => value?.toLocaleLowerCase().includes(term));
      }).sort((a, b) => b.date.getTime() - a.date.getTime());

      const page = filter.page ?? 1;
      const limit = filter.limit ?? 20;
      return {
        rows: rows.slice((page - 1) * limit, page * limit),
        pagination: { page, limit, total: rows.length, pages: Math.max(1, Math.ceil(rows.length / limit)) },
        summary: {
          count: rows.length,
          total: money(rows.filter((row) => row.status !== "cancelled").reduce((sum, row) => sum + row.total, 0)),
          paid: money(rows.reduce((sum, row) => sum + row.paid, 0)),
          due: money(rows.reduce((sum, row) => sum + row.due, 0)),
        },
      };
    }),

  listReceivables: shopModuleProcedure("sales")
    .route({ method: "GET", path: "/retailer-pos/receivables", tags: ["Retailer POS"] })
    .input(z.object({ search: z.string().trim().max(100).optional() }).optional())
    .handler(async ({ context, input }) => {
      const term = input?.search?.trim();
      const conditions: SQL[] = [
        eq(posSale.shopId, context.session.user.id),
        eq(posSale.status, "completed"),
        sql`CAST(${posSale.due} AS numeric) > 0`,
      ];
      if (term) {
        const search = or(
          ilike(posSale.invoiceNo, `%${term}%`),
          ilike(posSale.customerName, `%${term}%`),
          ilike(posSale.customerPhone, `%${term}%`),
        );
        if (search) conditions.push(search);
      }
      const rows = await db.select({
        saleId: posSale.id,
        invoiceNo: posSale.invoiceNo,
        customerId: posSale.customerId,
        customerName: posSale.customerName,
        customerPhone: posSale.customerPhone,
        total: posSale.total,
        paid: posSale.paid,
        due: posSale.due,
        createdAt: posSale.createdAt,
      }).from(posSale).where(and(...conditions)).orderBy(desc(posSale.createdAt));
      return {
        rows,
        summary: {
          customers: new Set(rows.map((row) => row.customerId)).size,
          receipts: rows.length,
          due: money(rows.reduce((sum, row) => sum + numeric(row.due), 0)),
        },
      };
    }),

  collectDue: shopModuleProcedure("sales")
    .route({ method: "POST", path: "/retailer-pos/receivables/{saleId}/payments", tags: ["Retailer POS"] })
    .input(z.object({
      saleId: z.number().int().positive(),
      idempotencyKey: z.string().trim().min(8).max(80),
      amount: z.number().positive(),
      paymentMethod: paymentMethodSchema,
      transactionRef: z.string().trim().max(100).optional(),
      note: z.string().trim().max(500).optional(),
    }))
    .handler(async ({ context, input }) => {
      const shopId = context.session.user.id;
      const prior = await db.query.warehousePosPayment.findFirst({
        where: eq(posPayment.idempotencyKey, input.idempotencyKey),
      });
      if (prior) {
        const sale = await db.query.warehousePosSale.findFirst({
          where: and(eq(posSale.id, prior.saleId), eq(posSale.shopId, shopId)),
        });
        if (!sale) throw new ORPCError("NOT_FOUND", { message: "Payment not found" });
        return { paid: sale.paid, due: sale.due, duplicate: true };
      }

      return db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.saleId})`);
        const sale = await tx.query.warehousePosSale.findFirst({
          where: and(eq(posSale.id, input.saleId), eq(posSale.shopId, shopId)),
        });
        if (!sale) throw new ORPCError("NOT_FOUND", { message: "POS Sale not found" });
        if (sale.status !== "completed") throw new ORPCError("BAD_REQUEST", { message: "Cancelled sales cannot receive payment" });
        const due = numeric(sale.due);
        if (due <= 0) throw new ORPCError("BAD_REQUEST", { message: "This sale has no Outstanding Balance" });
        if (input.amount > due) throw new ORPCError("BAD_REQUEST", { message: `Amount exceeds the Outstanding Balance of BDT ${money(due)}` });
        const nextPaid = numeric(sale.paid) + input.amount;
        const nextDue = due - input.amount;
        await tx.insert(posPayment).values({
          saleId: sale.id,
          entryType: "payment",
          idempotencyKey: input.idempotencyKey,
          paymentMethod: input.paymentMethod,
          amount: money(input.amount),
          tenderedAmount: money(input.amount),
          transactionRef: input.transactionRef || null,
          note: input.note || null,
          createdById: shopId,
        });
        await tx.update(posSale).set({ paid: money(nextPaid), due: money(nextDue) }).where(eq(posSale.id, sale.id));
        return { paid: money(nextPaid), due: money(nextDue), duplicate: false };
      });
    }),

  voidSale: shopModuleProcedure("sales")
    .route({ method: "POST", path: "/retailer-pos/sales/{saleId}/void", tags: ["Retailer POS"] })
    .input(z.object({ saleId: z.number().int().positive(), reason: z.string().trim().min(5).max(500) }))
    .handler(async ({ context, input }) => {
      const shopId = context.session.user.id;
      return db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.saleId})`);
        const sale = await tx.query.warehousePosSale.findFirst({
          where: and(eq(posSale.id, input.saleId), eq(posSale.shopId, shopId)),
          with: { items: true, payments: true },
        });
        if (!sale) throw new ORPCError("NOT_FOUND", { message: "POS Sale not found" });
        if (sale.status === "cancelled") return { success: true, duplicate: true };
        for (const item of sale.items) {
          if (!item.variantId) continue;
          await tx.update(inventory).set({
            availableQty: sql`CAST(${inventory.availableQty} AS numeric) + ${numeric(item.quantity)}`,
          }).where(and(
            eq(inventory.ownerType, "shop"),
            eq(inventory.ownerId, shopId),
            eq(inventory.variantId, item.variantId),
          ));
        }
        for (const payment of sale.payments.filter((entry) => entry.entryType === "payment")) {
          await tx.insert(posPayment).values({
            saleId: sale.id,
            entryType: "reversal",
            reversesPaymentId: payment.id,
            paymentMethod: payment.paymentMethod,
            amount: payment.amount,
            transactionRef: payment.transactionRef,
            note: `Sale Void: ${input.reason}`,
            createdById: shopId,
          });
        }
        await tx.update(posSale).set({
          status: "cancelled",
          due: "0.00",
          voidReason: input.reason,
          voidedById: shopId,
          voidedAt: new Date(),
        }).where(eq(posSale.id, sale.id));
        await tx
          .delete(retailerOfferApplication)
          .where(eq(retailerOfferApplication.posSaleId, sale.id));
        return { success: true, duplicate: false };
      });
    }),
};
