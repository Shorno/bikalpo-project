export function isCatalogRequesterRole(role: string | null | undefined) {
  return role === "warehouse" || role === "shop_owner";
}
