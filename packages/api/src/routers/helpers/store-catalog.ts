import { db } from "@bikalpo-project/db";
import {
  category,
  coreProductIdentity,
  productType,
  subCategory,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  type CatalogOwner,
  coreVisibleToOwner,
  findOrCreateStoreBrand,
} from "./catalog-owner";
import { assignCoreProductCode } from "./core-catalog-code";
import { nextSkuCode } from "./generate-sku";
import { ensureCoreProductShortCode } from "./sellable-sku";
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

/** Create Product "Add" in the Sub category search. */
export const createStoreSubCategoryInput = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().trim().min(2).max(100),
});

/** Create Product "Add" in the Core identity search. */
export const createStoreCoreProductInput = z.object({
  categoryId: z.number().int().positive(),
  subCategoryId: z.number().int().positive().nullish(),
  name: z.string().trim().min(2).max(150),
});

function catalogSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function tidyName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Type, Category, Sub category and Core identity options for the seller's
 * Create Product pickers. Core identities are the admin catalog plus the
 * store's own.
 */
export async function storeIdentityOptions(owner: CatalogOwner) {
  const [types, categories, subCategories, coreProducts] = await Promise.all([
    db.query.productType.findMany({
      where: eq(productType.isActive, true),
      orderBy: [asc(productType.displayOrder), asc(productType.name)],
      columns: { id: true, name: true },
    }),
    db.query.category.findMany({
      where: eq(category.isActive, true),
      orderBy: [asc(category.displayOrder), asc(category.name)],
      columns: { id: true, name: true, typeId: true },
    }),
    db.query.subCategory.findMany({
      where: eq(subCategory.isActive, true),
      orderBy: [asc(subCategory.displayOrder), asc(subCategory.name)],
      columns: { id: true, name: true, categoryId: true },
    }),
    db.query.coreProductIdentity.findMany({
      where: and(
        eq(coreProductIdentity.isActive, true),
        coreVisibleToOwner(owner),
      ),
      orderBy: [asc(coreProductIdentity.name)],
      columns: { id: true, name: true, categoryId: true, subCategoryId: true },
    }),
  ]);
  return { types, categories, subCategories, coreProducts };
}

async function assertActiveCategory(categoryId: number) {
  const row = await db.query.category.findFirst({
    where: and(eq(category.id, categoryId), eq(category.isActive, true)),
    columns: { id: true },
    with: { type: { columns: { isActive: true } } },
  });
  if (!row || !row.type?.isActive) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Choose an active category first",
    });
  }
}

/**
 * A sub category typed in the seller's search. Sub categories are shared
 * (they have no store owner), so one with the same name in the category is
 * reused; otherwise it is added the way admin adds one.
 */
export async function createStoreSubCategory(
  input: z.infer<typeof createStoreSubCategoryInput>,
) {
  const name = tidyName(input.name);
  await assertActiveCategory(input.categoryId);
  const existing = await db.query.subCategory.findFirst({
    where: and(
      eq(subCategory.categoryId, input.categoryId),
      sql`lower(${subCategory.name}) = lower(${name})`,
    ),
    columns: { id: true, name: true, categoryId: true, isActive: true },
  });
  if (existing) {
    if (!existing.isActive) {
      throw new ORPCError("CONFLICT", {
        message: `${existing.name} exists but is turned off. Ask admin to turn it on.`,
      });
    }
    return { subCategory: existing, created: false };
  }

  const base = catalogSlug(name) || "sub-category";
  return db.transaction(async (tx) => {
    const database = tx as unknown as typeof db;
    let slug = base;
    for (let attempt = 2; attempt < 50; attempt += 1) {
      const taken = await database.query.subCategory.findFirst({
        where: eq(subCategory.slug, slug),
        columns: { id: true },
      });
      if (!taken) break;
      slug = `${base}-${attempt}`.slice(0, 100);
    }
    const skuCode = await nextSkuCode(
      subCategory,
      subCategory.skuCode,
      2,
      sql`${subCategory.categoryId} = ${input.categoryId}`,
      database,
    );
    const [created] = await database
      .insert(subCategory)
      .values({ name, slug, categoryId: input.categoryId, skuCode })
      .returning({
        id: subCategory.id,
        name: subCategory.name,
        categoryId: subCategory.categoryId,
        isActive: subCategory.isActive,
      });
    if (!created) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "The sub category could not be added",
      });
    }
    return { subCategory: created, created: true };
  });
}

/**
 * A core identity typed in the seller's search: a store-only core product
 * (like store brands and sizes) that only this store sees. One the store
 * can already see with the same name is reused.
 */
export async function createStoreCoreProduct(
  owner: CatalogOwner,
  input: z.infer<typeof createStoreCoreProductInput>,
) {
  const name = tidyName(input.name);
  const slug = catalogSlug(name);
  if (!slug) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Enter a core identity name with letters or numbers",
    });
  }
  await assertActiveCategory(input.categoryId);
  const subCategoryId = input.subCategoryId ?? null;
  if (subCategoryId) {
    const sub = await db.query.subCategory.findFirst({
      where: and(
        eq(subCategory.id, subCategoryId),
        eq(subCategory.categoryId, input.categoryId),
        eq(subCategory.isActive, true),
      ),
      columns: { id: true },
    });
    if (!sub) {
      throw new ORPCError("BAD_REQUEST", {
        message: "That sub category is not in the chosen category",
      });
    }
  }

  const sameName = await db.query.coreProductIdentity.findFirst({
    where: sql`lower(${coreProductIdentity.name}) = lower(${name}) or ${coreProductIdentity.slug} = ${slug}`,
    columns: {
      id: true,
      name: true,
      categoryId: true,
      subCategoryId: true,
      isActive: true,
      creatorSource: true,
      createdById: true,
    },
  });
  if (sameName) {
    const visible =
      sameName.creatorSource === "admin" ||
      (sameName.creatorSource === owner.ownerType &&
        sameName.createdById === owner.ownerId);
    if (visible && sameName.isActive) {
      return {
        coreProduct: {
          id: sameName.id,
          name: sameName.name,
          categoryId: sameName.categoryId,
          subCategoryId: sameName.subCategoryId,
        },
        created: false,
      };
    }
    throw new ORPCError("CONFLICT", {
      message: `"${name}" is already used in the catalog. Pick it from the list or use another name.`,
    });
  }

  return db.transaction(async (tx) => {
    const database = tx as unknown as typeof db;
    const { sku, catalogCode } = await assignCoreProductCode(database, {
      categoryId: input.categoryId,
      subCategoryId,
    });
    const [created] = await database
      .insert(coreProductIdentity)
      .values({
        sku,
        catalogCode,
        name,
        slug,
        image: "",
        categoryId: input.categoryId,
        subCategoryId,
        createdById: owner.ownerId,
        creatorSource: owner.ownerType,
        isActive: true,
        brandCreationMode: "batch",
      })
      .returning({
        id: coreProductIdentity.id,
        name: coreProductIdentity.name,
        categoryId: coreProductIdentity.categoryId,
        subCategoryId: coreProductIdentity.subCategoryId,
      });
    if (!created) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "The core identity could not be added",
      });
    }
    await ensureCoreProductShortCode(database, created.id);
    return { coreProduct: created, created: true };
  });
}
