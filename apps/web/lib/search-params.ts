import {
  createSearchParamsCache,
  parseAsBoolean,
  parseAsFloat,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

export const searchParamsParsers = {
  q: parseAsString
    .withDefault("")
    .withOptions({ shallow: false, throttleMs: 500 }),
  category: parseAsString.withOptions({ shallow: false }),
  brand: parseAsString.withOptions({ shallow: false }),
  minPrice: parseAsFloat.withOptions({ shallow: false, throttleMs: 500 }),
  maxPrice: parseAsFloat.withOptions({ shallow: false, throttleMs: 500 }),
  inStock: parseAsBoolean.withOptions({ shallow: false }),
  sort: parseAsString.withDefault("newest").withOptions({ shallow: false }),
  page: parseAsInteger.withDefault(1).withOptions({ shallow: false }),
  limit: parseAsInteger.withDefault(12).withOptions({ shallow: false }),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
