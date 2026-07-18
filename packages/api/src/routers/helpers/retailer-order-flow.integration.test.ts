import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const runDatabaseIntegration =
  process.env.RUN_RETAILER_ORDER_DB_TEST === "1";

type ProcedureLike = {
  "~orpc": {
    handler(args: { context: unknown; input: unknown }): Promise<unknown>;
  };
};

async function invokeProcedure<Result>(
  procedure: unknown,
  context: unknown,
  input: unknown,
) {
  return (procedure as ProcedureLike)["~orpc"].handler({
    context,
    input,
  }) as Promise<Result>;
}

test(
  "runs direct-retailer fulfillment and returns a winning open order to confirmation",
  { skip: !runDatabaseIntegration },
  async () => {
    const [{ db }, schema, drizzle, customerModule, shopOwnerModule, deliverymanModule, matchingModule, stockModule] =
      await Promise.all([
        import("@bikalpo-project/db"),
        import("@bikalpo-project/db/schema"),
        import("drizzle-orm"),
        import("../customer"),
        import("../shop-owner"),
        import("../deliveryman"),
        import("../../services/open-order-matching"),
        import("./retailer-order-stock"),
      ]);
    const {
      cart,
      cartItem,
      category,
      deliveryGroup,
      deliveryGroupInvoice,
      inventory,
      invoice,
      openOrderBid,
      order,
      orderItem,
      product,
      productVariant,
      user,
    } = schema;
    const { and, eq } = drizzle;
    const { customerRouter } = customerModule;
    const { shopOwnerRouter } = shopOwnerModule;
    const { deliverymanRouter } = deliverymanModule;
    const { selectWinner } = matchingModule;
    const {
      createRetailerOrderStockWriter,
      deductRetailerOrderStock,
      RetailerOrderStockError,
    } = stockModule;

    const suffix = randomUUID();
    const consumerId = `retailer-flow-consumer-${suffix}`;
    const shopId = `retailer-flow-shop-${suffix}`;
    const productSlug = `retailer-flow-product-${suffix}`;
    const riderId = `retailer-flow-rider-${suffix}`;
    const rollbackOrderNumber = `TEST-ROLLBACK-${suffix}`;
    let productId: number | null = null;
    let inventoryId: number | null = null;

    const consumerContext = {
      session: { user: { id: consumerId, role: "consumer" } },
    };
    const shopContext = {
      session: { user: { id: shopId, role: "shop_owner" } },
    };
    const shippingInfo = {
      name: "Retailer Flow Test",
      phone: "01700000000",
      address: "Integration test address",
      city: "Dhaka",
    };

    try {
      const [categoryRow] = await db.select({ id: category.id }).from(category).limit(1);
      assert.ok(categoryRow, "A category fixture is required");

      await db.insert(user).values([
        {
          id: consumerId,
          name: "Retailer Flow Consumer",
          email: `${consumerId}@example.test`,
          role: "consumer",
        },
        {
          id: shopId,
          name: "Retailer Flow Shop",
          email: `${shopId}@example.test`,
          role: "shop_owner",
          isSeller: true,
          sellerStatus: "approved",
          shopName: "Retailer Flow Shop",
          shopSlug: `retailer-flow-shop-${suffix}`,
        },
      ]);

      const [productRow] = await db
        .insert(product)
        .values({
          name: "Retailer Flow Product",
          slug: productSlug,
          categoryId: categoryRow.id,
          size: "1 unit",
          price: "90.00",
          image: "/placeholder.svg",
          inStock: false,
          status: "active",
          visibility: "public",
          creatorSource: "shop",
          createdById: shopId,
        })
        .returning({ id: product.id });
      assert.ok(productRow);
      const testProductId = productRow.id;
      productId = testProductId;

      const [variantRow] = await db
        .insert(productVariant)
        .values({
          productId: testProductId,
          unitLabel: "Unit",
          quantitySelectorLabel: "1 unit",
          packagingType: "unit",
          weightKg: "1.00",
          price: "90.00",
          variantType: "retail",
          orderType: "b2c",
          visibilityRole: "consumer",
          stockSource: "shop",
          orderMin: "1.00",
          orderMax: "2.00",
          orderIncrement: "1.00",
          isActive: true,
        })
        .returning({ id: productVariant.id });
      assert.ok(variantRow);
      const testVariantId = variantRow.id;

      const [inventoryRow] = await db
        .insert(inventory)
        .values({
          ownerType: "shop",
          ownerId: shopId,
          variantId: testVariantId,
          availableQty: "2.00",
          reservedQty: "0.00",
          retailPrice: "100.00",
        })
        .returning({ id: inventory.id });
      assert.ok(inventoryRow);
      const testInventoryId = inventoryRow.id;
      inventoryId = testInventoryId;

      // The order and its first stock mutation must roll back when a later
      // conditional deduction loses stock.
      await assert.rejects(
        db.transaction(async (tx) => {
          const [createdOrder] = await tx
            .insert(order)
            .values({
              orderNumber: rollbackOrderNumber,
              userId: consumerId,
              orderType: "b2c",
              shopId,
              subtotal: "300.00",
              total: "300.00",
              shippingName: shippingInfo.name,
              shippingPhone: shippingInfo.phone,
              shippingAddress: shippingInfo.address,
              shippingCity: shippingInfo.city,
            })
            .returning({ id: order.id });
          assert.ok(createdOrder);
          await tx.insert(orderItem).values({
            orderId: createdOrder.id,
            productId: testProductId,
            variantId: testVariantId,
            productName: "Retailer Flow Product",
            productImage: "/placeholder.svg",
            productSize: "1 unit",
            quantity: 1,
            inventoryQty: "1.00",
            unitPrice: "100.00",
            totalPrice: "100.00",
          });
          await deductRetailerOrderStock(
            createRetailerOrderStockWriter(tx),
            shopId,
            [
              {
                productId: testProductId,
                variantId: testVariantId,
                productName: "first line",
                quantity: 1,
              },
              {
                productId: testProductId,
                variantId: testVariantId,
                productName: "concurrent-loss line",
                quantity: 2,
              },
            ],
          );
        }),
        RetailerOrderStockError,
      );
      assert.equal(
        await db.query.order.findFirst({
          where: eq(order.orderNumber, rollbackOrderNumber),
        }),
        undefined,
      );
      assert.equal(
        (
          await db.query.inventory.findFirst({
            where: eq(inventory.id, testInventoryId),
          })
        )?.availableQty,
        "2.00",
      );

      const addInput = {
        productId: testProductId,
        variantId: testVariantId,
        shopId,
        quantity: 1,
      };
      await invokeProcedure(customerRouter.addToCart, consumerContext, addInput);
      const firstPlacement = await invokeProcedure<{
        order: { id: number };
      }>(customerRouter.placeOrder, consumerContext, {
        shippingInfo,
        paymentMethod: "cash_on_delivery",
      });
      const firstOrder = await db.query.order.findFirst({
        where: eq(order.id, firstPlacement.order.id),
        with: { items: true },
      });
      assert.equal(firstOrder?.shopId, shopId);
      assert.equal(Number(firstOrder?.items[0]?.unitPrice), 100);
      assert.equal(
        (
          await db.query.inventory.findFirst({
            where: eq(inventory.id, testInventoryId),
          })
        )?.availableQty,
        "1.00",
      );

      await invokeProcedure(customerRouter.cancelOrder, consumerContext, {
        orderId: firstPlacement.order.id,
      });
      assert.equal(
        (
          await db.query.inventory.findFirst({
            where: eq(inventory.id, testInventoryId),
          })
        )?.availableQty,
        "2.00",
      );

      await invokeProcedure(customerRouter.addToCart, consumerContext, addInput);
      const secondPlacement = await invokeProcedure<{
        order: { id: number };
      }>(customerRouter.placeOrder, consumerContext, {
        shippingInfo,
        paymentMethod: "cash_on_delivery",
      });
      await invokeProcedure(
        shopOwnerRouter.cancelIncomingOrder,
        shopContext,
        { orderId: secondPlacement.order.id },
      );
      assert.equal(
        (
          await db.query.inventory.findFirst({
            where: eq(inventory.id, testInventoryId),
          })
        )?.availableQty,
        "2.00",
      );

      await invokeProcedure(customerRouter.addToCart, consumerContext, addInput);
      const deliveryPlacement = await invokeProcedure<{
        order: { id: number; orderNumber: string };
      }>(customerRouter.placeOrder, consumerContext, {
        shippingInfo,
        paymentMethod: "cash_on_delivery",
      });
      await invokeProcedure(shopOwnerRouter.confirmIncomingOrder, shopContext, {
        orderId: deliveryPlacement.order.id,
      });
      const firstInvoice = await invokeProcedure<{
        invoice: { id: number };
      }>(shopOwnerRouter.createIncomingOrderInvoice, shopContext, {
        orderId: deliveryPlacement.order.id,
      });
      const duplicateInvoice = await invokeProcedure<{
        invoice: { id: number };
      }>(shopOwnerRouter.createIncomingOrderInvoice, shopContext, {
        orderId: deliveryPlacement.order.id,
      });
      assert.equal(duplicateInvoice.invoice.id, firstInvoice.invoice.id);

      const createdGroup = await invokeProcedure<{
        group: {
          id: number;
          status: string;
          deliverymanId: string | null;
        };
      }>(shopOwnerRouter.createIncomingDeliveryGroup, shopContext, {
        orderId: deliveryPlacement.order.id,
        groupName: `Test delivery ${suffix}`,
        vehicleType: "bike",
      });
      assert.equal(createdGroup.group.status, "pending_assignment");
      assert.equal(createdGroup.group.deliverymanId, null);
      let deliveryOrder = await db.query.order.findFirst({
        where: eq(order.id, deliveryPlacement.order.id),
      });
      assert.equal(deliveryOrder?.status, "invoiced");
      assert.equal(deliveryOrder?.shippedAt, null);

      await db.insert(user).values({
        id: riderId,
        name: "Retailer Flow Rider",
        email: `${riderId}@example.test`,
        role: "deliveryman",
        shopId,
      });
      await invokeProcedure(
        shopOwnerRouter.assignIncomingDeliveryman,
        shopContext,
        { groupId: createdGroup.group.id, deliverymanId: riderId },
      );
      deliveryOrder = await db.query.order.findFirst({
        where: eq(order.id, deliveryPlacement.order.id),
      });
      assert.equal(deliveryOrder?.status, "invoiced");
      assert.equal(deliveryOrder?.shippedAt, null);

      const riderContext = {
        session: {
          user: { id: riderId, role: "deliveryman", shopId },
        },
      };
      await invokeProcedure(deliverymanRouter.startDelivery, riderContext, {
        id: createdGroup.group.id,
      });
      deliveryOrder = await db.query.order.findFirst({
        where: eq(order.id, deliveryPlacement.order.id),
      });
      assert.equal(deliveryOrder?.status, "processing");
      assert.ok(deliveryOrder?.shippedAt);

      const activeLink = await db.query.deliveryGroupInvoice.findFirst({
        where: eq(deliveryGroupInvoice.groupId, createdGroup.group.id),
      });
      assert.ok(activeLink?.deliveryOtp);
      await assert.rejects(
        invokeProcedure(deliverymanRouter.markDelivered, riderContext, {
          deliveryInvoiceId: activeLink.id,
          deliveryOtp: "0000",
          paymentMethod: "cash",
          amountCollected: 100,
        }),
      );
      assert.equal(
        (
          await db.query.deliveryGroupInvoice.findFirst({
            where: eq(deliveryGroupInvoice.id, activeLink.id),
          })
        )?.status,
        "pending",
      );

      await invokeProcedure(deliverymanRouter.markDelivered, riderContext, {
        deliveryInvoiceId: activeLink.id,
        deliveryOtp: activeLink.deliveryOtp,
        paymentMethod: "cash",
        amountCollected: 100,
      });
      deliveryOrder = await db.query.order.findFirst({
        where: eq(order.id, deliveryPlacement.order.id),
      });
      assert.equal(deliveryOrder?.status, "delivered");
      assert.equal(deliveryOrder?.paymentStatus, "paid");
      assert.ok(deliveryOrder?.deliveredAt);
      assert.ok(deliveryOrder?.receivedAt);

      const customerOrder = await invokeProcedure<{
        journey: { phase: string; delivery: { otp: string | null } };
      }>(customerRouter.getOrderByNumber, consumerContext, {
        orderNumber: deliveryPlacement.order.orderNumber,
      });
      assert.equal(customerOrder.journey.phase, "delivered");
      assert.equal(customerOrder.journey.delivery.otp, null);
      assert.equal(
        (
          await db.query.inventory.findFirst({
            where: eq(inventory.id, testInventoryId),
          })
        )?.availableQty,
        "1.00",
      );

      const [openOrder] = await db
        .insert(order)
        .values({
          orderNumber: `TEST-OPEN-${suffix}`,
          userId: consumerId,
          orderType: "b2c",
          status: "matching_shop",
          subtotal: "100.00",
          total: "100.00",
          shippingName: shippingInfo.name,
          shippingPhone: shippingInfo.phone,
          shippingAddress: shippingInfo.address,
          shippingCity: shippingInfo.city,
        })
        .returning({ id: order.id });
      assert.ok(openOrder);
      await db.insert(openOrderBid).values({
        subOrderId: openOrder.id,
        shopId,
        status: "submitted",
        totalBid: "100.00",
      });
      await selectWinner(openOrder.id);
      let wonOrder = await db.query.order.findFirst({
        where: eq(order.id, openOrder.id),
      });
      assert.equal(wonOrder?.shopId, shopId);
      assert.equal(wonOrder?.status, "pending");
      await invokeProcedure(shopOwnerRouter.confirmIncomingOrder, shopContext, {
        orderId: openOrder.id,
      });
      wonOrder = await db.query.order.findFirst({
        where: eq(order.id, openOrder.id),
      });
      assert.equal(wonOrder?.status, "ready_for_dispatch");
    } finally {
      if (inventoryId) {
        await db
          .update(inventory)
          .set({ availableQty: "2.00" })
          .where(eq(inventory.id, inventoryId));
      }
      await db.delete(deliveryGroup).where(eq(deliveryGroup.shopId, shopId));
      await db.delete(invoice).where(eq(invoice.customerId, consumerId));
      await db.delete(user).where(eq(user.id, riderId));
      await db.delete(user).where(eq(user.id, consumerId));
      if (productId) {
        await db.delete(product).where(eq(product.id, productId));
      }
      await db.delete(user).where(eq(user.id, shopId));

      // Guard against a partial fixture creation before relations existed.
      await db
        .delete(cartItem)
        .where(
          and(
            eq(cartItem.productId, productId ?? -1),
            eq(cartItem.shopId, shopId),
          ),
        );
      await db.delete(cart).where(eq(cart.userId, consumerId));
    }
  },
);
