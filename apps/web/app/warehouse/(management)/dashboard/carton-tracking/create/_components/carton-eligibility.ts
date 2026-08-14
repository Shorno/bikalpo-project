type CartonVariantEligibilityInput = {
  receivingMode?: string | null;
  packType?: string | null;
};

export function isCartonVariantEligible({
  receivingMode,
  packType,
}: CartonVariantEligibilityInput) {
  return receivingMode !== "loose" && packType !== "loose";
}
