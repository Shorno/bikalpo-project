export type TemplateProductIdentity = {
  variantId?: number;
  catalogVariantId?: number;
};

export type OwnerVariantIdentity = {
  variantId: number;
  catalogVariantId: number | null;
};

export function resolveTemplateProductIdentities<
  T extends TemplateProductIdentity,
>(
  products: T[],
  sourceVariants: OwnerVariantIdentity[],
  ownerVariants: OwnerVariantIdentity[],
) {
  const sourceById = new Map(
    sourceVariants.map((variant) => [variant.variantId, variant]),
  );
  const ownerByCatalogId = new Map(
    ownerVariants
      .filter(
        (
          variant,
        ): variant is OwnerVariantIdentity & {
          catalogVariantId: number;
        } => variant.catalogVariantId != null,
      )
      .map((variant) => [variant.catalogVariantId, variant]),
  );

  return products.map((product) => {
    const catalogVariantId =
      product.catalogVariantId ??
      (product.variantId
        ? sourceById.get(product.variantId)?.catalogVariantId
        : null) ??
      null;
    const ownerVariant = catalogVariantId
      ? ownerByCatalogId.get(catalogVariantId)
      : undefined;
    return {
      ...product,
      catalogVariantId,
      ownerVariantId: ownerVariant?.variantId ?? null,
      available: ownerVariant != null,
    };
  });
}
