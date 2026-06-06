type VariantPackaging = {
    packType?: string | null;
    packagingType?: string | null;
};

type CartonUnitSource = {
    totalPacks?: number | string | null;
    totalWeightKg?: number | string | null;
};

function toNumber(value: number | string | null | undefined) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function isLooseVariantPackaging(variant?: VariantPackaging | null) {
    const packaging = (variant?.packType || variant?.packagingType || "").toLowerCase();
    return packaging === "loose";
}

export function getCartonInventoryUnits(
    carton: CartonUnitSource,
    variant?: VariantPackaging | null,
) {
    return isLooseVariantPackaging(variant)
        ? toNumber(carton.totalWeightKg)
        : toNumber(carton.totalPacks);
}
