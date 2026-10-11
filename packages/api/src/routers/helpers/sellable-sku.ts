/**
 * Sellable SKU: BRAND-PRODUCT-VARIANT, e.g. "OMR-LPG-12KG", "GSK-DDR4-16GB".
 *
 * One SKU per catalog variant (core product + brand + variant option), shared by
 * every Admin, warehouse, and retailer variant of that item. Brand and product
 * short codes are derived from names the first time they are needed and the
 * variant part from the variant option's definition, so nothing has to be
 * configured up front. Once issued, a SKU never changes.
 */

import type { db } from "@bikalpo-project/db";
import {
  brand,
  catalogVariant,
  coreProductIdentity,
} from "@bikalpo-project/db/schema";
import type { VariantDefinition } from "@bikalpo-project/db/variant-definition";
import { ORPCError } from "@orpc/server";
import { and, eq, isNotNull, isNull, ne } from "drizzle-orm";
import { lockSkuAllocation } from "./generate-sku";

type Database = Pick<typeof db, "query" | "update" | "execute">;

/** Brand segment for catalog variants without a brand. */
export const UNBRANDED_CODE = "GEN";

const BRAND_CODE_LENGTH = 3;
const PRODUCT_CODE_MAX = 6;
const VOWELS = new Set(["A", "E", "I", "O", "U"]);

const COLOR_CODES: Record<string, string> = {
  BLACK: "BLK",
  WHITE: "WHT",
  RED: "RED",
  BLUE: "BLU",
  NAVY: "NVY",
  GREEN: "GRN",
  YELLOW: "YLW",
  ORANGE: "ORG",
  PINK: "PNK",
  PURPLE: "PRP",
  BROWN: "BRN",
  GREY: "GRY",
  GRAY: "GRY",
  SILVER: "SLV",
  GOLD: "GLD",
  GOLDEN: "GLD",
  BEIGE: "BGE",
  MAROON: "MRN",
  CREAM: "CRM",
};

const UNIT_CODES: Record<string, string> = {
  KG: "KG",
  KGS: "KG",
  KILO: "KG",
  KILOGRAM: "KG",
  KILOGRAMS: "KG",
  G: "G",
  GM: "G",
  GMS: "G",
  GRAM: "G",
  GRAMS: "G",
  L: "L",
  LTR: "L",
  LITRE: "L",
  LITRES: "L",
  LITER: "L",
  LITERS: "L",
  ML: "ML",
  INCH: "IN",
  INCHES: "IN",
  IN: "IN",
  PC: "PC",
  PCS: "PC",
  PIECE: "PC",
  PIECES: "PC",
};

const CONTAINER_CODES: Record<string, string> = {
  sack: "SCK",
  carton: "CTN",
  packet: "PKT",
  bottle: "BTL",
  can: "CAN",
  jar: "JAR",
  pouch: "PCH",
  box: "BOX",
  unit: "UNT",
  pair: "PR",
  cylinder: "CYL",
  drum: "DRM",
  bundle: "BDL",
};

/** Words of a name, keeping their original casing, stripped of punctuation. */
function words(name: string): string[] {
  return name
    .replace(/[^A-Za-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function isAcronymOrModel(word: string): boolean {
  return /\d/.test(word) || (word.length >= 2 && word === word.toUpperCase());
}

/** First letter followed by the word's consonants, e.g. "MINIKET" → "MNKT". */
function consonantForm(word: string): string {
  const upper = word.toUpperCase();
  return (
    upper[0] +
    upper
      .slice(1)
      .split("")
      .filter((ch) => !VOWELS.has(ch))
      .join("")
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

/**
 * Keep the first letter, then prefer consonants in their original order,
 * filling with vowels only when there are not enough: "TEER" → "TER".
 */
function letterCode(letters: string, length: number): string {
  const rest = letters.slice(1).split("");
  const consonants = rest
    .map((ch, index) => ({ ch, index }))
    .filter(({ ch }) => !VOWELS.has(ch));
  const vowels = rest
    .map((ch, index) => ({ ch, index }))
    .filter(({ ch }) => VOWELS.has(ch));
  const picked = [...consonants, ...vowels]
    .slice(0, length - 1)
    .sort((a, b) => a.index - b.index);
  return letters[0] + picked.map(({ ch }) => ch).join("");
}

/** Numbered fallbacks so issuance never fails on a clash: "ABC" → "AB2"…, "ABC2"… */
function numbered(base: string, length?: number): string[] {
  const result: string[] = [];
  for (let n = 2; n <= 99; n++) {
    const suffix = String(n);
    result.push(
      length ? base.slice(0, length - suffix.length) + suffix : base + suffix,
    );
  }
  return result;
}

/**
 * Brand code candidates, best first.
 * "ACI" → ACI · "Omera" → OMR · "Kingston" → KNG · "G.Skill" → GSK · "Bengal Gas" → BGS
 */
export function brandCodeCandidates(name: string): string[] {
  const parts = words(name);
  if (parts.length === 0) return numbered("BR", BRAND_CODE_LENGTH);
  const first = parts[0]!;
  const letters = parts.join("").toUpperCase();
  const candidates: string[] = [];

  // Short acronyms are already codes: "ACI", "BM", "RFL".
  const acronym =
    letters.length <= 4 && parts.join("") === letters ? letters : null;
  if (acronym) candidates.push(acronym);
  if (parts.length > 1) {
    const initials = parts.map((part) => part[0]!.toUpperCase()).join("");
    const fill = consonantForm(first).slice(1);
    candidates.push((initials + fill).slice(0, BRAND_CODE_LENGTH));
  }
  candidates.push(letterCode(letters, BRAND_CODE_LENGTH));
  // Other letter combinations that keep the first letter and the word order.
  const pool = letters.slice(1);
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      candidates.push(letters[0] + pool[i]! + pool[j]!);
    }
  }
  return unique([
    ...candidates.filter(
      (code) => code === acronym || code.length === BRAND_CODE_LENGTH,
    ),
    ...numbered(letters.slice(0, BRAND_CODE_LENGTH), BRAND_CODE_LENGTH),
  ]);
}

/**
 * Product code candidates, best first.
 * "LPG Gas Cylinder" → LPG · "DDR4 Desktop RAM" → DDR4 · "Smart LED TV" → LEDTV ·
 * "Miniket Rice" → MNKT · "Laptop Ram" → LAPTOP
 */
export function productCodeCandidates(name: string): string[] {
  const parts = words(name);
  if (parts.length === 0) return numbered("PRD");
  const strong = parts.filter(isAcronymOrModel).map((p) => p.toUpperCase());
  const first = parts[0]!.toUpperCase();
  // Initials of the words not already in the base, used to tell apart products
  // whose base is the same: "Omera LPG Cylinder" → LPGO.
  const rest = (strong.length > 0
    ? parts.filter((part) => !isAcronymOrModel(part))
    : parts.slice(1)
  ).map((part) => part[0]!.toUpperCase());

  let base: string;
  if (strong.length > 0) {
    const joined = strong.join("");
    base = joined.length <= PRODUCT_CODE_MAX ? joined : strong[0]!;
  } else {
    base =
      first.length <= PRODUCT_CODE_MAX
        ? first
        : consonantForm(first).slice(0, PRODUCT_CODE_MAX - 1);
  }
  base = base.slice(0, 8);

  const candidates = [base];
  let extended = base;
  for (const initial of rest) {
    extended += initial;
    if (extended.length > 8) break;
    candidates.push(extended);
  }
  return unique([...candidates, ...numbered(base.slice(0, 6))]);
}

function normalizeValue(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9.]/g, "");
}

function unitCode(unit: string | undefined): string {
  if (!unit) return "";
  const key = unit.trim().toUpperCase().replace(/[^A-Z]/g, "");
  return UNIT_CODES[key] ?? key;
}

/** "16 GB" → 16GB · "Black" → BLK · "XL" → XL · "Olive Green" → OLGR */
function attributeValueCode(value: string): string {
  const color = COLOR_CODES[value.trim().toUpperCase()];
  if (color) return color;
  const compact = normalizeValue(value);
  if (/\d/.test(compact) || compact.length <= 4) return compact;
  const parts = words(value);
  if (parts.length > 1) {
    return parts
      .slice(0, 3)
      .map((part) => {
        const word = part.toUpperCase();
        return COLOR_CODES[word] ?? word.slice(0, 2);
      })
      .join("")
      .slice(0, 6);
  }
  return consonantForm(compact).slice(0, 5);
}

/**
 * Variant code candidates from the variant option's definition, best first.
 * The second candidate adds the container or unit, used only when another
 * variant of the same product and brand already has the shorter code.
 */
export function variantCodeCandidates(
  definition: VariantDefinition | null | undefined,
  fallbackName: string,
): string[] {
  let base: string;
  let qualified: string | undefined;
  if (definition?.kind === "measurement") {
    base = `${normalizeValue(definition.value)}${unitCode(definition.measurementUnit)}`;
    const container = CONTAINER_CODES[definition.container];
    qualified = container ? `${base}-${container}` : undefined;
  } else if (definition?.kind === "loose") {
    base = "LOOSE";
    qualified = `LOOSE-${unitCode(definition.measurementUnit)}`;
  } else if (definition?.kind === "attribute") {
    base = attributeValueCode(definition.value);
  } else {
    base = attributeValueCode(fallbackName);
  }
  base = base || "STD";
  return unique([base, qualified ?? "", ...numbered(`${base}-`)]);
}

// ============================================================
// Issuance (reads and writes the database)
// ============================================================

async function pickFree(
  candidates: string[],
  isTaken: (code: string) => Promise<boolean>,
): Promise<string> {
  for (const code of candidates) {
    if (!(await isTaken(code))) return code;
  }
  throw new Error("No free SKU code left for this name");
}

/** The brand's SKU short code, generated from its name on first use. */
export async function ensureBrandShortCode(
  database: Database,
  brandId: number,
): Promise<string> {
  const row = await database.query.brand.findFirst({
    where: eq(brand.id, brandId),
    columns: { name: true, shortCode: true },
  });
  if (!row) throw new Error(`Brand ${brandId} not found`);
  if (row.shortCode) return row.shortCode;

  await lockSkuAllocation(brand, database);
  const code = await pickFree(brandCodeCandidates(row.name), async (code) =>
    Boolean(
      await database.query.brand.findFirst({
        where: and(eq(brand.shortCode, code), ne(brand.id, brandId)),
        columns: { id: true },
      }),
    ),
  );
  await database
    .update(brand)
    .set({ shortCode: code })
    .where(and(eq(brand.id, brandId), isNull(brand.shortCode)));
  return code;
}

/** The core product's SKU short code, generated from its name on first use. */
export async function ensureCoreProductShortCode(
  database: Database,
  coreProductId: number,
): Promise<string> {
  const row = await database.query.coreProductIdentity.findFirst({
    where: eq(coreProductIdentity.id, coreProductId),
    columns: { name: true, shortCode: true },
  });
  if (!row) throw new Error(`Core product ${coreProductId} not found`);
  if (row.shortCode) return row.shortCode;

  await lockSkuAllocation(coreProductIdentity, database);
  const code = await pickFree(productCodeCandidates(row.name), async (code) =>
    Boolean(
      await database.query.coreProductIdentity.findFirst({
        where: and(
          eq(coreProductIdentity.shortCode, code),
          ne(coreProductIdentity.id, coreProductId),
        ),
        columns: { id: true },
      }),
    ),
  );
  await database
    .update(coreProductIdentity)
    .set({ shortCode: code })
    .where(
      and(
        eq(coreProductIdentity.id, coreProductId),
        isNull(coreProductIdentity.shortCode),
      ),
    );
  return code;
}

/**
 * Issue the catalog variant's SKU if it has none yet, and return it.
 * Idempotent: an issued SKU is returned unchanged. Call inside the transaction
 * that creates the catalog variant so the allocation lock covers the insert.
 */
export async function ensureCatalogVariantSku(
  database: Database,
  catalogVariantId: number,
): Promise<string> {
  const row = await database.query.catalogVariant.findFirst({
    where: eq(catalogVariant.id, catalogVariantId),
    columns: { sku: true, coreProductId: true, brandId: true },
    with: {
      variantOption: { columns: { name: true, definition: true } },
    },
  });
  if (!row) throw new Error(`Catalog variant ${catalogVariantId} not found`);
  if (row.sku) return row.sku;

  const [brandCode, productCode] = await Promise.all([
    row.brandId
      ? ensureBrandShortCode(database, row.brandId)
      : Promise.resolve(UNBRANDED_CODE),
    ensureCoreProductShortCode(database, row.coreProductId),
  ]);

  await lockSkuAllocation(catalogVariant, database);
  const prefix = `${brandCode}-${productCode}-`;
  const sku = await pickFree(
    variantCodeCandidates(
      row.variantOption?.definition as VariantDefinition | null,
      row.variantOption?.name ?? "",
    ).map((code) => prefix + code),
    async (candidate) =>
      Boolean(
        await database.query.catalogVariant.findFirst({
          where: and(
            eq(catalogVariant.sku, candidate),
            ne(catalogVariant.id, catalogVariantId),
          ),
          columns: { id: true },
        }),
      ),
  );
  await database
    .update(catalogVariant)
    .set({ sku, updatedAt: new Date() })
    .where(
      and(eq(catalogVariant.id, catalogVariantId), isNull(catalogVariant.sku)),
    );
  return sku;
}

/** True once any issued SKU uses this brand's short code. */
export async function isBrandShortCodeLocked(
  database: Database,
  brandId: number,
): Promise<boolean> {
  return Boolean(
    await database.query.catalogVariant.findFirst({
      where: and(eq(catalogVariant.brandId, brandId), isNotNull(catalogVariant.sku)),
      columns: { id: true },
    }),
  );
}

/** True once any issued SKU uses this core product's short code. */
export async function isCoreProductShortCodeLocked(
  database: Database,
  coreProductId: number,
): Promise<boolean> {
  return Boolean(
    await database.query.catalogVariant.findFirst({
      where: and(
        eq(catalogVariant.coreProductId, coreProductId),
        isNotNull(catalogVariant.sku),
      ),
      columns: { id: true },
    }),
  );
}

const SHORT_CODE_PATTERN = /^[A-Z0-9]{2,6}$/;

/** Validates an admin-entered short code; returns it normalized to upper case. */
export function normalizeShortCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!SHORT_CODE_PATTERN.test(normalized)) {
    throw new ORPCError("BAD_REQUEST", {
      message: "SKU code must be 2 to 6 letters or numbers",
    });
  }
  return normalized;
}

/**
 * Set a brand's SKU short code chosen by an admin. Allowed until a SKU uses it.
 * Empty input keeps the current code, or generates one if there is none.
 */
export async function setBrandShortCode(
  database: Database,
  brandId: number,
  requested: string | null | undefined,
): Promise<string> {
  if (!requested?.trim()) return ensureBrandShortCode(database, brandId);
  const code = normalizeShortCode(requested);
  const current = await database.query.brand.findFirst({
    where: eq(brand.id, brandId),
    columns: { shortCode: true },
  });
  if (current?.shortCode === code) return code;
  if (await isBrandShortCodeLocked(database, brandId)) {
    throw new ORPCError("CONFLICT", {
      message: "This brand's SKU code is already used in product SKUs and is locked",
    });
  }
  await lockSkuAllocation(brand, database);
  const taken = await database.query.brand.findFirst({
    where: and(eq(brand.shortCode, code), ne(brand.id, brandId)),
    columns: { name: true },
  });
  if (taken) {
    throw new ORPCError("CONFLICT", {
      message: `SKU code "${code}" is already used by ${taken.name}`,
    });
  }
  await database.update(brand).set({ shortCode: code }).where(eq(brand.id, brandId));
  return code;
}

/**
 * Set a core product's SKU short code chosen by an admin. Allowed until a SKU
 * uses it. Empty input keeps the current code, or generates one if there is none.
 */
export async function setCoreProductShortCode(
  database: Database,
  coreProductId: number,
  requested: string | null | undefined,
): Promise<string> {
  if (!requested?.trim()) {
    return ensureCoreProductShortCode(database, coreProductId);
  }
  const code = normalizeShortCode(requested);
  const current = await database.query.coreProductIdentity.findFirst({
    where: eq(coreProductIdentity.id, coreProductId),
    columns: { shortCode: true },
  });
  if (current?.shortCode === code) return code;
  if (await isCoreProductShortCodeLocked(database, coreProductId)) {
    throw new ORPCError("CONFLICT", {
      message:
        "This core product's SKU code is already used in product SKUs and is locked",
    });
  }
  await lockSkuAllocation(coreProductIdentity, database);
  const taken = await database.query.coreProductIdentity.findFirst({
    where: and(
      eq(coreProductIdentity.shortCode, code),
      ne(coreProductIdentity.id, coreProductId),
    ),
    columns: { name: true },
  });
  if (taken) {
    throw new ORPCError("CONFLICT", {
      message: `SKU code "${code}" is already used by ${taken.name}`,
    });
  }
  await database
    .update(coreProductIdentity)
    .set({ shortCode: code })
    .where(eq(coreProductIdentity.id, coreProductId));
  return code;
}
