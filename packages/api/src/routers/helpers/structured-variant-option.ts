import { db } from "@bikalpo-project/db";
import { buildProductTypeFulfillmentProfile } from "@bikalpo-project/db/fulfillment";
import {
  category,
  productType,
  variantOption,
} from "@bikalpo-project/db/schema";
import {
  formatVariantDefinition,
  variantDefinitionSignature,
  withDerivedOperationalUnit,
} from "@bikalpo-project/db/variant-definition";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { type CatalogOwner, visibleToOwner } from "./catalog-owner";
import { nextSkuCode } from "./generate-sku";
import type { StructuredVariantOptionInput } from "./structured-variant-option-schema";

export type { StructuredVariantOptionInput } from "./structured-variant-option-schema";
export {
  structuredVariantOptionInputSchema,
  variantDefinitionInputSchema,
} from "./structured-variant-option-schema";

type VariantOptionDatabase = typeof db;

export async function prepareStructuredVariantOption(
  input: StructuredVariantOptionInput,
  database: VariantOptionDatabase = db,
) {
  const type = await database.query.productType.findFirst({
    where: eq(productType.id, input.typeId),
  });
  if (!type?.isActive) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Select an active Product Type",
    });
  }

  if (input.categoryId !== null) {
    const scopedCategory = await database.query.category.findFirst({
      where: and(
        eq(category.id, input.categoryId),
        eq(category.typeId, input.typeId),
      ),
      columns: { id: true, isActive: true },
    });
    if (!scopedCategory?.isActive) {
      throw new ORPCError("BAD_REQUEST", {
        message: "The selected category does not belong to this Product Type",
      });
    }
  }

  const definition = withDerivedOperationalUnit(
    input.definition,
    buildProductTypeFulfillmentProfile(type).family,
  );

  return {
    definition,
    name: formatVariantDefinition(definition),
    signature: variantDefinitionSignature(definition),
  };
}

export async function createStructuredVariantOption(
  input: StructuredVariantOptionInput,
  database: VariantOptionDatabase = db,
  options: {
    /** Store-only variant for this shop or warehouse; null/undefined = global. */
    owner?: CatalogOwner | null;
    /**
     * Inline "+ variant" from Create Product: return a matching variant the
     * creator can already use (global type-wide/category, or their own)
     * instead of failing with CONFLICT.
     */
    reuseExisting?: boolean;
  } = {},
) {
  const owner = options.owner ?? null;
  const prepared = await prepareStructuredVariantOption(input, database);
  if (options.reuseExisting) {
    const usable = await database.query.variantOption.findFirst({
      where: and(
        eq(variantOption.canonicalSignature, prepared.signature),
        eq(variantOption.typeId, input.typeId),
        eq(variantOption.isActive, true),
        input.categoryId === null
          ? isNull(variantOption.categoryId)
          : or(
              isNull(variantOption.categoryId),
              eq(variantOption.categoryId, input.categoryId),
            ),
        visibleToOwner(variantOption, owner),
      ),
    });
    if (usable) return usable;
  }
  const duplicateConditions = [
    eq(variantOption.canonicalSignature, prepared.signature),
    eq(variantOption.typeId, input.typeId),
    input.categoryId === null
      ? isNull(variantOption.categoryId)
      : eq(variantOption.categoryId, input.categoryId),
    owner
      ? eq(variantOption.ownerId, owner.ownerId)
      : isNull(variantOption.ownerId),
  ];
  const duplicate = await database.query.variantOption.findFirst({
    where: and(...duplicateConditions),
    columns: { id: true },
  });
  if (duplicate) {
    throw new ORPCError("CONFLICT", {
      message: "The same structured variant already exists in this scope",
    });
  }

  // Global variants take a 2-digit code within their scope; store variants
  // take none so they never use up the shared code space.
  const skuScope =
    input.categoryId === null
      ? sql`${variantOption.typeId} = ${input.typeId} AND ${variantOption.categoryId} IS NULL`
      : sql`${variantOption.typeId} = ${input.typeId} AND ${variantOption.categoryId} = ${input.categoryId}`;
  const skuCode = owner
    ? null
    : await nextSkuCode(
        variantOption,
        variantOption.skuCode,
        2,
        sql`${skuScope} AND ${variantOption.ownerId} IS NULL`,
        database,
      );

  const [created] = await database
    .insert(variantOption)
    .values({
      name: prepared.name,
      unit:
        "measurementUnit" in prepared.definition
          ? prepared.definition.measurementUnit
          : prepared.definition.operationalUnit || "unit",
      size: "value" in prepared.definition ? prepared.definition.value : null,
      variantType: prepared.definition.kind === "loose" ? "loose" : "pack",
      definitionKind: prepared.definition.kind,
      definition: prepared.definition,
      displayAlias: input.displayAlias || null,
      canonicalSignature: prepared.signature,
      needsReview: false,
      typeId: input.typeId,
      categoryId: input.categoryId,
      sortOrder: input.sortOrder,
      skuCode,
      ownerType: owner?.ownerType ?? null,
      ownerId: owner?.ownerId ?? null,
    })
    .returning();

  if (!created) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Failed to create Variant Option",
    });
  }
  return created;
}
