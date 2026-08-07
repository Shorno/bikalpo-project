export const BRAND_CREATION_MODES = ["batch", "single"] as const;

export type BrandCreationMode = (typeof BRAND_CREATION_MODES)[number];

export type BrandCreationAction =
  | { kind: "add_brands"; label: "Add Brands" }
  | { kind: "edit_configuration"; label: "Edit Configuration" }
  | { kind: "add_brand"; label: "Add Brand" }
  | { kind: "manage_brands"; label: "Manage Brands" };

export function resolveBrandCreationAction(input: {
  mode: BrandCreationMode;
  configuredBrandCount: number;
}): BrandCreationAction {
  const hasBrandProducts = input.configuredBrandCount > 0;

  if (input.mode === "single") {
    return hasBrandProducts
      ? { kind: "manage_brands", label: "Manage Brands" }
      : { kind: "add_brand", label: "Add Brand" };
  }

  return hasBrandProducts
    ? { kind: "edit_configuration", label: "Edit Configuration" }
    : { kind: "add_brands", label: "Add Brands" };
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
