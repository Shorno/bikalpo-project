/**
 * A brand product's name: the brand, then the display name. A display name
 * that already starts with the brand ("Bengal LPG Cylinder" for Bengal)
 * is kept as it is, so the brand is not written twice.
 */
export function brandProductName(
  brandName: string | null | undefined,
  displayName: string,
  maxLength = 150,
) {
  const brand = (brandName ?? "").trim();
  const name = displayName.trim();
  const startsWithBrand =
    brand !== "" &&
    name.toLowerCase().startsWith(brand.toLowerCase()) &&
    (name.length === brand.length || /\s/.test(name[brand.length] ?? ""));
  const full = !brand || startsWithBrand ? name : `${brand} ${name}`;
  return full.slice(0, maxLength);
}
