import { db } from "@bikalpo-project/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import {
  type CatalogOwner,
  findOrCreateStoreBrand,
} from "./catalog-owner";
import {
  createStructuredVariantOption,
  variantDefinitionInputSchema,
} from "./structured-variant-option";
import { isConcreteVariantOption } from "./sync-generated-variants";

/** Seller "Create brand" from the Create Product brand picker. */
export const createStoreBrandInput = z.object({
  name: z.string().trim().min(2).max(100),
});

/** Seller "+ variant" from Create Product, scoped to the core product. */
export const createStoreVariantInput = z.object({
  coreProductId: z.number().int().positive(),
  definition: variantDefinitionInputSchema,
  displayAlias: z.string().trim().max(100).optional(),
});

export async function createStoreBrand(
  owner: CatalogOwner,
  input: z.infer<typeof createStoreBrandInput>,
) {
  const result = await findOrCreateStoreBrand(db, owner, input.name);
  return {
    brand: {
      id: result.brand.id,
      name: result.brand.name,
      slug: result.brand.slug,
      logo: result.brand.logo,
      isActive: result.brand.isActive,
      ownerType: result.brand.ownerType,
      ownerId: result.brand.ownerId,
    },
    created: result.created,
  };
}

/**
 * Store-only variant for this seller, created directly (no admin request).
 * It is scoped to the core product's type and category, and a matching
 * variant the store can already use is returned instead of a duplicate.
 */
export async function createStoreVariant(
  owner: CatalogOwner,
  input: z.infer<typeof createStoreVariantInput>,
) {
  const core = await db.query.coreProductIdentity.findFirst({
    where: (row, { eq }) => eq(row.id, input.coreProductId),
    columns: { id: true, categoryId: true },
    with: { category: { columns: { typeId: true } } },
  });
  const typeId = core?.category?.typeId;
  if (!core || !typeId) {
    throw new ORPCError("NOT_FOUND", {
      message: "Core product not found",
    });
  }
  const option = await createStructuredVariantOption(
    {
      definition: input.definition,
      displayAlias: input.displayAlias,
      typeId,
      categoryId: core.categoryId,
      sortOrder: 0,
    },
    db,
    { owner, reuseExisting: true },
  );
  if (!isConcreteVariantOption(option)) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Enter a size and unit for this variant",
    });
  }
  return option;
}
