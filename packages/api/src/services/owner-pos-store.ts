import { randomUUID } from "node:crypto";

import { db } from "@bikalpo-project/db";
import {
	inventory,
	warehousePosCart as posCart,
	warehousePosCustomer as posCustomer,
} from "@bikalpo-project/db/schema";
import {
	resolveVariantOperations,
	resolveVariantStockSemantics,
} from "@bikalpo-project/db/variant-definition";
import { ORPCError } from "@orpc/server";
import { and, eq, sql } from "drizzle-orm";

import { normalizePosPhone, type PosOwner } from "./owner-pos";

export type PosCatalogRow = {
	variantId: number;
	productId: number;
	sku: string | null;
	localSku: string | null;
	globalSku: string | null;
	productName: string;
	coreProductName: string;
	typeId: number;
	typeName: string;
	categoryId: number;
	categoryName: string;
	subCategoryId: number | null;
	subCategoryName: string;
	coreProductId: number | null;
	brandId: number | null;
	brandName: string;
	pack: string;
	variantLabel: string;
	unitLabel: string;
	allowsDecimal: boolean;
	availableQty: number;
	unitPrice: number;
};

export type PosSaleLine = {
	variantId: number;
	productId: number;
	sku: string | null;
	productName: string;
	variantLabel: string;
	unitLabel: string;
	quantity: number;
	unitPrice: number;
	lineTotal: number;
};

function number(value: string | number | null | undefined) {
	const parsed = Number(value ?? 0);
	return Number.isFinite(parsed) ? parsed : 0;
}

function ownerInventoryType(owner: PosOwner) {
	return owner.kind === "shop" ? ("shop" as const) : ("warehouse" as const);
}

function fallbackPackLabel(variant: {
	packWeightKg: string | null;
	weightKg: string;
	unitLabel: string;
	packType: string | null;
}) {
	const weight = number(variant.packWeightKg) || number(variant.weightKg);
	if (weight > 0)
		return `${Number.isInteger(weight) ? weight : weight.toFixed(2)} KG`;
	return variant.unitLabel || variant.packType?.toUpperCase() || "Unit";
}

export function posCustomerOwnerCondition(owner: PosOwner) {
	return owner.kind === "shop"
		? eq(posCustomer.shopId, owner.id)
		: eq(posCustomer.warehouseId, owner.id);
}

export function posCartOwnerCondition(owner: PosOwner) {
	return owner.kind === "shop"
		? eq(posCart.shopId, owner.id)
		: eq(posCart.warehouseId, owner.id);
}

export function ownerColumns(owner: PosOwner) {
	return owner.kind === "shop"
		? { shopId: owner.id, warehouseId: null }
		: { warehouseId: owner.id, shopId: null };
}

export async function ensurePosWalkInCustomer(
	owner: PosOwner,
	actorId: string,
) {
    const existing = await db.query.warehousePosCustomer.findFirst({
		where: and(
			posCustomerOwnerCondition(owner),
			eq(posCustomer.isDefault, true),
		),
    });
	if (existing) return existing;

	const [created] = await db
		.insert(posCustomer)
		.values({
			...ownerColumns(owner),
			name: "Walk-in Customer",
			customerType: "walk_in",
			isDefault: true,
			createdById: actorId,
		})
		.returning();
	if (!created) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Failed to create Walk-in Customer",
		});
	}
	return created;
}

export async function findOrCreatePosCustomer(input: {
	owner: PosOwner;
	actorId: string;
	name: string;
	phone?: string | null;
	address?: string | null;
	linkedUserId?: string | null;
}) {
	const normalizedPhone = normalizePosPhone(input.phone);
	if (normalizedPhone) {
		const existing = await db.query.warehousePosCustomer.findFirst({
			where: and(
				posCustomerOwnerCondition(input.owner),
				eq(posCustomer.normalizedPhone, normalizedPhone),
			),
		});
		if (existing) {
			if (input.linkedUserId && !existing.linkedUserId) {
				const [linked] = await db
					.update(posCustomer)
					.set({ linkedUserId: input.linkedUserId })
					.where(
						and(
							eq(posCustomer.id, existing.id),
							posCustomerOwnerCondition(input.owner),
						),
					)
					.returning();
				return linked ?? existing;
			}
			return existing;
		}
	}

	const [created] = await db
		.insert(posCustomer)
		.values({
			...ownerColumns(input.owner),
			name: input.name.trim(),
			phone: input.phone?.trim() || null,
			normalizedPhone,
			address: input.address?.trim() || null,
			linkedUserId: input.linkedUserId ?? null,
			customerType: "retail",
			isDefault: false,
			createdById: input.actorId,
		})
		.returning();
	if (!created) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Failed to create POS Customer",
		});
	}
	return created;
}

export async function getOwnerPosCatalog(
	owner: PosOwner,
): Promise<PosCatalogRow[]> {
	const stockRows = await db.query.inventory.findMany({
		where: and(
			eq(inventory.ownerType, ownerInventoryType(owner)),
			eq(inventory.ownerId, owner.id),
			sql`CAST(${inventory.availableQty} AS numeric) > 0`,
		),
		columns: { availableQty: true, retailPrice: true },
		with: {
			variant: {
				columns: {
					id: true,
					sku: true,
					preferredLocalSku: true,
					weightKg: true,
					unitLabel: true,
					price: true,
					packWeightKg: true,
					packType: true,
					orderUnit: true,
					isActive: true,
				},
				with: {
					catalogVariant: { columns: { globalSku: true } },
					sourceVariantOption: true,
					brand: { columns: { id: true, name: true } },
					product: {
						columns: {
							id: true,
							name: true,
							categoryId: true,
							subCategoryId: true,
							coreProductId: true,
							status: true,
						},
						with: {
							coreProduct: { columns: { id: true, name: true } },
							category: {
								columns: { id: true, name: true, typeId: true },
								with: {
								type: { columns: { id: true, name: true } },
								},
							},
							subCategory: { columns: { id: true, name: true } },
						},
					},
				},
			},
		},
	});

	const rows: PosCatalogRow[] = [];
	for (const entry of stockRows) {
		const variant = entry.variant;
		const product = variant?.product;
		const category = product?.category;
		const type = category?.type;
		if (
			!variant ||
			!variant.isActive ||
			!product ||
			product.status !== "active" ||
			!category ||
			!type
		) {
			continue;
		}
		const operations = variant.sourceVariantOption
			? resolveVariantOperations(variant.sourceVariantOption)
			: null;
		const pack = variant.sourceVariantOption
			? resolveVariantStockSemantics(variant.sourceVariantOption).displayLabel
			: fallbackPackLabel(variant);
		const price = number(entry.retailPrice) || number(variant.price);
		if (price <= 0) continue;

		rows.push({
			variantId: variant.id,
			productId: product.id,
			sku: variant.preferredLocalSku ?? variant.sku,
			localSku: variant.preferredLocalSku ?? variant.sku,
			globalSku: variant.catalogVariant?.globalSku ?? null,
			productName: product.name,
			coreProductName: product.coreProduct?.name ?? product.name,
			typeId: type.id,
			typeName: type.name,
			categoryId: category.id,
			categoryName: category.name,
			subCategoryId: product.subCategory?.id ?? null,
			subCategoryName: product.subCategory?.name ?? "Uncategorized",
			coreProductId: product.coreProduct?.id ?? null,
			brandId: variant.brand?.id ?? null,
			brandName: variant.brand?.name ?? "",
			pack,
			variantLabel: pack,
			unitLabel:
				operations?.operationalUnit ?? variant.orderUnit ?? variant.unitLabel,
			allowsDecimal: operations?.allowsDecimal ?? false,
			availableQty: number(entry.availableQty),
			unitPrice: price,
		});
	}
	return rows;
}

export async function resolveOwnerPosSaleLines(
	owner: PosOwner,
	items: Array<{ variantId: number; quantity: number }>,
): Promise<PosSaleLine[]> {
	const variantIds = [...new Set(items.map((item) => item.variantId))];
	if (variantIds.length === 0) {
		throw new ORPCError("BAD_REQUEST", { message: "No product selected" });
	}
	const catalog = await getOwnerPosCatalog(owner);
	const catalogMap = new Map(catalog.map((row) => [row.variantId, row]));

	return items.map((item) => {
		const row = catalogMap.get(item.variantId);
		if (!row) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Variant ${item.variantId} is not available in this inventory`,
			});
		}
		if (item.quantity <= 0 || !Number.isFinite(item.quantity)) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Quantity must be positive",
			});
		}
		if (!row.allowsDecimal && !Number.isInteger(item.quantity)) {
			throw new ORPCError("BAD_REQUEST", {
				message: `${row.productName} must be sold in whole ${row.unitLabel} quantities`,
			});
		}
		if (item.quantity > row.availableQty) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Insufficient stock for ${row.productName}. Available ${row.availableQty}`,
			});
		}
		return {
			variantId: row.variantId,
			productId: row.productId,
			sku: row.sku,
			productName: row.coreProductName,
			variantLabel: row.variantLabel,
			unitLabel: row.unitLabel,
			quantity: item.quantity,
			unitPrice: row.unitPrice,
			lineTotal: Math.round(row.unitPrice * item.quantity * 100) / 100,
		};
	});
}

export function createHeldCartReference() {
	return `SHOP-HOLD-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function nextRetailerReceiptNumber() {
	const result = await db.execute<{ sequence: string }>(
		sql`SELECT nextval('retailer_pos_invoice_seq')::text AS sequence`,
	);
	const sequence = result.rows[0]?.sequence;
	if (!sequence) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Could not generate POS receipt number",
		});
	}
	return `RPOS-${sequence.padStart(8, "0")}`;
}
