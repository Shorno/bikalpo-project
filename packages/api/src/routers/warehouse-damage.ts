import { db } from "@bikalpo-project/db";
import {
  carton,
  inventory,
  stockEntry,
  warehouseDamageEntry,
  warehouseDamageItem,
  warehouseDamageMovement,
} from "@bikalpo-project/db/schema";
import { resolveVariantOperations } from "@bikalpo-project/db/variant-definition";
import { ORPCError } from "@orpc/server";
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { warehouseProcedure } from "../index";
import {
  allocateCurrentStockLots,
  unitCostFromStockEntry,
} from "../services/warehouse-stock-lots";

const damageTypeSchema = z.enum(["physical", "expired", "lost"]);
const damageModeSchema = z.enum(["loose", "pack", "carton", "direct"]);
const damageStatusSchema = z.enum(["draft", "posted", "reversed"]);

const damagePayloadSchema = z.object({
  damageType: damageTypeSchema,
  damageMode: damageModeSchema,
  description: z.string().trim().max(2000).optional(),
  proofImages: z.array(z.string().url()).max(8).default([]),
  entryDate: z.string(),
  items: z
    .array(
      z.object({
        inventoryId: z.number().int().positive(),
        cartonId: z.number().int().positive().optional(),
        stockEntryId: z.number().int().positive().optional(),
        quantity: z.number().positive().optional(),
        note: z.string().trim().max(500).optional(),
      }),
    )
    .min(1),
});

const damagePostInputSchema = damagePayloadSchema.extend({
  requestKey: z.string().uuid(),
  draftId: z.number().int().positive().optional(),
});

function validateUniqueDamageSources(
  input: z.infer<typeof damagePayloadSchema>,
) {
  if (input.damageType === "expired" && input.damageMode === "carton") {
    throw new ORPCError("BAD_REQUEST", {
      message:
        "Expired carton damage is unavailable until cartons carry purchase-batch provenance",
    });
  }
  const uniqueInventoryIds = new Set(
    input.items.map((item) => item.inventoryId),
  );
  const uniqueCartonIds = new Set(
    input.items.flatMap((item) => (item.cartonId ? [item.cartonId] : [])),
  );
  if (
    (input.damageMode === "carton" &&
      uniqueCartonIds.size !== input.items.length) ||
    (input.damageMode !== "carton" &&
      uniqueInventoryIds.size !== input.items.length)
  ) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Each inventory source or carton can only be added once",
    });
  }
  return { uniqueInventoryIds, uniqueCartonIds };
}

async function assertDamageSourceOwnership(
  warehouseId: string,
  input: z.infer<typeof damagePayloadSchema>,
) {
  const { uniqueInventoryIds, uniqueCartonIds } =
    validateUniqueDamageSources(input);
  const stockEntryIds = Array.from(
    new Set(
      input.items.flatMap((item) =>
        item.stockEntryId ? [item.stockEntryId] : [],
      ),
    ),
  );
  const [inventoryRows, cartonRows, stockEntryRows] = await Promise.all([
    db.query.inventory.findMany({
      where: and(
        eq(inventory.ownerType, "warehouse"),
        eq(inventory.ownerId, warehouseId),
        inArray(inventory.id, Array.from(uniqueInventoryIds)),
      ),
      columns: { id: true, variantId: true },
    }),
    uniqueCartonIds.size
      ? db.query.carton.findMany({
          where: and(
            eq(carton.warehouseId, warehouseId),
            inArray(carton.id, Array.from(uniqueCartonIds)),
          ),
          columns: { id: true, variantId: true },
        })
      : Promise.resolve([]),
    stockEntryIds.length
      ? db.query.stockEntry.findMany({
          where: and(
            eq(stockEntry.warehouseId, warehouseId),
            inArray(stockEntry.id, stockEntryIds),
          ),
          columns: { id: true, variantId: true },
        })
      : Promise.resolve([]),
  ]);
  if (
    inventoryRows.length !== uniqueInventoryIds.size ||
    cartonRows.length !== uniqueCartonIds.size ||
    stockEntryRows.length !== stockEntryIds.length
  ) {
    throw new ORPCError("FORBIDDEN", {
      message: "One or more draft sources do not belong to this warehouse",
    });
  }
  const inventoryById = new Map(inventoryRows.map((row) => [row.id, row]));
  const cartonById = new Map(cartonRows.map((row) => [row.id, row]));
  const stockEntryById = new Map(stockEntryRows.map((row) => [row.id, row]));
  for (const item of input.items) {
    const variantId = inventoryById.get(item.inventoryId)?.variantId;
    if (
      !variantId ||
      (item.cartonId &&
        cartonById.get(item.cartonId)?.variantId !== variantId) ||
      (item.stockEntryId &&
        stockEntryById.get(item.stockEntryId)?.variantId !== variantId)
    ) {
      throw new ORPCError("BAD_REQUEST", {
        message: "A draft source does not match its product variant",
      });
    }
  }
}

const listInputSchema = z.object({
  search: z.string().trim().optional(),
  damageType: damageTypeSchema.optional(),
  damageMode: damageModeSchema.optional(),
  status: damageStatusSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

type DamageSource = {
  sourceKey: string;
  inventoryId: number;
  variantId: number;
  cartonId: number | null;
  cartonCode: string | null;
  stockEntryId: number | null;
  batchNo: string | null;
  expiryDate: string | null;
  sku: string | null;
  productName: string;
  productImage: string | null;
  brandName: string | null;
  variantLabel: string;
  availableQty: number;
  quantityUnit: string;
  allowsDecimal: boolean;
  unitCost: number;
  totalWeightKg: number | null;
};

function toNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function variantLabel(input: {
  unitLabel: string;
  color?: string | null;
  size?: string | null;
}) {
  return [input.unitLabel, input.color, input.size].filter(Boolean).join(" · ");
}

function damageSourceIdentity(
  variant: {
    sku: string | null;
    unitLabel: string;
    color?: string | null;
    size?: string | null;
    product?: { name: string; image: string | null } | null;
    brand?: { name: string } | null;
  },
  operations: { operationalUnit: string; allowsDecimal: boolean },
) {
  return {
    sku: variant.sku,
    productName: variant.product?.name ?? "Unknown product",
    productImage: variant.product?.image ?? null,
    brandName: variant.brand?.name ?? null,
    variantLabel: variantLabel(variant),
    quantityUnit: operations.operationalUnit,
    allowsDecimal: operations.allowsDecimal,
  };
}

function listConditions(
  warehouseId: string,
  input: z.infer<typeof listInputSchema>,
) {
  const conditions: SQL[] = [eq(warehouseDamageEntry.warehouseId, warehouseId)];
  if (input.damageType) {
    conditions.push(eq(warehouseDamageEntry.damageType, input.damageType));
  }
  if (input.damageMode) {
    conditions.push(eq(warehouseDamageEntry.damageMode, input.damageMode));
  }
  if (input.status) {
    conditions.push(eq(warehouseDamageEntry.status, input.status));
  }
  if (input.dateFrom) {
    conditions.push(gte(warehouseDamageEntry.entryDate, input.dateFrom));
  }
  if (input.dateTo) {
    conditions.push(lte(warehouseDamageEntry.entryDate, input.dateTo));
  }
  if (input.search) {
    const term = `%${input.search}%`;
    conditions.push(
      or(
        ilike(warehouseDamageEntry.entryNo, term),
        sql`exists (
          select 1 from ${warehouseDamageItem}
          where ${warehouseDamageItem.damageEntryId} = ${warehouseDamageEntry.id}
          and (
            ${warehouseDamageItem.skuSnapshot} ilike ${term}
            or ${warehouseDamageItem.productNameSnapshot} ilike ${term}
            or ${warehouseDamageItem.sourceLabelSnapshot} ilike ${term}
          )
        )`,
        sql`exists (
          select 1
          from jsonb_array_elements(
            coalesce(${warehouseDamageEntry.draftPayload}->'items', '[]'::jsonb)
          ) as draft_item
          left join inventory draft_inventory
            on draft_inventory.id = (draft_item->>'inventoryId')::int
          left join product_variant draft_variant
            on draft_variant.id = draft_inventory.variant_id
          left join product draft_product
            on draft_product.id = draft_variant.product_id
          left join brand draft_brand
            on draft_brand.id = draft_variant.brand_id
          left join carton draft_carton
            on draft_carton.id = (draft_item->>'cartonId')::int
          left join stock_entry draft_stock_entry
            on draft_stock_entry.id = (draft_item->>'stockEntryId')::int
          where draft_variant.sku ilike ${term}
            or draft_product.name ilike ${term}
            or draft_brand.name ilike ${term}
            or draft_carton.carton_id ilike ${term}
            or draft_stock_entry.batch_no ilike ${term}
        )`,
      )!,
    );
  }
  return conditions;
}

async function nextEntryNumber() {
  const result = await db.execute<{ sequence: string }>(
    sql`SELECT nextval('warehouse_damage_entry_no_seq')::text AS sequence`,
  );
  const sequence = result.rows[0]?.sequence;
  if (!sequence) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Could not generate a damage entry number",
    });
  }
  return `DMG-W-${sequence.padStart(6, "0")}`;
}

async function stockCostSnapshots(warehouseId: string, variantIds: number[]) {
  if (variantIds.length === 0)
    return new Map<
      number,
      {
        weightedUnitCost: number;
      }
    >();
  const uniqueVariantIds = Array.from(new Set(variantIds));
  const [rows, inventoryRows] = await Promise.all([
    db
      .select()
      .from(stockEntry)
      .where(
        and(
          eq(stockEntry.warehouseId, warehouseId),
          inArray(stockEntry.variantId, uniqueVariantIds),
        ),
      )
      .orderBy(desc(stockEntry.createdAt), desc(stockEntry.id)),
    db.query.inventory.findMany({
      where: and(
        eq(inventory.ownerType, "warehouse"),
        eq(inventory.ownerId, warehouseId),
        inArray(inventory.variantId, uniqueVariantIds),
      ),
      columns: { variantId: true, availableQty: true },
    }),
  ]);
  const { costsByVariant } = allocateCurrentStockLots(
    rows,
    new Map(
      inventoryRows.map((row) => [row.variantId, toNumber(row.availableQty)]),
    ),
  );
  return new Map(
    Array.from(costsByVariant, ([variantId, value]) => [
      variantId,
      {
        weightedUnitCost: value.weightedUnitCost,
      },
    ]),
  );
}

export const warehouseDamageRouter = {
  list: warehouseProcedure
    .input(listInputSchema)
    .handler(async ({ context, input }) => {
      const warehouseId = context.session.user.id;
      const where = and(...listConditions(warehouseId, input));
      const offset = (input.page - 1) * input.pageSize;
      const [entries, countRows] = await Promise.all([
        db.query.warehouseDamageEntry.findMany({
          where,
          with: { items: true },
          orderBy: [desc(warehouseDamageEntry.createdAt)],
          limit: input.pageSize,
          offset,
        }),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(warehouseDamageEntry)
          .where(where),
      ]);
      const totalCount = countRows[0]?.count ?? 0;
      return {
        items: entries.map((entry) => {
          const quantityGroups = new Map<string, number>();
          const productNames = new Set<string>();
          let cartonCount = 0;
          for (const item of entry.items) {
            quantityGroups.set(
              item.quantityUnit,
              (quantityGroups.get(item.quantityUnit) ?? 0) +
                toNumber(item.quantity),
            );
            productNames.add(item.productNameSnapshot);
            cartonCount += item.cartonCount;
          }
          return {
            ...entry,
            totalLossValue: toNumber(entry.totalLossValue),
            quantityGroups: Array.from(quantityGroups, ([unit, quantity]) => ({
              unit,
              quantity,
            })),
            productNames: Array.from(productNames),
            productCount: productNames.size,
            draftSourceCount: entry.draftPayload?.items.length ?? 0,
            cartonCount:
              entry.status === "draft" &&
              entry.draftPayload?.damageMode === "carton"
                ? entry.draftPayload.items.length
                : cartonCount,
          };
        }),
        totalCount,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(totalCount / input.pageSize)),
      };
    }),

  summary: warehouseProcedure
    .input(listInputSchema.omit({ page: true, pageSize: true }))
    .handler(async ({ context, input }) => {
      const warehouseId = context.session.user.id;
      const where = and(
        ...listConditions(warehouseId, {
          ...input,
          page: 1,
          pageSize: 20,
        }),
      );
      const [totals] = await db
        .select({
          totalEntries: sql<number>`count(*)::int`,
          totalLossValue: sql<string>`coalesce(sum(${warehouseDamageEntry.totalLossValue}), 0)::text`,
        })
        .from(warehouseDamageEntry)
        .where(where);
      const quantityRows = await db
        .select({
          unit: warehouseDamageItem.quantityUnit,
          quantity: sql<string>`coalesce(sum(${warehouseDamageItem.quantity}), 0)::text`,
        })
        .from(warehouseDamageItem)
        .innerJoin(
          warehouseDamageEntry,
          eq(warehouseDamageItem.damageEntryId, warehouseDamageEntry.id),
        )
        .where(where)
        .groupBy(warehouseDamageItem.quantityUnit)
        .orderBy(warehouseDamageItem.quantityUnit);
      const [cartonTotals] = await db
        .select({
          cartonCount: sql<number>`coalesce(sum(${warehouseDamageItem.cartonCount}), 0)::int`,
        })
        .from(warehouseDamageItem)
        .innerJoin(
          warehouseDamageEntry,
          eq(warehouseDamageItem.damageEntryId, warehouseDamageEntry.id),
        )
        .where(where);
      return {
        totalEntries: totals?.totalEntries ?? 0,
        totalLossValue: toNumber(totals?.totalLossValue),
        quantityGroups: quantityRows.map((row) => ({
          unit: row.unit,
          quantity: toNumber(row.quantity),
        })),
        cartonCount: cartonTotals?.cartonCount ?? 0,
      };
    }),

  getById: warehouseProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .handler(async ({ context, input }) => {
      const warehouseId = context.session.user.id;
      const entry = await db.query.warehouseDamageEntry.findFirst({
        where: and(
          eq(warehouseDamageEntry.id, input.id),
          eq(warehouseDamageEntry.warehouseId, warehouseId),
        ),
        with: {
          warehouse: {
            columns: {
              name: true,
              warehouseName: true,
              warehouseAddress: true,
            },
          },
          items: {
            with: {
              carton: { columns: { cartonId: true } },
              stockEntry: {
                columns: { batchNo: true, expiryDate: true, reference: true },
              },
            },
          },
          movements: true,
        },
      });
      if (!entry) {
        throw new ORPCError("NOT_FOUND", { message: "Damage entry not found" });
      }
      return {
        ...entry,
        totalLossValue: toNumber(entry.totalLossValue),
        items: entry.items.map((item) => ({
          ...item,
          quantity: toNumber(item.quantity),
          unitCost: toNumber(item.unitCost),
          totalValue: toNumber(item.totalValue),
          sourceTotalWeightKg: item.sourceTotalWeightKg
            ? toNumber(item.sourceTotalWeightKg)
            : null,
        })),
        movements: entry.movements.map((movement) => ({
          ...movement,
          quantityDelta: toNumber(movement.quantityDelta),
        })),
      };
    }),

  searchSources: warehouseProcedure
    .input(
      z.object({
        mode: damageModeSchema,
        damageType: damageTypeSchema.optional(),
        search: z.string().trim().optional(),
        inventoryIds: z.array(z.number().int().positive()).max(250).optional(),
        cartonIds: z.array(z.number().int().positive()).max(250).optional(),
        stockEntryIds: z.array(z.number().int().positive()).max(250).optional(),
        limit: z.number().int().min(1).max(250).default(50),
      }),
    )
    .handler(async ({ context, input }) => {
      const warehouseId = context.session.user.id;
      const search = input.search?.toLowerCase();
      const sources: DamageSource[] = [];

      if (input.mode === "carton" && input.damageType === "expired") {
        throw new ORPCError("BAD_REQUEST", {
          message:
            "Expired carton damage needs exact carton-to-batch traceability, which is not recorded yet",
        });
      }

      if (input.mode === "carton") {
        const cartonRows = await db.query.carton.findMany({
          where: and(
            eq(carton.warehouseId, warehouseId),
            eq(carton.status, "active"),
            input.cartonIds?.length
              ? inArray(carton.id, input.cartonIds)
              : undefined,
            search
              ? or(
                  ilike(carton.cartonId, `%${search}%`),
                  sql`exists (
                    select 1
                    from product_variant search_variant
                    left join product search_product on search_product.id = search_variant.product_id
                    left join brand search_brand on search_brand.id = search_variant.brand_id
                    where search_variant.id = ${carton.variantId}
                      and (
                        search_variant.sku ilike ${`%${search}%`}
                        or search_product.name ilike ${`%${search}%`}
                        or search_brand.name ilike ${`%${search}%`}
                      )
                  )`,
                )
              : undefined,
          ),
          with: {
            variant: {
              with: { product: true, brand: true, sourceVariantOption: true },
            },
          },
          orderBy: [desc(carton.createdAt)],
        });
        if (cartonRows.length === 0) return { sources };
        const inventoryRows = await db.query.inventory.findMany({
          where: and(
            eq(inventory.ownerType, "warehouse"),
            eq(inventory.ownerId, warehouseId),
            inArray(
              inventory.variantId,
              cartonRows.map((row) => row.variantId),
            ),
          ),
        });
        const inventoryByVariant = new Map(
          inventoryRows.map((row) => [row.variantId, row]),
        );
        const costs = await stockCostSnapshots(
          warehouseId,
          cartonRows.map((row) => row.variantId),
        );
        for (const row of cartonRows) {
          const inv = inventoryByVariant.get(row.variantId);
          if (!inv || !row.variant?.sourceVariantOption) continue;
          const operations = resolveVariantOperations(
            row.variant.sourceVariantOption,
          );
          const haystack = [
            row.cartonId,
            row.variant.sku,
            row.variant.product?.name,
            row.variant.brand?.name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (search && !haystack.includes(search)) continue;
          const costSnapshot = costs.get(row.variantId);
          sources.push({
            sourceKey: `carton-${row.id}`,
            inventoryId: inv.id,
            variantId: row.variantId,
            cartonId: row.id,
            cartonCode: row.cartonId,
            stockEntryId: null,
            batchNo: null,
            expiryDate: null,
            ...damageSourceIdentity(row.variant, operations),
            availableQty: row.totalPacks,
            unitCost: costSnapshot?.weightedUnitCost ?? 0,
            totalWeightKg: toNumber(row.totalWeightKg),
          });
          if (sources.length >= input.limit) break;
        }
        return { sources };
      }

      if (input.damageType === "expired") {
        const today = new Date().toISOString().slice(0, 10);
        const expiredRows = await db.query.stockEntry.findMany({
          where: and(
            eq(stockEntry.warehouseId, warehouseId),
            sql`${stockEntry.expiryDate} is not null`,
            lte(stockEntry.expiryDate, today),
            input.stockEntryIds?.length
              ? inArray(stockEntry.id, input.stockEntryIds)
              : undefined,
            search
              ? or(
                  ilike(stockEntry.batchNo, `%${search}%`),
                  sql`exists (
                    select 1
                    from product_variant search_variant
                    left join product search_product on search_product.id = search_variant.product_id
                    left join brand search_brand on search_brand.id = search_variant.brand_id
                    where search_variant.id = ${stockEntry.variantId}
                      and (
                        search_variant.sku ilike ${`%${search}%`}
                        or search_product.name ilike ${`%${search}%`}
                        or search_brand.name ilike ${`%${search}%`}
                      )
                  )`,
                )
              : undefined,
          ),
          with: {
            variant: {
              with: { product: true, brand: true, sourceVariantOption: true },
            },
          },
          orderBy: [stockEntry.expiryDate, desc(stockEntry.id)],
        });
        if (expiredRows.length === 0) return { sources };
        const variantIds = Array.from(
          new Set(expiredRows.map((row) => row.variantId)),
        );
        const [inventoryRows, allReceiptRows] = await Promise.all([
          db.query.inventory.findMany({
            where: and(
              eq(inventory.ownerType, "warehouse"),
              eq(inventory.ownerId, warehouseId),
              inArray(inventory.variantId, variantIds),
            ),
          }),
          db
            .select()
            .from(stockEntry)
            .where(
              and(
                eq(stockEntry.warehouseId, warehouseId),
                inArray(stockEntry.variantId, variantIds),
              ),
            )
            .orderBy(desc(stockEntry.createdAt), desc(stockEntry.id)),
        ]);
        const inventoryByVariant = new Map(
          inventoryRows.map((row) => [row.variantId, row]),
        );
        const { availableByStockEntry } = allocateCurrentStockLots(
          allReceiptRows,
          new Map(
            inventoryRows.map((row) => [
              row.variantId,
              Math.max(
                0,
                toNumber(row.availableQty) - toNumber(row.inCartonQty),
              ),
            ]),
          ),
        );
        for (const row of expiredRows) {
          const inv = inventoryByVariant.get(row.variantId);
          if (!inv || !row.variant?.sourceVariantOption) continue;
          const operations = resolveVariantOperations(
            row.variant.sourceVariantOption,
          );
          if (operations.receivingMode !== input.mode) continue;
          const sourceQty = availableByStockEntry.get(row.id) ?? 0;
          if (sourceQty <= 0) continue;
          const haystack = [
            row.batchNo,
            row.variant.sku,
            row.variant.product?.name,
            row.variant.brand?.name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (search && !haystack.includes(search)) continue;
          sources.push({
            sourceKey: `batch-${row.id}`,
            inventoryId: inv.id,
            variantId: row.variantId,
            cartonId: null,
            cartonCode: null,
            stockEntryId: row.id,
            batchNo: row.batchNo,
            expiryDate: row.expiryDate,
            ...damageSourceIdentity(row.variant, operations),
            availableQty: sourceQty,
            unitCost: unitCostFromStockEntry(row),
            totalWeightKg: null,
          });
          if (sources.length >= input.limit) break;
        }
        return { sources };
      }

      const inventoryRows = await db.query.inventory.findMany({
        where: and(
          eq(inventory.ownerType, "warehouse"),
          eq(inventory.ownerId, warehouseId),
          input.inventoryIds?.length
            ? inArray(inventory.id, input.inventoryIds)
            : undefined,
          search
            ? sql`exists (
                select 1
                from product_variant search_variant
                left join product search_product on search_product.id = search_variant.product_id
                left join brand search_brand on search_brand.id = search_variant.brand_id
                where search_variant.id = ${inventory.variantId}
                  and (
                    search_variant.sku ilike ${`%${search}%`}
                    or search_product.name ilike ${`%${search}%`}
                    or search_brand.name ilike ${`%${search}%`}
                  )
              )`
            : undefined,
        ),
        with: {
          variant: {
            with: { product: true, brand: true, sourceVariantOption: true },
          },
        },
      });
      const eligible = inventoryRows.filter((row) => {
        if (!row.variant?.sourceVariantOption) return false;
        const operations = resolveVariantOperations(
          row.variant.sourceVariantOption,
        );
        if (operations.receivingMode !== input.mode) return false;
        const unpackedQty =
          toNumber(row.availableQty) - toNumber(row.inCartonQty);
        if (unpackedQty <= 0) return false;
        if (!search) return true;
        return [
          row.variant.sku,
          row.variant.product?.name,
          row.variant.brand?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search);
      });
      const costs = await stockCostSnapshots(
        warehouseId,
        eligible.map((row) => row.variantId),
      );
      for (const row of eligible.slice(0, input.limit)) {
        const operations = resolveVariantOperations(
          row.variant.sourceVariantOption!,
        );
        const costSnapshot = costs.get(row.variantId);
        sources.push({
          sourceKey: `inventory-${row.id}`,
          inventoryId: row.id,
          variantId: row.variantId,
          cartonId: null,
          cartonCode: null,
          stockEntryId: null,
          batchNo: null,
          expiryDate: null,
          ...damageSourceIdentity(row.variant, operations),
          availableQty: Math.max(
            0,
            toNumber(row.availableQty) - toNumber(row.inCartonQty),
          ),
          unitCost: costSnapshot?.weightedUnitCost ?? 0,
          totalWeightKg: null,
        });
      }
      return { sources };
    }),

  saveDraft: warehouseProcedure
    .input(damagePostInputSchema.omit({ draftId: true }))
    .handler(async ({ context, input }) => {
      const warehouseId = context.session.user.id;
      await assertDamageSourceOwnership(warehouseId, input);
      const existing = await db.query.warehouseDamageEntry.findFirst({
        where: and(
          eq(warehouseDamageEntry.requestKey, input.requestKey),
          eq(warehouseDamageEntry.warehouseId, warehouseId),
        ),
      });
      if (existing) {
        return {
          success: true,
          entryId: existing.id,
          entryNo: existing.entryNo,
          duplicate: true,
        };
      }
      const entryNo = await nextEntryNumber();
      const [draft] = await db
        .insert(warehouseDamageEntry)
        .values({
          entryNo,
          requestKey: input.requestKey,
          warehouseId,
          damageType: input.damageType,
          damageMode: input.damageMode,
          description: input.description || null,
          proofImages: input.proofImages,
          draftPayload: input,
          totalLossValue: "0",
          entryDate: input.entryDate,
          status: "draft",
          createdById: warehouseId,
          createdByName: context.session.user.name || "Warehouse user",
        })
        .returning();
      if (!draft) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Could not save the damage draft",
        });
      }
      return {
        success: true,
        entryId: draft.id,
        entryNo: draft.entryNo,
        duplicate: false,
      };
    }),

  updateDraft: warehouseProcedure
    .input(damagePayloadSchema.extend({ id: z.number().int().positive() }))
    .handler(async ({ context, input }) => {
      const warehouseId = context.session.user.id;
      await assertDamageSourceOwnership(warehouseId, input);
      const { id, ...payload } = input;
      const [draft] = await db
        .update(warehouseDamageEntry)
        .set({
          damageType: payload.damageType,
          damageMode: payload.damageMode,
          description: payload.description || null,
          proofImages: payload.proofImages,
          draftPayload: payload,
          entryDate: payload.entryDate,
        })
        .where(
          and(
            eq(warehouseDamageEntry.id, id),
            eq(warehouseDamageEntry.warehouseId, warehouseId),
            eq(warehouseDamageEntry.status, "draft"),
          ),
        )
        .returning({ id: warehouseDamageEntry.id });
      if (!draft) {
        throw new ORPCError("NOT_FOUND", {
          message: "Damage draft not found",
        });
      }
      return { success: true, entryId: draft.id };
    }),

  deleteDraft: warehouseProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .handler(async ({ context, input }) => {
      const warehouseId = context.session.user.id;
      const deleted = await db
        .delete(warehouseDamageEntry)
        .where(
          and(
            eq(warehouseDamageEntry.id, input.id),
            eq(warehouseDamageEntry.warehouseId, warehouseId),
            eq(warehouseDamageEntry.status, "draft"),
          ),
        )
        .returning({ id: warehouseDamageEntry.id });
      if (deleted.length === 0) {
        throw new ORPCError("NOT_FOUND", {
          message: "Damage draft not found",
        });
      }
      return { success: true };
    }),

  post: warehouseProcedure
    .input(damagePostInputSchema)
    .handler(async ({ context, input }) => {
      const warehouseId = context.session.user.id;
      const existing = await db.query.warehouseDamageEntry.findFirst({
        where: and(
          eq(warehouseDamageEntry.requestKey, input.requestKey),
          eq(warehouseDamageEntry.warehouseId, warehouseId),
        ),
      });
      if (existing && existing.status !== "draft") {
        return {
          success: true,
          entryId: existing.id,
          entryNo: existing.entryNo,
          duplicate: true,
        };
      }
      if (
        existing?.status === "draft" &&
        (!input.draftId || existing.id !== input.draftId)
      ) {
        throw new ORPCError("CONFLICT", {
          message: "This request key belongs to an existing damage draft",
        });
      }
      const { uniqueInventoryIds, uniqueCartonIds } =
        validateUniqueDamageSources(input);
      const entryNo = await nextEntryNumber();
      const createdByName = context.session.user.name || "Warehouse user";

      const result = await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${input.requestKey}))`,
        );
        const duplicate = await tx.query.warehouseDamageEntry.findFirst({
          where: and(
            eq(warehouseDamageEntry.requestKey, input.requestKey),
            eq(warehouseDamageEntry.warehouseId, warehouseId),
          ),
        });
        if (duplicate?.status !== "draft") {
          if (duplicate) return { entry: duplicate, duplicate: true };
          if (input.draftId) {
            throw new ORPCError("NOT_FOUND", {
              message: "Damage draft not found",
            });
          }
        }
        if (
          duplicate?.status === "draft" &&
          (!input.draftId || duplicate.id !== input.draftId)
        ) {
          throw new ORPCError("CONFLICT", {
            message: "The selected damage draft no longer matches this form",
          });
        }
        const draftToPost = duplicate?.status === "draft" ? duplicate : null;

        for (const inventoryId of uniqueInventoryIds) {
          await tx.execute(
            sql`SELECT id FROM ${inventory} WHERE ${inventory.id} = ${inventoryId} FOR UPDATE`,
          );
        }
        const inventoryRows = await tx.query.inventory.findMany({
          where: and(
            eq(inventory.ownerType, "warehouse"),
            eq(inventory.ownerId, warehouseId),
            inArray(inventory.id, Array.from(uniqueInventoryIds)),
          ),
          with: {
            variant: {
              with: { product: true, brand: true, sourceVariantOption: true },
            },
          },
        });
        if (inventoryRows.length !== uniqueInventoryIds.size) {
          throw new ORPCError("FORBIDDEN", {
            message:
              "One or more inventory sources do not belong to this warehouse",
          });
        }
        const inventoryById = new Map(
          inventoryRows.map((row) => [row.id, row]),
        );
        const requestedStockEntryIds = input.items.flatMap((item) =>
          item.stockEntryId ? [item.stockEntryId] : [],
        );
        if (
          input.damageType !== "expired" &&
          requestedStockEntryIds.length > 0
        ) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Only expired damage may target a specific purchase batch",
          });
        }
        const uniqueStockEntryIds = Array.from(new Set(requestedStockEntryIds));
        for (const stockEntryId of uniqueStockEntryIds) {
          await tx.execute(
            sql`SELECT id FROM ${stockEntry} WHERE ${stockEntry.id} = ${stockEntryId} FOR UPDATE`,
          );
        }
        const explicitCostRows = requestedStockEntryIds.length
          ? await tx.query.stockEntry.findMany({
              where: and(
                eq(stockEntry.warehouseId, warehouseId),
                inArray(stockEntry.id, uniqueStockEntryIds),
              ),
            })
          : [];
        const explicitCostById = new Map(
          explicitCostRows.map((row) => [row.id, row]),
        );
        if (explicitCostRows.length !== uniqueStockEntryIds.length) {
          throw new ORPCError("FORBIDDEN", {
            message:
              "One or more stock batches do not belong to this warehouse",
          });
        }
        const stockCostRows = await tx
          .select()
          .from(stockEntry)
          .where(
            and(
              eq(stockEntry.warehouseId, warehouseId),
              inArray(
                stockEntry.variantId,
                inventoryRows.map((row) => row.variantId),
              ),
            ),
          )
          .orderBy(desc(stockEntry.createdAt), desc(stockEntry.id));
        const { costsByVariant: weightedCostByVariant } =
          allocateCurrentStockLots(
            stockCostRows,
            new Map(
              inventoryRows.map((row) => [
                row.variantId,
                toNumber(row.availableQty),
              ]),
            ),
          );
        const { availableByStockEntry } = allocateCurrentStockLots(
          stockCostRows,
          new Map(
            inventoryRows.map((row) => [
              row.variantId,
              Math.max(
                0,
                toNumber(row.availableQty) - toNumber(row.inCartonQty),
              ),
            ]),
          ),
        );
        const cartonRows =
          input.damageMode === "carton"
            ? await tx.query.carton.findMany({
                where: and(
                  eq(carton.warehouseId, warehouseId),
                  inArray(carton.id, Array.from(uniqueCartonIds)),
                ),
              })
            : [];
        if (
          input.damageMode === "carton" &&
          cartonRows.length !== uniqueCartonIds.size
        ) {
          throw new ORPCError("FORBIDDEN", {
            message: "One or more cartons do not belong to this warehouse",
          });
        }
        const cartonById = new Map(cartonRows.map((row) => [row.id, row]));

        const prepared = input.items.map((item) => {
          const inv = inventoryById.get(item.inventoryId)!;
          const variant = inv.variant;
          if (!variant?.sourceVariantOption) {
            throw new ORPCError("BAD_REQUEST", {
              message: `${variant?.product?.name ?? "Product"} needs a structured variant definition before damage can be posted`,
            });
          }
          const operations = resolveVariantOperations(
            variant.sourceVariantOption,
          );
          const selectedCarton = item.cartonId
            ? cartonById.get(item.cartonId)
            : null;
          if (input.damageMode === "carton") {
            if (!selectedCarton || selectedCarton.variantId !== inv.variantId) {
              throw new ORPCError("BAD_REQUEST", {
                message:
                  "The selected carton does not match its inventory variant",
              });
            }
            if (selectedCarton.status !== "active") {
              throw new ORPCError("CONFLICT", {
                message: `Carton ${selectedCarton.cartonId} is no longer available`,
              });
            }
          } else if (operations.receivingMode !== input.damageMode) {
            throw new ORPCError("BAD_REQUEST", {
              message: `${variant.product?.name ?? "Product"} must be recorded in ${operations.receivingMode} mode`,
            });
          }
          const quantity = selectedCarton?.totalPacks ?? item.quantity ?? 0;
          if (quantity <= 0) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Damage quantity is required",
            });
          }
          if (!operations.allowsDecimal && !Number.isInteger(quantity)) {
            throw new ORPCError("BAD_REQUEST", {
              message: `${variant.product?.name ?? "Product"} requires a whole ${operations.operationalUnit} quantity`,
            });
          }
          const explicitCost = item.stockEntryId
            ? explicitCostById.get(item.stockEntryId)
            : undefined;
          if (explicitCost && explicitCost.variantId !== inv.variantId) {
            throw new ORPCError("BAD_REQUEST", {
              message: "The selected batch does not match its product variant",
            });
          }
          if (input.damageType === "expired") {
            if (
              !explicitCost?.expiryDate ||
              explicitCost.expiryDate > input.entryDate
            ) {
              throw new ORPCError("BAD_REQUEST", {
                message:
                  "Expired damage requires a matching batch whose expiry date has passed",
              });
            }
          }
          const weightedCost = weightedCostByVariant.get(inv.variantId);
          const costEntry = explicitCost;
          const unitCost = explicitCost
            ? unitCostFromStockEntry(explicitCost)
            : weightedCost && weightedCost.quantity > 0
              ? weightedCost.weightedUnitCost
              : 0;
          return {
            input: item,
            inv,
            variant,
            operations,
            carton: selectedCarton,
            quantity,
            costEntry,
            unitCost,
            costingMethod:
              input.damageType === "expired"
                ? "batch_acquisition_cost"
                : weightedCost?.quantity
                  ? "weighted_current_acquisition_cost"
                  : "unvalued",
            totalValue: money(quantity * unitCost),
          };
        });

        const totalLossValue = money(
          prepared.reduce((sum, item) => sum + item.totalValue, 0),
        );
        if (input.damageType === "expired") {
          const requestedByStockEntry = new Map<number, number>();
          for (const item of prepared) {
            const stockEntryId = item.costEntry?.id;
            if (!stockEntryId) continue;
            requestedByStockEntry.set(
              stockEntryId,
              (requestedByStockEntry.get(stockEntryId) ?? 0) + item.quantity,
            );
          }
          for (const [
            stockEntryId,
            requestedQuantity,
          ] of requestedByStockEntry) {
            const remainingQuantity =
              availableByStockEntry.get(stockEntryId) ?? 0;
            if (requestedQuantity > remainingQuantity) {
              throw new ORPCError("CONFLICT", {
                message: `Only ${remainingQuantity} remains in the selected expired batch`,
              });
            }
          }
        }
        const postedValues = {
          damageType: input.damageType,
          damageMode: input.damageMode,
          description: input.description || null,
          proofImages: input.proofImages,
          draftPayload: null,
          totalLossValue: String(totalLossValue),
          entryDate: input.entryDate,
          status: "posted" as const,
          createdById: warehouseId,
          createdByName,
        };
        const [header] = draftToPost
          ? await tx
              .update(warehouseDamageEntry)
              .set(postedValues)
              .where(
                and(
                  eq(warehouseDamageEntry.id, draftToPost.id),
                  eq(warehouseDamageEntry.warehouseId, warehouseId),
                  eq(warehouseDamageEntry.status, "draft"),
                ),
              )
              .returning()
          : await tx
              .insert(warehouseDamageEntry)
              .values({
                ...postedValues,
                entryNo,
                requestKey: input.requestKey,
                warehouseId,
              })
              .returning();
        if (!header) {
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Could not create the damage entry",
          });
        }

        for (const item of prepared) {
          if (item.carton) {
            const updatedCarton = await tx
              .update(carton)
              .set({ status: "damaged" })
              .where(
                and(
                  eq(carton.id, item.carton.id),
                  eq(carton.warehouseId, warehouseId),
                  eq(carton.status, "active"),
                ),
              )
              .returning({ id: carton.id });
            const updatedInventory = await tx
              .update(inventory)
              .set({
                availableQty: sql`cast(${inventory.availableQty} as numeric) - ${item.quantity}`,
                inCartonQty: sql`cast(${inventory.inCartonQty} as numeric) - ${item.quantity}`,
                activeCartonCount: sql`${inventory.activeCartonCount} - 1`,
              })
              .where(
                and(
                  eq(inventory.id, item.inv.id),
                  eq(inventory.ownerType, "warehouse"),
                  eq(inventory.ownerId, warehouseId),
                  gte(inventory.availableQty, String(item.quantity)),
                  gte(inventory.inCartonQty, String(item.quantity)),
                  gte(inventory.activeCartonCount, 1),
                ),
              )
              .returning({ id: inventory.id });
            if (updatedCarton.length === 0 || updatedInventory.length === 0) {
              throw new ORPCError("CONFLICT", {
                message: `Carton ${item.carton.cartonId} or its inventory changed; refresh and try again`,
              });
            }
          } else {
            const updatedInventory = await tx
              .update(inventory)
              .set({
                availableQty: sql`cast(${inventory.availableQty} as numeric) - ${item.quantity}`,
              })
              .where(
                and(
                  eq(inventory.id, item.inv.id),
                  eq(inventory.ownerType, "warehouse"),
                  eq(inventory.ownerId, warehouseId),
                  sql`cast(${inventory.availableQty} as numeric) - cast(${inventory.inCartonQty} as numeric) >= ${item.quantity}`,
                ),
              )
              .returning({ id: inventory.id });
            if (updatedInventory.length === 0) {
              throw new ORPCError("CONFLICT", {
                message: `${item.variant.product?.name ?? "Product"} stock changed or there is not enough unpacked stock`,
              });
            }
          }
        }

        const insertedItems = await tx
          .insert(warehouseDamageItem)
          .values(
            prepared.map((item) => ({
              damageEntryId: header.id,
              inventoryId: item.inv.id,
              variantId: item.inv.variantId,
              stockEntryId: item.costEntry?.id ?? null,
              cartonId: item.carton?.id ?? null,
              quantity: String(item.quantity),
              quantityUnit: item.operations.operationalUnit,
              cartonCount: item.carton ? 1 : 0,
              sourceTotalWeightKg: item.carton?.totalWeightKg ?? null,
              unitCost: String(item.unitCost),
              totalValue: String(item.totalValue),
              costingMethod: item.costingMethod,
              currency: "BDT",
              skuSnapshot: item.variant.sku,
              productNameSnapshot:
                item.variant.product?.name ?? "Unknown product",
              brandNameSnapshot: item.variant.brand?.name ?? null,
              variantLabelSnapshot: variantLabel(item.variant),
              sourceLabelSnapshot:
                item.carton?.cartonId ?? item.costEntry?.batchNo ?? null,
              note: item.input.note || null,
            })),
          )
          .returning();
        await tx.insert(warehouseDamageMovement).values(
          insertedItems.map((item) => ({
            damageEntryId: header.id,
            damageItemId: item.id,
            warehouseId,
            inventoryId: item.inventoryId,
            cartonId: item.cartonId,
            movementKind: "damage" as const,
            quantityDelta: String(-toNumber(item.quantity)),
            quantityUnit: item.quantityUnit,
            actorId: warehouseId,
            actorName: createdByName,
            approvedById: warehouseId,
            approvedAt: new Date(),
            reason: input.description || "Warehouse damage posted",
          })),
        );
        return { entry: header, duplicate: false };
      });

      return {
        success: true,
        entryId: result.entry.id,
        entryNo: result.entry.entryNo,
        duplicate: result.duplicate,
      };
    }),

  reverse: warehouseProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        reason: z.string().trim().min(3).max(500),
      }),
    )
    .handler(async ({ context, input }) => {
      const warehouseId = context.session.user.id;
      await db.transaction(async (tx) => {
        const changed = await tx
          .update(warehouseDamageEntry)
          .set({
            status: "reversed",
            reversedAt: new Date(),
            reversedById: warehouseId,
            reversalReason: input.reason,
          })
          .where(
            and(
              eq(warehouseDamageEntry.id, input.id),
              eq(warehouseDamageEntry.warehouseId, warehouseId),
              eq(warehouseDamageEntry.status, "posted"),
            ),
          )
          .returning({ id: warehouseDamageEntry.id });
        if (changed.length === 0) {
          throw new ORPCError("CONFLICT", {
            message: "Damage entry was already reversed or does not exist",
          });
        }
        const items = await tx
          .select()
          .from(warehouseDamageItem)
          .where(eq(warehouseDamageItem.damageEntryId, input.id));
        for (const item of items) {
          const quantity = toNumber(item.quantity);
          if (item.cartonId) {
            const restoredCarton = await tx
              .update(carton)
              .set({ status: "active" })
              .where(
                and(
                  eq(carton.id, item.cartonId),
                  eq(carton.warehouseId, warehouseId),
                  eq(carton.status, "damaged"),
                ),
              )
              .returning({ id: carton.id });
            if (restoredCarton.length === 0) {
              throw new ORPCError("CONFLICT", {
                message: "A damaged carton could not be restored",
              });
            }
            const restoredInventory = await tx
              .update(inventory)
              .set({
                availableQty: sql`cast(${inventory.availableQty} as numeric) + ${quantity}`,
                inCartonQty: sql`cast(${inventory.inCartonQty} as numeric) + ${quantity}`,
                activeCartonCount: sql`${inventory.activeCartonCount} + 1`,
              })
              .where(
                and(
                  eq(inventory.id, item.inventoryId),
                  eq(inventory.ownerType, "warehouse"),
                  eq(inventory.ownerId, warehouseId),
                ),
              )
              .returning({ id: inventory.id });
            if (restoredInventory.length === 0) {
              throw new ORPCError("CONFLICT", {
                message: "The carton inventory could not be restored",
              });
            }
          } else {
            const restoredInventory = await tx
              .update(inventory)
              .set({
                availableQty: sql`cast(${inventory.availableQty} as numeric) + ${quantity}`,
              })
              .where(
                and(
                  eq(inventory.id, item.inventoryId),
                  eq(inventory.ownerType, "warehouse"),
                  eq(inventory.ownerId, warehouseId),
                ),
              )
              .returning({ id: inventory.id });
            if (restoredInventory.length === 0) {
              throw new ORPCError("CONFLICT", {
                message: "The damaged inventory could not be restored",
              });
            }
          }
        }
        await tx.insert(warehouseDamageMovement).values(
          items.map((item) => ({
            damageEntryId: input.id,
            damageItemId: item.id,
            warehouseId,
            inventoryId: item.inventoryId,
            cartonId: item.cartonId,
            movementKind: "reversal" as const,
            quantityDelta: item.quantity,
            quantityUnit: item.quantityUnit,
            actorId: warehouseId,
            actorName: context.session.user.name || "Warehouse user",
            approvedById: warehouseId,
            approvedAt: new Date(),
            reason: input.reason,
          })),
        );
      });
      return { success: true };
    }),
};
