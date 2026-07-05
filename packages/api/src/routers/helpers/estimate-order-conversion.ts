import { db } from "@bikalpo-project/db";
import {
	estimate,
	inventory,
	order,
	orderItem,
	shopWarehouseConnection,
	user,
	warehouseWarehouseConnection,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

const paymentMethodSchema = z
	.enum(["cash_on_delivery", "bkash", "nagad", "bank_transfer", "card"])
	.default("cash_on_delivery");

export const estimateOrderShippingSchema = z.object({
	shippingName: z.string().trim().min(1),
	shippingPhone: z.string().trim().min(1),
	shippingAddress: z.string().trim().min(1),
	shippingCity: z.string().trim().min(1),
	shippingArea: z.string().trim().optional().nullable(),
	shippingPostalCode: z.string().trim().optional().nullable(),
	customerNote: z.string().trim().optional().nullable(),
	paymentMethod: paymentMethodSchema,
});

export const estimateOrderAcceptSchema = estimateOrderShippingSchema
	.partial()
	.extend({
		paymentMethod: paymentMethodSchema.optional(),
	});

export type EstimateOrderShippingInput = z.infer<
	typeof estimateOrderShippingSchema
>;
export type EstimateOrderAcceptInput = z.infer<
	typeof estimateOrderAcceptSchema
>;

function endOfValidUntil(value: Date | string | null) {
	if (!value) return null;

	if (typeof value === "string") {
		const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
		if (match) {
			return new Date(
				Number(match[1]),
				Number(match[2]) - 1,
				Number(match[3]),
				23,
				59,
				59,
				999,
			);
		}
	}

	const date = new Date(value);
	date.setHours(23, 59, 59, 999);
	return date;
}

function isEstimateExpired(validUntil: Date | string | null) {
	const expiresAt = endOfValidUntil(validUntil);
	return expiresAt ? expiresAt.getTime() < Date.now() : false;
}

function generateEstimateOrderNumber(isWarehouseBuyer: boolean) {
	const prefix = isWarehouseBuyer ? "W2W" : "WO";
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function cleanText(value: string | null | undefined) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function resolveOrderDetails(
	receiver: {
		name: string | null;
		phoneNumber: string | null;
		shopName: string | null;
		shopAddress: string | null;
		warehouseName: string | null;
		warehouseAddress: string | null;
	},
	orderInput?: EstimateOrderAcceptInput,
): EstimateOrderShippingInput {
	const receiverName =
		cleanText(receiver.warehouseName) ??
		cleanText(receiver.shopName) ??
		cleanText(receiver.name) ??
		"Receiver";
	const receiverAddress =
		cleanText(receiver.warehouseAddress) ??
		cleanText(receiver.shopAddress) ??
		"Not provided";

	return {
		shippingName: cleanText(orderInput?.shippingName) ?? receiverName,
		shippingPhone:
			cleanText(orderInput?.shippingPhone) ??
			cleanText(receiver.phoneNumber) ??
			"Not provided",
		shippingAddress: cleanText(orderInput?.shippingAddress) ?? receiverAddress,
		shippingCity: cleanText(orderInput?.shippingCity) ?? "N/A",
		shippingArea: cleanText(orderInput?.shippingArea),
		shippingPostalCode: cleanText(orderInput?.shippingPostalCode),
		customerNote: cleanText(orderInput?.customerNote),
		paymentMethod: orderInput?.paymentMethod ?? "cash_on_delivery",
	};
}

export async function convertEstimateToB2bOrder(input: {
	estimateId: number;
	receiverId: string;
	order?: EstimateOrderAcceptInput;
}) {
	const receiver = await db.query.user.findFirst({
		where: eq(user.id, input.receiverId),
		columns: {
			id: true,
			name: true,
			role: true,
			phoneNumber: true,
			shopName: true,
			shopAddress: true,
			warehouseName: true,
			warehouseAddress: true,
		},
	});

	if (!receiver) {
		throw new ORPCError("NOT_FOUND", { message: "Receiver not found" });
	}

	const isWarehouseBuyer =
		receiver.role === "warehouse" || Boolean(receiver.warehouseName);
	const orderDetails = resolveOrderDetails(receiver, input.order);

	const result = await db.transaction(async (tx) => {
		const estimateData = await tx.query.estimate.findFirst({
			where: eq(estimate.id, input.estimateId),
			with: { items: true },
		});

		if (!estimateData) {
			throw new ORPCError("NOT_FOUND", { message: "Estimate not found" });
		}

		if (estimateData.customerId !== input.receiverId) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only the estimate receiver can accept this estimate",
			});
		}

		if (estimateData.status === "converted") {
			if (!estimateData.convertedOrderId) {
				throw new ORPCError("CONFLICT", {
					message: "Estimate is already converted but no order is linked",
				});
			}

			const existingOrder = await tx.query.order.findFirst({
				where: eq(order.id, estimateData.convertedOrderId),
			});

			if (!existingOrder) {
				throw new ORPCError("CONFLICT", {
					message: "Converted order could not be found",
				});
			}

			return { order: existingOrder, alreadyConverted: true };
		}

		if (estimateData.status !== "sent" && estimateData.status !== "approved") {
			throw new ORPCError("BAD_REQUEST", {
				message: `Only sent or approved estimates can be accepted. Current status: ${estimateData.status}`,
			});
		}

		if (isEstimateExpired(estimateData.validUntil)) {
			throw new ORPCError("BAD_REQUEST", {
				message: "This estimate has expired. Please request a new estimate.",
			});
		}

		if (!estimateData.warehouseId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "This estimate is missing the seller warehouse",
			});
		}

		if (estimateData.items.length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "This estimate has no items to convert",
			});
		}

		const quantityByVariant = new Map<number, number>();
		for (const item of estimateData.items) {
			if (!item.variantId) {
				throw new ORPCError("BAD_REQUEST", {
					message: "All estimate items must have warehouse variants",
				});
			}
			quantityByVariant.set(
				item.variantId,
				(quantityByVariant.get(item.variantId) ?? 0) + item.quantity,
			);
		}

		for (const [variantId, quantity] of quantityByVariant) {
			const stock = await tx.query.inventory.findFirst({
				where: and(
					eq(inventory.ownerType, "warehouse"),
					eq(inventory.ownerId, estimateData.warehouseId),
					eq(inventory.variantId, variantId),
				),
				with: {
					variant: {
						with: {
							product: {
								columns: { name: true },
							},
						},
					},
				},
			});

			if (!stock) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Variant ${variantId} is no longer available from this warehouse`,
				});
			}

			const availableQty = Number(stock.availableQty || 0);
			if (availableQty < quantity) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Insufficient stock for ${stock.variant?.product?.name || "product"}. Available: ${availableQty}, requested: ${quantity}`,
				});
			}
		}

		const now = new Date();
		if (isWarehouseBuyer) {
			const connection = await tx.query.warehouseWarehouseConnection.findFirst({
				where: and(
					eq(warehouseWarehouseConnection.buyerWarehouseId, input.receiverId),
					eq(
						warehouseWarehouseConnection.supplierWarehouseId,
						estimateData.warehouseId,
					),
					eq(warehouseWarehouseConnection.status, "active"),
				),
			});

			if (!connection) {
				throw new ORPCError("FORBIDDEN", {
					message: "This warehouse is not connected to the seller warehouse",
				});
			}

			await tx
				.update(warehouseWarehouseConnection)
				.set({ lastOrderedAt: now })
				.where(eq(warehouseWarehouseConnection.id, connection.id));
		} else {
			const connection = await tx.query.shopWarehouseConnection.findFirst({
				where: and(
					eq(shopWarehouseConnection.shopId, input.receiverId),
					eq(shopWarehouseConnection.warehouseId, estimateData.warehouseId),
					eq(shopWarehouseConnection.status, "active"),
				),
			});

			if (!connection) {
				throw new ORPCError("FORBIDDEN", {
					message: "This shop is not connected to the seller warehouse",
				});
			}

			await tx
				.update(shopWarehouseConnection)
				.set({ lastOrderedAt: now })
				.where(eq(shopWarehouseConnection.id, connection.id));
		}

		const [newOrder] = await tx
			.insert(order)
			.values({
				orderNumber: generateEstimateOrderNumber(isWarehouseBuyer),
				userId: estimateData.customerId,
				orderType: "b2b",
				orderSource: "estimate",
				warehouseId: estimateData.warehouseId,
				subtotal: estimateData.subtotal,
				discount: estimateData.discount,
				total: estimateData.total,
				shippingCost: "0",
				status: "pending",
				paymentStatus: "pending",
				paymentMethod: orderDetails.paymentMethod,
				shippingName: orderDetails.shippingName,
				shippingPhone: orderDetails.shippingPhone,
				shippingEmail: null,
				shippingAddress: orderDetails.shippingAddress,
				shippingCity: orderDetails.shippingCity,
				shippingArea: orderDetails.shippingArea || null,
				shippingPostalCode: orderDetails.shippingPostalCode || null,
				customerNote: orderDetails.customerNote || null,
			})
			.returning();

		if (!newOrder) {
			throw new Error("Failed to create order");
		}

		await tx.insert(orderItem).values(
			estimateData.items.map((item) => ({
				orderId: newOrder.id,
				productId: item.productId,
				variantId: item.variantId,
				productName: item.productName,
				productImage: item.productImage || "",
				productSize: item.productSize || "N/A",
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				totalPrice: item.totalPrice,
				conversionStatus: "pending",
			})),
		);

		const [updatedEstimate] = await tx
			.update(estimate)
			.set({
				status: "converted",
				convertedOrderId: newOrder.id,
				convertedAt: now,
			})
			.where(
				and(
					eq(estimate.id, input.estimateId),
					eq(estimate.customerId, input.receiverId),
					inArray(estimate.status, ["sent", "approved"]),
				),
			)
			.returning({ id: estimate.id });

		if (!updatedEstimate) {
			throw new ORPCError("CONFLICT", {
				message: "Estimate was already accepted by another request",
			});
		}

		return { order: newOrder, alreadyConverted: false };
	});

	return {
		success: true,
		order: result.order,
		alreadyConverted: result.alreadyConverted,
	};
}
