export const BRAND_CREATION_MODES = ["batch", "single"] as const;

export type BrandCreationMode = (typeof BRAND_CREATION_MODES)[number];

export type BrandCreationAction =
  | { kind: "add_brands"; label: "Add Brands"; disabled: false }
  | {
      kind: "edit_configuration";
      label: "Edit Configuration";
      disabled: false;
    }
  | { kind: "add_brand"; label: "Add Brand"; disabled: false }
  | {
      kind: "all_brands_added";
      label: "All Brands Added";
      disabled: true;
    };

export function resolveBrandCreationAction(input: {
  mode: BrandCreationMode;
  configuredBrandCount: number;
  addableBrandCount: number;
}): BrandCreationAction {
  const hasBrandProducts = input.configuredBrandCount > 0;

  if (input.mode === "single") {
    return input.addableBrandCount > 0
      ? { kind: "add_brand", label: "Add Brand", disabled: false }
      : {
          kind: "all_brands_added",
          label: "All Brands Added",
          disabled: true,
        };
  }

  return hasBrandProducts
    ? {
        kind: "edit_configuration",
        label: "Edit Configuration",
        disabled: false,
      }
    : { kind: "add_brands", label: "Add Brands", disabled: false };
}

export function countAddableBrands(
  activeBrandIds: readonly number[],
  configuredBrandIds: readonly number[],
) {
  const configured = new Set(configuredBrandIds);
  return new Set(activeBrandIds.filter((brandId) => !configured.has(brandId)))
    .size;
}

export type AdminPresetBrandSelection = {
  brandId: number;
  variantOptionIds: readonly number[];
};

export function resolveSingleBrandVariantDefaults(input: {
  brandId: number;
  compatibleVariantOptionIds: readonly number[];
  adminPresetBrands: readonly AdminPresetBrandSelection[];
}): {
  source: "admin_preset" | "manual";
  variantOptionIds: number[];
} {
  const preset = input.adminPresetBrands.find(
    (brand) => brand.brandId === input.brandId,
  );
  if (!preset) return { source: "manual", variantOptionIds: [] };

  const compatible = new Set(input.compatibleVariantOptionIds);
  return {
    source: "admin_preset",
    variantOptionIds: [
      ...new Set(
        preset.variantOptionIds.filter((variantId) =>
          compatible.has(variantId),
        ),
      ),
    ],
  };
}

export type BrandCreationSubmissionValidation =
  | { valid: true }
  | { valid: false; message: string };

export function validateBrandCreationSubmission(
  mode: BrandCreationMode,
  brandCount: number,
): BrandCreationSubmissionValidation {
  if (mode === "single") {
    if (brandCount === 1) return { valid: true };
    return {
      valid: false,
      message:
        brandCount === 0
          ? "Select exactly one brand before saving"
          : "Single-brand mode accepts exactly one brand per save",
    };
  }

  return brandCount > 0
    ? { valid: true }
    : { valid: false, message: "Add at least one brand before saving" };
}

export function shouldDeactivateOmittedBrands(
  mode: BrandCreationMode,
): boolean {
  return mode === "batch";
}
