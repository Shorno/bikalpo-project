// Keep stored legacy values valid while exposing the current client categories.
export const toLetUnitTypes = ["family_flat", "family_sublet", "bachelor_room", "bachelor_sublet", "office", "shop", "warehouse", "garage", "factory", "sublet", "other"] as const;

export function toLetUnitCapabilities(type: string) {
  const residential = ["family_flat", "family_sublet", "bachelor_room", "bachelor_sublet", "sublet", "other"].includes(type);
  const bathrooms = residential || ["office", "shop", "warehouse", "factory"].includes(type);
  return { bedrooms: residential, bathrooms, balconies: residential || type === "office", drawingRoom: residential, diningSpace: residential, kitchen: residential, furnished: bathrooms || type === "garage" };
}

export function toLetCategoryLabel(type: string) {
  if (type === "warehouse") return "Godown / Warehouse";
  if (type === "family_sublet") return "Family Sub-Let";
  if (type === "bachelor_sublet") return "Bachelor Sub-Let";
  return type.split("_").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
