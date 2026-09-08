type BarikoiReversePlace = Record<string, unknown>;

function text(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
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
