import {
	resolveVariantMovementSemantics,
	resolveVariantStockSemantics,
	type VariantOptionLike,
	type VariantProductFamily,
} from "@bikalpo-project/db/variant-definition";

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";
export type ThresholdSource = "variant" | "product" | null;
export type ConfigurationIssue =
	| "missing_product_family"
	| "missing_variant_definition"
	| "invalid_variant_definition";

export type StructuredStockSourceRow = {
	productId: number;
	variantId: number;
	coreProductId: number | null;
	productName: string;
	productIsActive: boolean;
	brandId: number | null;
	brandName: string | null;
	categoryId: number;
	categoryName: string;
	family: VariantProductFamily | null;
	sku: string | null;
	variantIsActive: boolean;
	sourceVariantOptionId: number | null;
	sourceVariantOption: VariantOptionLike | null;
	displayAlias?: string | null;
	availableQty: string | number | null;
	reservedQty: string | number | null;
	warehouseSellingPrice: string | number | null;
	variantReorderLevel: number | null;
	productReorderLevel: number | null;
};

export type StockQuantityGroup = {
	family: VariantProductFamily;
	familyLabel: string;
	inventoryUnit: string;
	productCount: number;
	variantCount: number;
	available: number;
	reserved: number;
	onHand: number;
	referenceMeasurement?: {
		unit: "kg" | "liter";
		available: number;
		reserved: number;
		onHand: number;
	};
};

export type StructuredStockVariant = {
	productId: number;
	variantId: number;
	productName: string;
	brandName: string | null;
	sku: string | null;
	canonicalLabel: string | null;
	displayAlias: string | null;
	family: VariantProductFamily | null;
	movementKind: "direct" | "loose" | "container" | null;
	inventoryUnit: string | null;
	available: number;
	reserved: number;
	onHand: number;
	referenceMeasurement?: {
		unit: "kg" | "liter";
		perInventoryUnit: number;
		available: number;
		reserved: number;
		onHand: number;
	};
	warehouseSellingPrice: number | null;
	sellingStockValue: number | null;
	reorderLevel: number | null;
	thresholdSource: ThresholdSource;
	thresholdConfigured: boolean;
	status: StockStatus;
	configurationState: "valid" | "needs_admin_variant_setup";
	configurationIssue: ConfigurationIssue | null;
};

export type StructuredStockDetailTarget =
	| { kind: "core"; id: number }
	| { kind: "product"; id: number };

export type StructuredStockDetailSourceRow = StructuredStockSourceRow & {
	coreProductName: string | null;
	coreProductSku: string | null;
	coreProductImage: string | null;
	productImage: string | null;
	productTypeName: string | null;
};

export type StructuredStockDetail = {
	identity: {
		kind: StructuredStockDetailTarget["kind"];
		id: number;
		name: string;
		image: string | null;
		coreSku: string | null;
		productTypeName: string | null;
		categoryName: string | null;
		productCount: number;
		variantCount: number;
	};
	quantityGroups: StockQuantityGroup[];
	stockStatus: StructuredStockDashboard["stockStatus"];
	variants: StructuredStockVariant[];
	configurationIssueCount: number;
};

export type StructuredBrandStockSourceRow = Omit<
	StructuredStockDetailSourceRow,
	"brandId" | "brandName"
> & {
	brandId: number;
	brandName: string;
	brandLogo: string | null;
	brandSlug: string;
};

export type AggregateStockStatus = "in_stock" | "attention" | "out_of_stock";

export type StructuredBrandStockOverviewItem = {
	brandId: number;
	brandName: string;
	brandLogo: string | null;
	brandSlug: string;
	productCount: number;
	variantCount: number;
	quantityGroups: StockQuantityGroup[];
	stockStatus: StructuredStockDashboard["stockStatus"];
	configurationIssueCount: number;
};

export type StructuredBrandProductGroup = {
	key: string;
	productId: number;
	coreProductId: number | null;
	name: string;
	image: string | null;
	productCount: number;
	variantCount: number;
	quantityGroups: StockQuantityGroup[];
	stockStatus: StructuredStockDashboard["stockStatus"];
	aggregateStatus: AggregateStockStatus;
	configurationIssueCount: number;
	variants: StructuredStockVariant[];
};

export type StructuredBrandStockDetail = {
	brand: {
		id: number;
		name: string;
		logo: string | null;
		slug: string;
	};
	summary: {
		productCount: number;
		variantCount: number;
		quantityGroups: StockQuantityGroup[];
		stockStatus: StructuredStockDashboard["stockStatus"];
		configurationIssueCount: number;
	};
	products: StructuredBrandProductGroup[];
};

export type StructuredStockDashboard = {
	summary: {
		activeProducts: number;
		activeVariants: number;
		sellingStockValue: number;
		pricedStockVariantCount: number;
		unpricedStockVariantCount: number;
	};
	stockStatus: {
		inStock: number;
		lowStock: number;
		outOfStock: number;
		reserved: number;
		missingThreshold: number;
	};
	quantityGroups: StockQuantityGroup[];
	categories: Array<{
		categoryId: number;
		categoryName: string;
		productCount: number;
		brandCount: number;
		sellingStockValue: number;
		unpricedStockVariantCount: number;
		quantityGroups: StockQuantityGroup[];
	}>;
	configurationIssueCount: number;
};

type QuantityGroupAccumulator = {
	family: VariantProductFamily;
	familyLabel: string;
	inventoryUnit: string;
	productIds: Set<number>;
	variantCount: number;
	available: number;
	reserved: number;
	onHand: number;
	referenceUnit: "kg" | "liter" | null;
	referenceAvailable: number;
	referenceReserved: number;
	referenceOnHand: number;
};

type CategoryAccumulator = {
	categoryId: number;
	categoryName: string;
	productIds: Set<number>;
	brandIds: Set<number>;
	sellingStockValue: number;
	unpricedStockVariantCount: number;
	quantityGroups: Map<string, QuantityGroupAccumulator>;
};

const numberFrom = (value: string | number | null | undefined) => {
	const parsed = Number(value ?? 0);
	return Number.isFinite(parsed) ? parsed : 0;
};

const positiveNumberOrNull = (value: string | number | null | undefined) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const cleanNumber = (value: number) =>
	Number.isFinite(value) ? Number(value.toFixed(6)) : 0;

export function formatFamilyLabel(family: VariantProductFamily) {
	return family
		.split("_")
		.map((part) =>
			part.length <= 3
				? part.toUpperCase()
				: `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
		)
		.join(" ");
}

function resolveThreshold(row: StructuredStockSourceRow) {
	const variantReorderLevel = row.variantReorderLevel ?? 0;
	if (variantReorderLevel > 0) {
		return {
			reorderLevel: variantReorderLevel,
			thresholdSource: "variant" as const,
		};
	}
	const productReorderLevel = row.productReorderLevel ?? 0;
	if (productReorderLevel > 0) {
		return {
			reorderLevel: productReorderLevel,
			thresholdSource: "product" as const,
		};
	}
	return { reorderLevel: null, thresholdSource: null };
}

function resolveStatus(
	available: number,
	reorderLevel: number | null,
): StockStatus {
	if (available <= 0) return "out_of_stock";
	if (reorderLevel !== null && available <= reorderLevel) return "low_stock";
	return "in_stock";
}

function quantityGroupKey(input: {
	family: VariantProductFamily;
	inventoryUnit: string;
	referenceUnit: "kg" | "liter" | null;
}) {
	return `${input.family}:${input.inventoryUnit}:${input.referenceUnit ?? "none"}`;
}

function addQuantityGroup(
	groups: Map<string, QuantityGroupAccumulator>,
	input: {
		family: VariantProductFamily;
		inventoryUnit: string;
		productId: number;
		available: number;
		reserved: number;
		onHand: number;
		referenceUnit: "kg" | "liter" | null;
		referencePerInventoryUnit: number;
	},
) {
	const key = quantityGroupKey(input);
	let group = groups.get(key);
	if (!group) {
		group = {
			family: input.family,
			familyLabel: formatFamilyLabel(input.family),
			inventoryUnit: input.inventoryUnit,
			productIds: new Set<number>(),
			variantCount: 0,
			available: 0,
			reserved: 0,
			onHand: 0,
			referenceUnit: input.referenceUnit,
			referenceAvailable: 0,
			referenceReserved: 0,
			referenceOnHand: 0,
		};
		groups.set(key, group);
	}

	group.productIds.add(input.productId);
	group.variantCount += 1;
	group.available += input.available;
	group.reserved += input.reserved;
	group.onHand += input.onHand;
	if (input.referenceUnit) {
		group.referenceAvailable +=
			input.available * input.referencePerInventoryUnit;
		group.referenceReserved += input.reserved * input.referencePerInventoryUnit;
		group.referenceOnHand += input.onHand * input.referencePerInventoryUnit;
	}
}

function finalizeQuantityGroups(groups: Map<string, QuantityGroupAccumulator>) {
	return Array.from(groups.values())
		.map<StockQuantityGroup>((group) => ({
			family: group.family,
			familyLabel: group.familyLabel,
			inventoryUnit: group.inventoryUnit,
			productCount: group.productIds.size,
			variantCount: group.variantCount,
			available: cleanNumber(group.available),
			reserved: cleanNumber(group.reserved),
			onHand: cleanNumber(group.onHand),
			...(group.referenceUnit
				? {
						referenceMeasurement: {
							unit: group.referenceUnit,
							available: cleanNumber(group.referenceAvailable),
							reserved: cleanNumber(group.referenceReserved),
							onHand: cleanNumber(group.referenceOnHand),
						},
					}
				: {}),
		}))
		.sort(
			(a, b) =>
				a.familyLabel.localeCompare(b.familyLabel) ||
				a.inventoryUnit.localeCompare(b.inventoryUnit) ||
				(a.referenceMeasurement?.unit ?? "").localeCompare(
					b.referenceMeasurement?.unit ?? "",
				),
		);
}

export function buildStructuredStockOverview(
	rows: StructuredStockSourceRow[],
): {
	dashboard: StructuredStockDashboard;
	variants: StructuredStockVariant[];
} {
	const productIds = new Set<number>();
	const quantityGroups = new Map<string, QuantityGroupAccumulator>();
	const categories = new Map<number, CategoryAccumulator>();
	const variants: StructuredStockVariant[] = [];

	let sellingStockValue = 0;
	let pricedStockVariantCount = 0;
	let unpricedStockVariantCount = 0;
	let inStock = 0;
	let lowStock = 0;
	let outOfStock = 0;
	let reservedCount = 0;
	let missingThreshold = 0;
	let configurationIssueCount = 0;

	for (const row of rows) {
		if (!row.productIsActive || !row.variantIsActive) continue;

		const available = numberFrom(row.availableQty);
		const reserved = numberFrom(row.reservedQty);
		const onHand = available + reserved;
		const warehouseSellingPrice = positiveNumberOrNull(
			row.warehouseSellingPrice,
		);
		const sellingValue =
			warehouseSellingPrice !== null && onHand > 0
				? cleanNumber(onHand * warehouseSellingPrice)
				: null;
		const { reorderLevel, thresholdSource } = resolveThreshold(row);
		const status = resolveStatus(available, reorderLevel);

		productIds.add(row.productId);
		if (status === "in_stock") inStock += 1;
		else if (status === "low_stock") lowStock += 1;
		else outOfStock += 1;
		if (reserved > 0) reservedCount += 1;
		if (reorderLevel === null) missingThreshold += 1;
		if (onHand > 0 && warehouseSellingPrice !== null) {
			pricedStockVariantCount += 1;
			sellingStockValue += sellingValue ?? 0;
		} else if (onHand > 0) {
			unpricedStockVariantCount += 1;
		}

		let categoryEntry = categories.get(row.categoryId);
		if (!categoryEntry) {
			categoryEntry = {
				categoryId: row.categoryId,
				categoryName: row.categoryName,
				productIds: new Set<number>(),
				brandIds: new Set<number>(),
				sellingStockValue: 0,
				unpricedStockVariantCount: 0,
				quantityGroups: new Map<string, QuantityGroupAccumulator>(),
			};
			categories.set(row.categoryId, categoryEntry);
		}
		categoryEntry.productIds.add(row.productId);
		if (row.brandId !== null) categoryEntry.brandIds.add(row.brandId);
		categoryEntry.sellingStockValue += sellingValue ?? 0;
		if (onHand > 0 && warehouseSellingPrice === null) {
			categoryEntry.unpricedStockVariantCount += 1;
		}

		let canonicalLabel: string | null = null;
		let displayAlias: string | null = row.displayAlias?.trim() || null;
		let movementKind: StructuredStockVariant["movementKind"] = null;
		let inventoryUnit: string | null = null;
		let referenceMeasurement:
			| StructuredStockVariant["referenceMeasurement"]
			| undefined;
		let configurationIssue: ConfigurationIssue | null = null;

		if (!row.family) {
			configurationIssue = "missing_product_family";
		} else if (!row.sourceVariantOption || row.sourceVariantOptionId === null) {
			configurationIssue = "missing_variant_definition";
		} else {
			try {
				const stockSemantics = resolveVariantStockSemantics(
					row.sourceVariantOption,
				);
				const movementSemantics = resolveVariantMovementSemantics(
					row.sourceVariantOption,
					row.family,
				);
				canonicalLabel = stockSemantics.canonicalLabel;
				if (!displayAlias && stockSemantics.displayLabel !== canonicalLabel) {
					displayAlias = stockSemantics.displayLabel;
				}
				movementKind = movementSemantics.movementKind;
				inventoryUnit = movementSemantics.inventoryUnit;

				const referenceUnit =
					movementSemantics.referenceMeasurement?.unit ?? null;
				const referencePerInventoryUnit = numberFrom(
					movementSemantics.referenceMeasurement?.perInventoryUnit,
				);
				if (referenceUnit && referencePerInventoryUnit > 0) {
					referenceMeasurement = {
						unit: referenceUnit,
						perInventoryUnit: referencePerInventoryUnit,
						available: cleanNumber(available * referencePerInventoryUnit),
						reserved: cleanNumber(reserved * referencePerInventoryUnit),
						onHand: cleanNumber(onHand * referencePerInventoryUnit),
					};
				}

				const groupInput = {
					family: row.family,
					inventoryUnit,
					productId: row.productId,
					available,
					reserved,
					onHand,
					referenceUnit,
					referencePerInventoryUnit,
				};
				addQuantityGroup(quantityGroups, groupInput);
				addQuantityGroup(categoryEntry.quantityGroups, groupInput);
			} catch {
				configurationIssue = "invalid_variant_definition";
			}
		}

		if (configurationIssue) configurationIssueCount += 1;

		variants.push({
			productId: row.productId,
			variantId: row.variantId,
			productName: row.productName,
			brandName: row.brandName,
			sku: row.sku,
			canonicalLabel,
			displayAlias,
			family: configurationIssue ? null : row.family,
			movementKind,
			inventoryUnit,
			available: cleanNumber(available),
			reserved: cleanNumber(reserved),
			onHand: cleanNumber(onHand),
			...(referenceMeasurement ? { referenceMeasurement } : {}),
			warehouseSellingPrice,
			sellingStockValue: sellingValue,
			reorderLevel,
			thresholdSource,
			thresholdConfigured: reorderLevel !== null,
			status,
			configurationState: configurationIssue
				? "needs_admin_variant_setup"
				: "valid",
			configurationIssue,
		});
	}

	variants.sort(
		(a, b) =>
			a.productName.localeCompare(b.productName) ||
			(a.brandName ?? "").localeCompare(b.brandName ?? "") ||
			(a.canonicalLabel ?? "").localeCompare(b.canonicalLabel ?? "") ||
			a.variantId - b.variantId,
	);

	return {
		dashboard: {
			summary: {
				activeProducts: productIds.size,
				activeVariants: variants.length,
				sellingStockValue: cleanNumber(sellingStockValue),
				pricedStockVariantCount,
				unpricedStockVariantCount,
			},
			stockStatus: {
				inStock,
				lowStock,
				outOfStock,
				reserved: reservedCount,
				missingThreshold,
			},
			quantityGroups: finalizeQuantityGroups(quantityGroups),
			categories: Array.from(categories.values())
				.map((category) => ({
					categoryId: category.categoryId,
					categoryName: category.categoryName,
					productCount: category.productIds.size,
					brandCount: category.brandIds.size,
					sellingStockValue: cleanNumber(category.sellingStockValue),
					unpricedStockVariantCount: category.unpricedStockVariantCount,
					quantityGroups: finalizeQuantityGroups(category.quantityGroups),
				}))
				.sort(
					(a, b) =>
						b.sellingStockValue - a.sellingStockValue ||
						a.categoryName.localeCompare(b.categoryName),
				),
			configurationIssueCount,
		},
		variants,
	};
}

export function buildStructuredStockDetail(
	target: StructuredStockDetailTarget,
	rows: StructuredStockDetailSourceRow[],
): StructuredStockDetail | null {
	const matchingRows = rows.filter((row) => {
		if (!row.productIsActive || !row.variantIsActive) return false;
		return target.kind === "core"
			? row.coreProductId === target.id
			: row.productId === target.id;
	});

	if (matchingRows.length === 0) return null;

	const snapshot = buildStructuredStockOverview(matchingRows);
	if (snapshot.variants.length === 0) return null;

	const first = matchingRows[0];
	if (!first) return null;
	const productCount = new Set(
		snapshot.variants.map((variant) => variant.productId),
	).size;

	return {
		identity: {
			kind: target.kind,
			id: target.id,
			name:
				target.kind === "core"
					? first.coreProductName || first.productName
					: first.productName,
			image:
				target.kind === "core"
					? first.coreProductImage || first.productImage
					: first.productImage,
			coreSku: first.coreProductSku,
			productTypeName: first.productTypeName,
			categoryName: first.categoryName,
			productCount,
			variantCount: snapshot.variants.length,
		},
		quantityGroups: snapshot.dashboard.quantityGroups,
		stockStatus: snapshot.dashboard.stockStatus,
		variants: snapshot.variants,
		configurationIssueCount: snapshot.dashboard.configurationIssueCount,
	};
}

function resolveAggregateStatus(
	variants: StructuredStockVariant[],
): AggregateStockStatus {
	if (
		variants.length === 0 ||
		variants.every((variant) => variant.status === "out_of_stock")
	) {
		return "out_of_stock";
	}
	if (variants.some((variant) => variant.status !== "in_stock")) {
		return "attention";
	}
	return "in_stock";
}

export function buildStructuredBrandStockOverview(
	rows: StructuredBrandStockSourceRow[],
): StructuredBrandStockOverviewItem[] {
	const rowsByBrand = new Map<number, StructuredBrandStockSourceRow[]>();

	for (const row of rows) {
		const brandRows = rowsByBrand.get(row.brandId) ?? [];
		brandRows.push(row);
		rowsByBrand.set(row.brandId, brandRows);
	}

	return Array.from(rowsByBrand.values())
		.flatMap((brandRows) => {
			const first = brandRows[0];
			if (!first) return [];
			const snapshot = buildStructuredStockOverview(brandRows);
			return [
				{
					brandId: first.brandId,
					brandName: first.brandName,
					brandLogo: first.brandLogo,
					brandSlug: first.brandSlug,
					productCount: snapshot.dashboard.summary.activeProducts,
					variantCount: snapshot.dashboard.summary.activeVariants,
					quantityGroups: snapshot.dashboard.quantityGroups,
					stockStatus: snapshot.dashboard.stockStatus,
					configurationIssueCount:
						snapshot.dashboard.configurationIssueCount,
				},
			];
		})
		.filter((brand) => brand.variantCount > 0)
		.sort(
			(a, b) =>
				b.variantCount - a.variantCount ||
				a.brandName.localeCompare(b.brandName),
		);
}

export function buildStructuredBrandStockDetail(
	brandId: number,
	rows: StructuredBrandStockSourceRow[],
): StructuredBrandStockDetail | null {
	const brandRows = rows.filter(
		(row) =>
			row.brandId === brandId && row.productIsActive && row.variantIsActive,
	);
	if (brandRows.length === 0) return null;

	const snapshot = buildStructuredStockOverview(brandRows);
	if (snapshot.variants.length === 0) return null;

	const rowsByProductGroup = new Map<
		string,
		StructuredBrandStockSourceRow[]
	>();

	for (const row of brandRows) {
		const key = row.coreProductId
			? `core_${row.coreProductId}`
			: `product_${row.productId}`;
		const groupRows = rowsByProductGroup.get(key) ?? [];
		groupRows.push(row);
		rowsByProductGroup.set(key, groupRows);
	}

	const products = Array.from(rowsByProductGroup.entries())
		.flatMap(([key, groupRows]) => {
			const first = groupRows[0];
			if (!first) return [];
			const groupSnapshot = buildStructuredStockOverview(groupRows);
			return [
				{
					key,
					productId: first.productId,
					coreProductId: first.coreProductId,
					name: first.coreProductName || first.productName,
					image: first.coreProductImage || first.productImage,
					productCount: groupSnapshot.dashboard.summary.activeProducts,
					variantCount: groupSnapshot.dashboard.summary.activeVariants,
					quantityGroups: groupSnapshot.dashboard.quantityGroups,
					stockStatus: groupSnapshot.dashboard.stockStatus,
					aggregateStatus: resolveAggregateStatus(groupSnapshot.variants),
					configurationIssueCount:
						groupSnapshot.dashboard.configurationIssueCount,
					variants: groupSnapshot.variants,
				},
			];
		})
		.filter((product) => product.variantCount > 0)
		.sort((a, b) => a.name.localeCompare(b.name));

	const first = brandRows[0];
	if (!first) return null;
	return {
		brand: {
			id: first.brandId,
			name: first.brandName,
			logo: first.brandLogo,
			slug: first.brandSlug,
		},
		summary: {
			productCount: snapshot.dashboard.summary.activeProducts,
			variantCount: snapshot.dashboard.summary.activeVariants,
			quantityGroups: snapshot.dashboard.quantityGroups,
			stockStatus: snapshot.dashboard.stockStatus,
			configurationIssueCount:
				snapshot.dashboard.configurationIssueCount,
		},
		products,
	};
}
