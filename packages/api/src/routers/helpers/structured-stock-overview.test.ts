import assert from "node:assert/strict";
import test from "node:test";
import {
	buildStructuredStockOverview,
	type StructuredStockSourceRow,
} from "./structured-stock-overview";

const structuredOption = (input: {
	value: string;
	measurementUnit: string;
	container: string;
	operationalUnit: string;
	needsReview?: boolean;
}) => ({
	name: `${input.value} ${input.measurementUnit} ${input.container}`,
	definitionKind: "measurement",
	definition: {
		kind: "measurement",
		value: input.value,
		measurementUnit: input.measurementUnit,
		container: input.container,
		operationalUnit: input.operationalUnit,
	},
	needsReview: input.needsReview ?? false,
});

function sourceRow(
	input: Partial<StructuredStockSourceRow> &
		Pick<StructuredStockSourceRow, "productId" | "variantId">,
): StructuredStockSourceRow {
	return {
		productId: input.productId,
		variantId: input.variantId,
		coreProductId: input.coreProductId ?? input.productId,
		productName: input.productName ?? `Product ${input.productId}`,
		productIsActive: input.productIsActive ?? true,
		brandId: input.brandId ?? input.productId,
		brandName: input.brandName ?? `Brand ${input.productId}`,
		categoryId: input.categoryId ?? 1,
		categoryName: input.categoryName ?? "LPG",
		family: input.family === undefined ? "lpg" : input.family,
		sku: input.sku ?? `SKU-${input.variantId}`,
		variantIsActive: input.variantIsActive ?? true,
		sourceVariantOptionId:
			input.sourceVariantOptionId === undefined
				? input.variantId
				: input.sourceVariantOptionId,
		sourceVariantOption:
			input.sourceVariantOption === undefined
				? structuredOption({
						value: "12",
						measurementUnit: "KG",
						container: "cylinder",
						operationalUnit: "cylinder",
					})
				: input.sourceVariantOption,
		displayAlias: input.displayAlias ?? null,
		availableQty: input.availableQty ?? 0,
		reservedQty: input.reservedQty ?? 0,
		warehouseSellingPrice: input.warehouseSellingPrice ?? null,
		variantReorderLevel: input.variantReorderLevel ?? 0,
		productReorderLevel: input.productReorderLevel ?? 0,
	};
}

test("aggregates current LPG inventory as cylinders with reference KG", () => {
	const capacities = [
		[12, 50, 1],
		[12, 40, 2],
		[35, 30, 2],
		[45, 15, 2],
		[12, 60, 3],
		[25, 40, 3],
		[35, 30, 3],
		[45, 20, 3],
	] as const;
	const rows = capacities.map(([capacity, quantity, productId], index) =>
		sourceRow({
			productId,
			variantId: index + 1,
			availableQty: quantity,
			sourceVariantOption: structuredOption({
				value: String(capacity),
				measurementUnit: "KG",
				container: "cylinder",
				operationalUnit: "cylinder",
			}),
		}),
	);

	const { dashboard } = buildStructuredStockOverview(rows);

	assert.equal(dashboard.summary.activeProducts, 3);
	assert.equal(dashboard.summary.activeVariants, 8);
	assert.equal(dashboard.summary.unpricedStockVariantCount, 8);
	assert.equal(dashboard.stockStatus.inStock, 8);
	assert.equal(dashboard.stockStatus.missingThreshold, 8);
	assert.deepEqual(dashboard.quantityGroups, [
		{
			family: "lpg",
			familyLabel: "LPG",
			inventoryUnit: "cylinder",
			productCount: 3,
			variantCount: 8,
			available: 285,
			reserved: 0,
			onHand: 285,
			referenceMeasurement: {
				unit: "kg",
				available: 6475,
				reserved: 0,
				onHand: 6475,
			},
		},
	]);
});

test("keeps reservation in on-hand selling value and uses configured thresholds only", () => {
	const { dashboard, variants } = buildStructuredStockOverview([
		sourceRow({
			productId: 1,
			variantId: 1,
			availableQty: 10,
			reservedQty: 2,
			warehouseSellingPrice: "100",
			productReorderLevel: 5,
		}),
		sourceRow({
			productId: 2,
			variantId: 2,
			availableQty: 4,
			warehouseSellingPrice: "200",
			variantReorderLevel: 5,
		}),
		sourceRow({
			productId: 3,
			variantId: 3,
			availableQty: 1,
			warehouseSellingPrice: null,
		}),
	]);

	assert.equal(dashboard.summary.sellingStockValue, 2000);
	assert.equal(dashboard.summary.pricedStockVariantCount, 2);
	assert.equal(dashboard.summary.unpricedStockVariantCount, 1);
	assert.equal(dashboard.stockStatus.reserved, 1);
	assert.equal(dashboard.stockStatus.lowStock, 1);
	assert.equal(dashboard.stockStatus.inStock, 2);
	assert.equal(dashboard.stockStatus.missingThreshold, 1);
	assert.equal(variants[0]?.onHand, 12);
	assert.equal(variants[0]?.sellingStockValue, 1200);
	assert.equal(variants[0]?.thresholdSource, "product");
	assert.equal(variants[1]?.thresholdSource, "variant");
});

test("does not combine unlike structured inventory units", () => {
	const { dashboard } = buildStructuredStockOverview([
		sourceRow({ productId: 1, variantId: 1, availableQty: 5 }),
		sourceRow({
			productId: 2,
			variantId: 2,
			family: "bulk_liquid",
			categoryId: 2,
			categoryName: "Oil",
			availableQty: 3,
			sourceVariantOption: structuredOption({
				value: "5",
				measurementUnit: "L",
				container: "bottle",
				operationalUnit: "bottle",
			}),
		}),
	]);

	assert.equal(dashboard.quantityGroups.length, 2);
	assert.deepEqual(
		dashboard.quantityGroups.map((group) => [
			group.family,
			group.inventoryUnit,
			group.available,
		]),
		[
			["bulk_liquid", "bottle", 3],
			["lpg", "cylinder", 5],
		],
	);
});

test("keeps aliases display-only and reports invalid Admin definitions", () => {
	const { dashboard, variants } = buildStructuredStockOverview([
		sourceRow({
			productId: 1,
			variantId: 1,
			availableQty: 7,
			displayAlias: "Home cylinder",
		}),
		sourceRow({
			productId: 2,
			variantId: 2,
			availableQty: 4,
			sourceVariantOption: structuredOption({
				value: "35",
				measurementUnit: "KG",
				container: "cylinder",
				operationalUnit: "cylinder",
				needsReview: true,
			}),
		}),
	]);

	assert.equal(variants[0]?.canonicalLabel, "12 KG cylinder");
	assert.equal(variants[0]?.displayAlias, "Home cylinder");
	assert.equal(variants[0]?.inventoryUnit, "cylinder");
	assert.equal(variants[1]?.configurationState, "needs_admin_variant_setup");
	assert.equal(variants[1]?.inventoryUnit, null);
	assert.equal(dashboard.configurationIssueCount, 1);
	assert.equal(dashboard.quantityGroups[0]?.available, 7);
});
