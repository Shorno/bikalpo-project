import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const runDatabaseIntegration = process.env.RUN_RETAILER_POS_DB_TEST === "1";

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
	"retailer checkout, collection, void, and ownership stay inside the POS seam",
	{ skip: !runDatabaseIntegration },
	async () => {
		const [{ db }, schema, drizzle, routerModule] = await Promise.all([
			import("@bikalpo-project/db"),
			import("@bikalpo-project/db/schema"),
			import("drizzle-orm"),
			import("./retailer-pos"),
		]);
		const {
			category,
			deliveryGroup,
			inventory,
			invoice,
			order,
			product,
			productVariant,
			user,
			warehousePosCustomer,
			warehousePosPayment,
			warehousePosSale,
		} = schema;
		const { and, eq } = drizzle;
		const { retailerPosRouter } = routerModule;
		const suffix = randomUUID();
		const shopId = `retailer-pos-shop-${suffix}`;
		const otherShopId = `retailer-pos-other-${suffix}`;
		let productId: number | null = null;

		const shopContext = {
			session: {
				user: {
					id: shopId,
					role: "shop_owner",
					name: "POS Shop Owner",
					shopName: "POS Integration Shop",
					ownerName: "POS Shop Owner",
					shopAddress: "12 Counter Road, Dhaka",
					phoneNumber: "01700000000",
				},
			},
		};
		const otherShopContext = {
			session: {
				user: { id: otherShopId, role: "shop_owner", name: "Other Shop" },
			},
		};

		try {
			const [categoryRow] = await db
				.select({ id: category.id })
				.from(category)
				.limit(1);
			assert.ok(categoryRow, "A category fixture is required");
			await db.insert(user).values([
				{
					id: shopId,
					name: "POS Shop Owner",
					email: `${shopId}@example.test`,
					role: "shop_owner",
					isSeller: true,
					sellerStatus: "approved",
					shopName: "POS Integration Shop",
					shopSlug: `pos-integration-${suffix}`,
				},
				{
					id: otherShopId,
					name: "Other POS Shop",
					email: `${otherShopId}@example.test`,
					role: "shop_owner",
					shopName: "Other POS Shop",
				},
			]);
			const [createdProduct] = await db
				.insert(product)
				.values({
					name: "Retailer POS Test Product",
					slug: `retailer-pos-product-${suffix}`,
					categoryId: categoryRow.id,
					size: "1 unit",
					price: "125.00",
					image: "/placeholder.svg",
					status: "active",
					visibility: "public",
					creatorSource: "shop",
					createdById: shopId,
				})
				.returning({ id: product.id });
			assert.ok(createdProduct);
			productId = createdProduct.id;
			const [variant] = await db
				.insert(productVariant)
				.values({
					productId: createdProduct.id,
					unitLabel: "Unit",
					quantitySelectorLabel: "1 unit",
					packagingType: "unit",
					weightKg: "1.00",
					price: "125.00",
					variantType: "retail",
					orderType: "b2c",
					visibilityRole: "consumer",
					stockSource: "shop",
					orderMin: "1.00",
					orderMax: "20.00",
					orderIncrement: "1.00",
					isActive: true,
				})
				.returning({ id: productVariant.id });
			assert.ok(variant);
			await db.insert(inventory).values({
				ownerType: "shop",
				ownerId: shopId,
				variantId: variant.id,
				availableQty: "6.00",
				reservedQty: "0.00",
				retailPrice: "125.00",
			});

			const named = await invokeProcedure<{ customer: { id: number } }>(
				retailerPosRouter.createCustomer,
				shopContext,
				{ name: "Mrs Rahima", phone: "+8801815151827" },
			);
			const paidRequestId = randomUUID();
			const paidSale = await invokeProcedure<{
				saleId: number;
				duplicate: boolean;
			}>(retailerPosRouter.completeSale, shopContext, {
				checkoutRequestId: paidRequestId,
				paymentMethod: "cash",
				tenderedAmount: 150,
				items: [{ variantId: variant.id, quantity: 1, expectedUnitPrice: 125 }],
			});
			const duplicate = await invokeProcedure<{
				saleId: number;
				duplicate: boolean;
			}>(retailerPosRouter.completeSale, shopContext, {
				checkoutRequestId: paidRequestId,
				paymentMethod: "cash",
				tenderedAmount: 150,
				items: [{ variantId: variant.id, quantity: 1, expectedUnitPrice: 125 }],
			});
			assert.equal(duplicate.saleId, paidSale.saleId);
			assert.equal(duplicate.duplicate, true);

			const dueSale = await invokeProcedure<{ saleId: number }>(
				retailerPosRouter.completeSale,
				shopContext,
				{
					checkoutRequestId: randomUUID(),
					customerId: named.customer.id,
					paymentMethod: "bkash",
					tenderedAmount: 50,
					items: [
						{ variantId: variant.id, quantity: 1, expectedUnitPrice: 125 },
					],
				},
			);
			const afterCheckout = await db.query.inventory.findFirst({
				where: and(
					eq(inventory.ownerType, "shop"),
					eq(inventory.ownerId, shopId),
					eq(inventory.variantId, variant.id),
				),
			});
			assert.equal(afterCheckout?.availableQty, "4.00");
			assert.equal(await db.$count(order, eq(order.shopId, shopId)), 0);
			const fulfillmentInvoices = await db
				.select({ id: invoice.id })
				.from(invoice)
				.innerJoin(order, eq(invoice.orderId, order.id))
				.where(eq(order.shopId, shopId));
			assert.equal(fulfillmentInvoices.length, 0);
			assert.equal(
				await db.$count(deliveryGroup, eq(deliveryGroup.shopId, shopId)),
				0,
			);

			await invokeProcedure(retailerPosRouter.collectDue, shopContext, {
				saleId: dueSale.saleId,
				idempotencyKey: randomUUID(),
				amount: 75,
				paymentMethod: "cash",
			});
			const settled = await db.query.warehousePosSale.findFirst({
				where: eq(warehousePosSale.id, dueSale.saleId),
			});
			assert.equal(settled?.due, "0.00");

			await assert.rejects(
				invokeProcedure(retailerPosRouter.getSale, otherShopContext, {
					saleId: paidSale.saleId,
				}),
				/not found/i,
			);
			await invokeProcedure(retailerPosRouter.voidSale, shopContext, {
				saleId: paidSale.saleId,
				reason: "Integration test cancellation",
			});
			const afterVoid = await db.query.inventory.findFirst({
				where: and(
					eq(inventory.ownerType, "shop"),
					eq(inventory.ownerId, shopId),
					eq(inventory.variantId, variant.id),
				),
			});
			assert.equal(afterVoid?.availableQty, "5.00");
			const reversals = await db.$count(
				warehousePosPayment,
				and(
					eq(warehousePosPayment.saleId, paidSale.saleId),
					eq(warehousePosPayment.entryType, "reversal"),
				),
			);
			assert.equal(reversals, 1);
		} finally {
			await db
				.delete(warehousePosSale)
				.where(eq(warehousePosSale.shopId, shopId));
			await db
				.delete(warehousePosCustomer)
				.where(eq(warehousePosCustomer.shopId, shopId));
			await db
				.delete(inventory)
				.where(
					and(eq(inventory.ownerType, "shop"), eq(inventory.ownerId, shopId)),
				);
			if (productId) await db.delete(product).where(eq(product.id, productId));
			await db.delete(user).where(eq(user.id, otherShopId));
			await db.delete(user).where(eq(user.id, shopId));
		}
	},
);
