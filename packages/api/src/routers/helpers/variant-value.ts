import {
	getVariantDefinition,
	type VariantOptionLike,
} from "@bikalpo-project/db/variant-definition";

/** The distinguishing value, without the attribute or container name. */
export function variantValueLabel(option: VariantOptionLike): string {
	const definition = getVariantDefinition(option);
	if (definition?.kind === "measurement") {
		return `${definition.value.trim()} ${definition.measurementUnit.trim()}`;
	}
	if (definition?.kind === "attribute") return definition.value.trim();
	if (definition?.kind === "loose") {
		return `Per ${definition.measurementUnit.trim()}`;
	}

	const size = option.size?.trim();
	if (size) {
		const unit = option.unit?.trim();
		return /^\d+(?:\.\d+)?$/.test(size) && unit ? `${size} ${unit}` : size;
	}
	return option.name?.trim() || "—";
}
