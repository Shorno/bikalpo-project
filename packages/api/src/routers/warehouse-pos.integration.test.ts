import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const runDatabaseIntegration = process.env.RUN_WAREHOUSE_POS_DB_TEST === "1";

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
	"warehouse POS checkout keeps stock, split receipts, due, accounting, and idempotency atomic",
	{ skip: !runDatabaseIntegration },
	async () => {
		const [{ db }, schema, drizzle, accountingSeed, routerModule] =
			await Promise.all([
				import("@bikalpo-project/db"),
				import("@bikalpo-project/db/schema"),
				import("drizzle-orm"),
				import("@bikalpo-project/db/accounting-seed"),
				import("./warehouse-pos"),
			]);
		const {
			category,
			deliveryGroup,
			financeAccount,
			financePaymentAccount,
			financialLedger,
			inventory,
			journalEntry,
			journalLine,
			order,
			product,
			productVariant,
			user,
			warehousePosPayment,
			warehousePosSale,
		} = schema;
		const { and, eq, inArray, sql } = drizzle;
		const { warehousePosRouter } = routerModule;
		const suffix = randomUUID();
		const warehouseId = `warehouse-pos-${suffix}`;
		const otherWarehouseId = `warehouse-pos-other-${suffix}`;
		let productId: number | null = null;

		const context = {
			session: {
				user: {
					id: warehouseId,
					role: "warehouse",
					name: "Warehouse POS Owner",
					warehouseName: "POS Test Warehouse",
				},
			},
		};

		try {
			const [categoryRow] = await db
				.select({ id: category.id })
				.from(category)
				.limit(1);
			assert.ok(categoryRow, "A category fixture is required");
			const [brandRow] = await db
				.select({ id: schema.brand.id, name: schema.brand.name })
				.from(schema.brand)
				.limit(1);
			assert.ok(brandRow, "A brand fixture is required");
			await db.insert(user).values([
				{
					id: warehouseId,
					name: "Warehouse POS Owner",
					email: `${warehouseId}@example.test`,
					role: "warehouse",
					warehouseName: "POS Test Warehouse",
				},
				{
					id: otherWarehouseId,
					name: "Other Warehouse",
					email: `${otherWarehouseId}@example.test`,
					role: "warehouse",
					warehouseName: "Other Warehouse",
				},
			]);
			const [createdProduct] = await db
				.insert(product)
				.values({
					name: "Warehouse POS Test Product",
					slug: `warehouse-pos-product-${suffix}`,
					categoryId: categoryRow.id,
					size: "1 unit",
					price: "125.00",
					image: "/placeholder.svg",
					status: "active",
					visibility: "public",
					creatorSource: "warehouse",
					createdById: warehouseId,
				})
				.returning({ id: product.id });
			assert.ok(createdProduct);
			productId = createdProduct.id;
			const [variant] = await db
				.insert(productVariant)
				.values({
					productId: createdProduct.id,
					brandId: brandRow.id,
					sku: `WPOS-${suffix}`,
					unitLabel: "Unit",
					quantitySelectorLabel: "1 unit",
					packagingType: "unit",
					weightKg: "1.00",
					price: "125.00",
					variantType: "trade",
					orderType: "b2b",
					visibilityRole: "shop_owner",
					stockSource: "warehouse",
					orderMin: "1.00",
					orderMax: "20.00",
					orderIncrement: "1.00",
					isActive: true,
				})
				.returning({ id: productVariant.id });
			assert.ok(variant);
			await db.insert(inventory).values({
				ownerType: "warehouse",
				ownerId: warehouseId,
				variantId: variant.id,
				availableQty: "6.00",
				reservedQty: "0.00",
				retailPrice: "125.00",
			});

			const warehouseAccounts =
				await accountingSeed.ensureDefaultFinancePaymentAccounts({
					ownerId: warehouseId,
					ownerType: "warehouse",
				});
			const otherAccounts =
				await accountingSeed.ensureDefaultFinancePaymentAccounts({
					ownerId: otherWarehouseId,
					ownerType: "warehouse",
				});
			const cashId = warehouseAccounts.idsByCode.get("1001-cash-on-hand");
			const bankId = warehouseAccounts.idsByCode.get("1003-dutch-bangla-bank");
			const otherCashId = otherAccounts.idsByCode.get("1001-cash-on-hand");
			assert.ok(cashId && bankId && otherCashId);

			await assert.rejects(
				invokeProcedure(warehousePosRouter.completeSale, context, {
					checkoutRequestId: randomUUID(),
					deliveryMethod: "Self Pickup",
					paymentStatus: "paid",
					saleDate: "2026-09-07",
					payments: [{ paymentAccountId: 2_147_483_647, receivedAmount: 125 }],
					items: [{ variantId: variant.id, quantity: 1 }],
				}),
				/active payment accounts/i,
			);
			await db
				.update(financePaymentAccount)
				.set({ isActive: false })
				.where(eq(financePaymentAccount.id, bankId));
			await assert.rejects(
				invokeProcedure(warehousePosRouter.completeSale, context, {
					checkoutRequestId: randomUUID(),
					deliveryMethod: "Self Pickup",
					paymentStatus: "paid",
					saleDate: "2026-09-07",
					payments: [{ paymentAccountId: bankId, receivedAmount: 125 }],
					items: [{ variantId: variant.id, quantity: 1 }],
				}),
				/active payment accounts/i,
			);
			await db
				.update(financePaymentAccount)
				.set({ isActive: true })
				.where(eq(financePaymentAccount.id, bankId));

			await assert.rejects(
				invokeProcedure(warehousePosRouter.completeSale, context, {
					checkoutRequestId: randomUUID(),
					deliveryMethod: "Self Pickup",
					paymentStatus: "paid",
					saleDate: "2026-09-07",
					payments: [{ paymentAccountId: otherCashId, receivedAmount: 125 }],
					items: [{ variantId: variant.id, quantity: 1 }],
				}),
				/owned by this warehouse/i,
			);

			const named = await invokeProcedure<{ customer: { id: number } }>(
				warehousePosRouter.createCustomer,
				context,
				{
					name: "Rahim Enterprise",
					phone: "01800000000",
					customerType: "wholesale",
				},
			);
			const checkoutRequestId = randomUUID();
			const [firstAttempt, secondAttempt] = await Promise.all([
				invokeProcedure<{
					saleId: number;
					duplicate: boolean;
				}>(warehousePosRouter.completeSale, context, {
					checkoutRequestId,
					deliveryMethod: "Self Pickup",
					paymentStatus: "paid",
					saleDate: "2026-09-07",
					payments: [
						{ paymentAccountId: bankId, receivedAmount: 25 },
						{ paymentAccountId: cashId, receivedAmount: 120 },
					],
					items: [{ variantId: variant.id, quantity: 1 }],
				}),
				invokeProcedure<{
					saleId: number;
					duplicate: boolean;
				}>(warehousePosRouter.completeSale, context, {
					checkoutRequestId,
					deliveryMethod: "Self Pickup",
					paymentStatus: "paid",
					saleDate: "2026-09-07",
					payments: [
						{ paymentAccountId: bankId, receivedAmount: 25 },
						{ paymentAccountId: cashId, receivedAmount: 120 },
					],
					items: [{ variantId: variant.id, quantity: 1 }],
				}),
			]);
			const paid = firstAttempt.duplicate ? secondAttempt : firstAttempt;
			const duplicate = firstAttempt.duplicate ? firstAttempt : secondAttempt;
			assert.equal(duplicate.saleId, paid.saleId);
			assert.equal(duplicate.duplicate, true);
			const printedInvoice = await invokeProcedure<{
				items: { productName: string }[];
			}>(warehousePosRouter.getSaleInvoice, context, { saleId: paid.saleId });
			assert.equal(
				printedInvoice.items[0]?.productName,
				`${brandRow.name} Warehouse POS Test Product`,
			);

			const partial = await invokeProcedure<{ saleId: number }>(
				warehousePosRouter.completeSale,
				context,
				{
					checkoutRequestId: randomUUID(),
					customerId: named.customer.id,
					deliveryMethod: "Courier",
					paymentStatus: "partial",
					saleDate: "2026-09-07",
					payments: [{ paymentAccountId: cashId, receivedAmount: 50 }],
					items: [{ variantId: variant.id, quantity: 1 }],
				},
			);
			const fullyDue = await invokeProcedure<{ saleId: number }>(
				warehousePosRouter.completeSale,
				context,
				{
					checkoutRequestId: randomUUID(),
					customerId: named.customer.id,
					deliveryMethod: "Self Pickup",
					paymentStatus: "due",
					saleDate: "2026-09-07",
					payments: [{ paymentAccountId: cashId, receivedAmount: 0 }],
					items: [{ variantId: variant.id, quantity: 1 }],
				},
			);

			const selectedCustomer = await invokeProcedure<{
				customers: { id: number; outstanding: number }[];
			}>(warehousePosRouter.searchCustomers, context, {
				customerId: named.customer.id,
			});
			assert.equal(selectedCustomer.customers.length, 1);
			assert.equal(selectedCustomer.customers[0]?.id, named.customer.id);
			assert.equal(selectedCustomer.customers[0]?.outstanding, 200);
			const otherWarehouseLookup = await invokeProcedure<{
				customers: { id: number }[];
			}>(
				warehousePosRouter.searchCustomers,
				{
					session: { user: { ...context.session.user, id: otherWarehouseId } },
				},
				{ customerId: named.customer.id },
			);
			assert.deepEqual(otherWarehouseLookup.customers, []);

			const afterCheckout = await db.query.inventory.findFirst({
				where: and(
					eq(inventory.ownerType, "warehouse"),
					eq(inventory.ownerId, warehouseId),
					eq(inventory.variantId, variant.id),
				),
			});
			assert.equal(afterCheckout?.availableQty, "3.00");
			const payments = await db
				.select()
				.from(warehousePosPayment)
				.where(eq(warehousePosPayment.saleId, paid.saleId));
			assert.equal(payments.length, 2);
			assert.deepEqual(
				payments
					.map((payment) => [payment.amount, payment.tenderedAmount])
					.sort(),
				[
					["100.00", "120.00"],
					["25.00", "25.00"],
				],
			);
			const partialSale = await db.query.warehousePosSale.findFirst({
				where: eq(warehousePosSale.id, partial.saleId),
			});
			assert.equal(partialSale?.due, "75.00");
			assert.equal(partialSale?.deliveryMethod, "Courier");
			const duePayments = await db
				.select()
				.from(warehousePosPayment)
				.where(eq(warehousePosPayment.saleId, fullyDue.saleId));
			assert.equal(duePayments.length, 1);
			assert.equal(duePayments[0]?.amount, "0.00");
			assert.equal(duePayments[0]?.tenderedAmount, "0.00");
			assert.equal(
				await db.$count(order, eq(order.warehouseId, warehouseId)),
				0,
			);
			assert.equal(
				await db.$count(
					deliveryGroup,
					eq(deliveryGroup.warehouseId, warehouseId),
				),
				0,
			);

			const journals = await db
				.select({ id: journalEntry.id })
				.from(journalEntry)
				.where(
					and(
						eq(journalEntry.ownerId, warehouseId),
						inArray(journalEntry.sourceId, [
							String(paid.saleId),
							String(partial.saleId),
							String(fullyDue.saleId),
						]),
					),
				);
			assert.equal(journals.length, 3);
			for (const journal of journals) {
				const [totals] = await db
					.select({
						debit: sql<string>`SUM(${journalLine.debit}::numeric)::text`,
						credit: sql<string>`SUM(${journalLine.credit}::numeric)::text`,
					})
					.from(journalLine)
					.where(eq(journalLine.journalEntryId, journal.id));
				assert.equal(totals?.debit, totals?.credit);
			}
			const receivable = await db.query.financeAccount.findFirst({
				where: and(
					eq(financeAccount.ownerId, warehouseId),
					eq(financeAccount.code, "1101-accounts-receivable"),
				),
			});
			assert.equal(receivable?.currentBalance, "200.00");
			const salesLedgerRows = await db
				.select({ id: financialLedger.id })
				.from(financialLedger)
				.where(
					and(
						eq(financialLedger.ownerId, warehouseId),
						eq(financialLedger.direction, "credit"),
						eq(
							financialLedger.description,
							`Warehouse POS sale ${partialSale?.invoiceNo} | Wholesale Sales`,
						),
					),
				);
			assert.equal(salesLedgerRows.length, 1);

			await assert.rejects(
				invokeProcedure(warehousePosRouter.completeSale, context, {
					checkoutRequestId: randomUUID(),
					deliveryMethod: "Self Pickup",
					paymentStatus: "paid",
					saleDate: "2026-09-07",
					payments: [{ paymentAccountId: cashId, receivedAmount: 750 }],
					items: [
						{ variantId: variant.id, quantity: 2 },
						{ variantId: variant.id, quantity: 2 },
					],
				}),
				/insufficient stock/i,
			);
			const afterConflict = await db.query.inventory.findFirst({
				where: and(
					eq(inventory.ownerType, "warehouse"),
					eq(inventory.ownerId, warehouseId),
					eq(inventory.variantId, variant.id),
				),
			});
			assert.equal(afterConflict?.availableQty, "3.00");
		} finally {
			await db
				.delete(warehousePosSale)
				.where(eq(warehousePosSale.warehouseId, warehouseId));
			await db
				.delete(inventory)
				.where(
					and(
						eq(inventory.ownerType, "warehouse"),
						eq(inventory.ownerId, warehouseId),
					),
				);
			if (productId) await db.delete(product).where(eq(product.id, productId));
			await db.delete(user).where(eq(user.id, otherWarehouseId));
			await db.delete(user).where(eq(user.id, warehouseId));
		}
	},
);
