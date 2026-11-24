import { db } from "@bikalpo-project/db";
import {
  adminProductGenerationTemplate,
  brand,
  catalogVariant,
  coreProductIdentity,
  product,
  productVariantPrice,
  shopProductGenerationTemplate,
  warehouseProductGenerationTemplate,
} from "@bikalpo-project/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  ownerProductCondition,
  type ProductListOwner,
} from "./owner-product-list";
import { withProductCodes } from "./product-codes";
import { attachExchangeSettingsToVariantPrices } from "./sync-generated-variants";

/**
 * The catalog product page: one admin Brand Product with everything the page
 * shows. Admin gets it as stored; sellers get the same data with every price
 * removed on the server, so masked prices never reach their browser.
 */

export async function loadAdminCatalogProductDetail(productId: number) {
  const foundProduct = await db.query.product.findFirst({
    where: and(eq(product.id, productId), eq(product.creatorSource, "admin")),
    with: {
      // The type's family tells the page whether this is an LPG product.
      category: { with: { type: true } },
      // Its 8-digit code starts every 13-digit product code.
      coreProduct: { columns: { catalogCode: true } },
      subCategory: true,
      brand: true,
      images: true,
      productBrands: {
        with: { brand: true },
      },
      variantPrices: {
        with: {
          variantOption: true,
        },
      },
      variants: {
        columns: {
          id: true,
          unitLabel: true,
          variantType: true,
          brandId: true,
          exchangeCreditAmount: true,
          exchangeEnabled: true,
          sourceVariantOptionId: true,
        },
      },
    },
  });
  if (!foundProduct) return null;

  // Each brand + variant row maps to one shared catalog variant and its SKU.
  const catalogVariants = foundProduct.coreProductId
    ? await db.query.catalogVariant.findMany({
        where: eq(catalogVariant.coreProductId, foundProduct.coreProductId),
        columns: { brandId: true, variantOptionId: true, sku: true },
      })
    : [];
  const skuByIdentity = new Map(
    catalogVariants.map((row) => [
      `${row.brandId ?? "none"}:${row.variantOptionId}`,
      row.sku,
    ]),
  );
  const detail = withProductCodes(
    attachExchangeSettingsToVariantPrices(foundProduct),
  );

  return {
    ...detail,
    // The exchange helper adds these fields, but its generic return type drops them.
    variantPrices: (
      detail.variantPrices as Array<
        (typeof detail.variantPrices)[number] & {
          exchangeCreditAmount: string;
          exchangeEnabled: boolean;
        }
      >
    ).map((price) => ({
      ...price,
      catalogSku:
        skuByIdentity.get(
          `${price.brandId ?? foundProduct.brandId ?? "none"}:${price.variantOptionId}`,
        ) ?? null,
    })),
  };
}

type AdminCatalogProductDetail = NonNullable<
  Awaited<ReturnType<typeof loadAdminCatalogProductDetail>>
>;

/** The detail with product, variant, and exchange prices taken out. */
export function withoutPrices(detail: AdminCatalogProductDetail) {
  const { price: _price, variantPrices, variants, ...rest } = detail;
  return {
    ...rest,
    variantPrices: variantPrices.map(
      ({
        consumerPrice: _consumerPrice,
        exchangeCreditAmount: _exchangeCreditAmount,
        ...variantPrice
      }) => variantPrice,
    ),
    variants: variants.map(
      ({ exchangeCreditAmount: _exchangeCreditAmount, ...variant }) => variant,
    ),
  };
}

export const catalogProductViewInput = z.object({
  coreProductId: z.number().int().positive(),
  /** Admin brand product to show; the first brand when omitted or unknown. */
  productId: z.number().int().positive().optional(),
});

/**
 * The page for a catalog item admin has not set up a brand for: what the core
 * product itself holds, in the same shape as a brand product. There is no
 * brand, size, price, or rule yet; the seller chooses those when adding it.
 */
export async function loadCatalogItemDetail(coreProductId: number) {
  const core = await db.query.coreProductIdentity.findFirst({
    where: eq(coreProductIdentity.id, coreProductId),
    with: {
      category: { with: { type: true } },
      subCategory: true,
    },
  });
  if (!core) return null;
  return {
    id: core.id,
    name: core.name,
    slug: core.slug,
    catalogCode: core.catalogCode,
    image: core.image,
    description: core.description,
    status: core.isActive ? "active" : "inactive",
    category: core.category,
    subCategory: core.subCategory,
  };
}

/**
 * A seller's view of a catalog core product: the brand products admin offers
 * for it, the chosen one's detail without prices, and the seller's own copy
 * of that brand product if they already added it. While admin has not set up
 * any brand, `product` is null and `item` holds the core product's own detail.
 */
export async function getSellerCatalogProductView(
  owner: ProductListOwner,
  input: z.infer<typeof catalogProductViewInput>,
) {
  const [core] = await db
    .select({ id: coreProductIdentity.id, name: coreProductIdentity.name })
    .from(coreProductIdentity)
    .where(eq(coreProductIdentity.id, input.coreProductId));
  if (!core) return null;

  const brandProducts = await db
    .select({
      productId: product.id,
      brandName: brand.name,
      productCode: product.catalogCode,
    })
    .from(product)
    .leftJoin(brand, eq(product.brandId, brand.id))
    .where(
      and(
        eq(product.creatorSource, "admin"),
        eq(product.coreProductId, input.coreProductId),
        eq(product.status, "active"),
      ),
    )
    .orderBy(asc(brand.name), asc(product.id));

  const selected =
    brandProducts.find((item) => item.productId === input.productId) ??
    brandProducts[0];
  const detail = selected
    ? await loadAdminCatalogProductDetail(selected.productId)
    : null;
  if (!selected || !detail) {
    return {
      core,
      product: null,
      item: await loadCatalogItemDetail(core.id),
      brands: [],
      selectedProductId: null,
      ownProductId: null,
    };
  }

  const [ownProduct] = selected.productCode
    ? await db
        .select({ id: product.id })
        .from(product)
        .where(
          and(
            ownerProductCondition(owner),
            eq(product.catalogCode, selected.productCode),
          ),
        )
        .limit(1)
    : [];

  return {
    core,
    product: withoutPrices(detail),
    item: null,
    brands: brandProducts.map((item) => ({
      productId: item.productId,
      brandName: item.brandName ?? "Unbranded",
    })),
    selectedProductId: selected.productId,
    ownProductId: ownProduct?.id ?? null,
  };
}

/**
 * What adding an admin brand product to a seller's products saves: the brand,
 * the sizes admin set up for it, and the seller's own defaults for the core
 * product (or admin's, the first time). The result goes to the same configure
 * procedure the Add page uses. `ownProductId` is set when the seller already
 * has that brand, so nothing needs creating.
 */
export async function catalogBrandProductAddInput(
  owner: ProductListOwner,
  adminProductId: number,
) {
  const adminProduct = await db.query.product.findFirst({
    where: and(
      eq(product.id, adminProductId),
      eq(product.creatorSource, "admin"),
      eq(product.status, "active"),
    ),
    columns: { id: true, coreProductId: true, brandId: true, catalogCode: true },
    with: {
      variantPrices: {
        where: eq(productVariantPrice.isActive, true),
        columns: { variantOptionId: true },
      },
    },
  });
  const coreProductId = adminProduct?.coreProductId;
  const brandId = adminProduct?.brandId;
  if (!adminProduct || !coreProductId || !brandId) return null;

  const [ownProduct] = adminProduct.catalogCode
    ? await db
        .select({ id: product.id })
        .from(product)
        .where(
          and(
            ownerProductCondition(owner),
            eq(product.catalogCode, adminProduct.catalogCode),
          ),
        )
        .limit(1)
    : [];
  if (ownProduct) return { ownProductId: ownProduct.id, configure: null };

  const [sellerTemplate, adminTemplate, core] = await Promise.all([
    owner.ownerType === "shop"
      ? db.query.shopProductGenerationTemplate.findFirst({
          where: and(
            eq(shopProductGenerationTemplate.coreProductId, coreProductId),
            eq(shopProductGenerationTemplate.shopId, owner.ownerId),
          ),
        })
      : db.query.warehouseProductGenerationTemplate.findFirst({
          where: and(
            eq(warehouseProductGenerationTemplate.coreProductId, coreProductId),
            eq(warehouseProductGenerationTemplate.warehouseId, owner.ownerId),
          ),
        }),
    db.query.adminProductGenerationTemplate.findFirst({
      where: eq(adminProductGenerationTemplate.coreProductId, coreProductId),
    }),
    db.query.coreProductIdentity.findFirst({
      where: eq(coreProductIdentity.id, coreProductId),
      columns: { name: true, image: true, description: true },
    }),
  ]);
  if (!core) return null;

  const variantOptionIds = [
    ...new Set(adminProduct.variantPrices.map((price) => price.variantOptionId)),
  ];
  return {
    ownProductId: null,
    configure: {
      coreProductId,
      expectedVersion: sellerTemplate?.version ?? null,
      // The configure input schema keeps the fields it knows and fills defaults.
      details: (sellerTemplate?.details ??
        adminTemplate?.details ?? {
          name: core.name,
          image: core.image,
          description: core.description,
        }) as { name: string; image: string } & Record<string, unknown>,
      brands: [
        {
          brandId,
          variants: variantOptionIds.map((variantOptionId) => ({
            variantOptionId,
          })),
        },
      ],
    },
  };
}
