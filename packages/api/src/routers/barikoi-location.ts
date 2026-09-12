type BarikoiReversePlace = Record<string, unknown>;

function text(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function finiteNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(text(value));
  return Number.isFinite(number) ? number : null;
}

/** Normalize Barikoi autocomplete values before they cross the API boundary. */
export function normalizeBarikoiAutocompletePlace(
  place: Record<string, unknown>,
) {
  const id = finiteNumber(place.id);
  const latitude = finiteNumber(place.latitude);
  const longitude = finiteNumber(place.longitude);

  if (id === null || latitude === null || longitude === null) return null;

  return {
    id,
    longitude,
    latitude,
    address: text(place.address),
    address_bn: text(place.address_bn),
    city: text(place.city),
    city_bn: text(place.city_bn),
    area: text(place.area),
    area_bn: text(place.area_bn),
    sub_district: text(place.sub_district),
    postCode: finiteNumber(place.postCode) ?? 0,
    pType: text(place.pType),
    uCode: text(place.uCode),
  };
}

/** Normalize Barikoi's optional administrative fields for all reverse-geocode consumers. */
export function normalizeBarikoiReversePlace(place: BarikoiReversePlace) {
  return {
    address: text(place.address),
    address_bn: text(place.address_bn),
    area: text(place.area),
    area_bn: text(place.area_bn),
    city: text(place.city),
    city_bn: text(place.city_bn),
    district: text(place.district),
    division: text(place.division),
    sub_district: text(place.sub_district),
    postCode: text(place.postCode),
    thana: text(place.thana) || text(place.sub_district),
    thana_bn: text(place.thana_bn) || text(place.sub_district_bn),
    country: text(place.country),
  };
}
