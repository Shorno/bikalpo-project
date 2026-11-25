import { db } from "@bikalpo-project/db";
import {
  brand,
  coreProductIdentity,
  variantOption,
} from "@bikalpo-project/db/schema";
import type { CatalogOwnerType } from "@bikalpo-project/db/schema/brand";
import { and, eq, isNull, or, type SQL, sql } from "drizzle-orm";

/**
 * Store-only catalog rows (brands and variant options).
 *
 * `owner_id IS NULL` marks the global admin catalog. A shop or warehouse can
 * add its own brand or variant from Create Product; only that store sees it.
 */
export type CatalogOwner = { ownerType: CatalogOwnerType; ownerId: string };

type OwnedColumns = {
  ownerType: typeof brand.ownerType | typeof variantOption.ownerType;
  ownerId: typeof brand.ownerId | typeof variantOption.ownerId;
};

/** Global rows plus, when given, the owner's own rows. */
export function visibleToOwner(
  table: OwnedColumns,
  owner?: CatalogOwner | null,
): SQL {
  if (!owner) return isNull(table.ownerId);
  return or(
    isNull(table.ownerId),
    and(eq(table.ownerType, owner.ownerType), eq(table.ownerId, owner.ownerId)),
  )!;
}

/**
 * Core products a store can use: the admin catalog plus the core identities
 * the store added itself from Create Product (`creator_source` = shop or
 * warehouse, `created_by_id` = the store).
 */
export function coreVisibleToOwner(owner: CatalogOwner): SQL {
  return or(
    eq(coreProductIdentity.creatorSource, "admin"),
    and(
      eq(coreProductIdentity.creatorSource, owner.ownerType),
      eq(coreProductIdentity.createdById, owner.ownerId),
    ),
  )!;
}

/** Global admin catalog only. */
export function globalCatalogOnly(table: OwnedColumns): SQL {
  return isNull(table.ownerId);
}

/** True when a loaded row is global or belongs to the owner. */
export function isVisibleToOwner(
  row: { ownerType?: string | null; ownerId?: string | null },
  owner?: CatalogOwner | null,
) {
  if (!row.ownerId) return true;
  return (
    !!owner && row.ownerId === owner.ownerId && row.ownerType === owner.ownerType
  );
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "brand"
  );
}

type Database = Pick<typeof db, "query" | "insert">;

/**
 * Brand from the Create Product brand picker. Reuses a brand the store can
 * already see with the same name (case-insensitive); otherwise creates a
 * store-only brand. Store brands take no 2-digit SKU code.
 */
export async function findOrCreateStoreBrand(
  database: Database,
  owner: CatalogOwner,
  rawName: string,
) {
  const name = rawName.trim().replace(/\s+/g, " ");
  const existing = await database.query.brand.findFirst({
    where: and(
      visibleToOwner(brand, owner),
      sql`lower(${brand.name}) = lower(${name})`,
    ),
  });
  if (existing) return { brand: existing, created: false };

  const base = slugify(name);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await database.query.brand.findFirst({
      where: and(
        eq(brand.ownerId, owner.ownerId),
        eq(brand.slug, slug),
      ),
      columns: { id: true },
    });
    if (taken) continue;
    const [created] = await database
      .insert(brand)
      .values({
        name,
        slug,
        isActive: true,
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
      })
      .returning();
    if (created) return { brand: created, created: true };
  }
  throw new Error("Could not create a unique brand slug");
}
