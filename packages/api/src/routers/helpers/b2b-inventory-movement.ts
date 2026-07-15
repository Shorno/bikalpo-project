import {
  type FulfillmentMode,
  type InventoryBehaviour,
  isContainerFulfillmentMode,
} from "@bikalpo-project/db/fulfillment";
import {
  carton,
  inventory,
  orderItem,
  productVariant,
} from "@bikalpo-project/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { resolveWarehouseOrderMode } from "./warehouse-order-fulfillment";

export type B2bMovementCarton = {
  id: number;
  totalPacks: number | string;
  totalWeightKg: number | string;
};

export type B2bMovementSnapshot = {
  orderQty: number;
  sourceInventoryQty: number;
  retailerInventoryQty: number;
  conversionFactor: number;
  quantityUnit: string;
  inventoryUnit: string;
  cartonIds: number[];
  cartonInventoryQty: number;
  cartonCount: number;
};

type MovementInput = {
  orderQty: number;
  mode: FulfillmentMode;
  inventoryBehaviour: InventoryBehaviour;
  stockUnit: string;
  cartons?: B2bMovementCarton[];
  sourceIsLoose?: boolean;
  conversionLossPercent?: number;
};

function finitePositive(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be greater than zero`);
  }
  return parsed;
}

/**
 * Build the immutable quantity contract shared by reservation and receipt.
 * Order quantities stay user-facing; inventory quantities use the source
 * inventory's operational unit and may therefore differ for physical cartons.
 */
export function buildB2bMovementSnapshot(
  input: MovementInput,
): B2bMovementSnapshot {
  const orderQty = finitePositive(input.orderQty, "Approved quantity");
  const cartons = input.cartons ?? [];
  const isContainer =
    isContainerFulfillmentMode(input.mode) && cartons.length > 0;

  let sourceInventoryQty = orderQty;
  if (isContainer) {
    if (cartons.length !== orderQty) {
      throw new Error(
        `Expected ${orderQty} reservable cartons, found ${cartons.length}`,
      );
    }
    sourceInventoryQty = cartons.reduce(
      (sum, carton) =>
        sum +
        finitePositive(
          input.sourceIsLoose ? carton.totalWeightKg : carton.totalPacks,
          "Carton inventory quantity",
        ),
      0,
    );
  }

  const appliesConversionLoss =
    input.inventoryBehaviour === "auto_break" && isContainer;
  const lossPercent = appliesConversionLoss
    ? Math.max(0, Number(input.conversionLossPercent || 0))
    : 0;
  const retailerInventoryQty = sourceInventoryQty * (1 - lossPercent / 100);

  return {
    orderQty,
    sourceInventoryQty,
    retailerInventoryQty,
    conversionFactor: retailerInventoryQty / orderQty,
    quantityUnit: input.mode,
    inventoryUnit: input.stockUnit,
    cartonIds: cartons.map((carton) => carton.id),
    cartonInventoryQty: isContainer ? sourceInventoryQty : 0,
    cartonCount: isContainer ? cartons.length : 0,
  };
}

type VariantIdentity = {
  id: number;
  productId: number;
  brandId?: number | null;
  product?: {
    id?: number;
    brandId?: number | null;
    coreProductId?: number | null;
  } | null;
};

export function getEffectiveVariantBrandId(variant: VariantIdentity) {
  return variant.brandId ?? variant.product?.brandId ?? null;
}

export function assertCompatibleB2bTargetVariant(
  source: VariantIdentity,
  target: VariantIdentity,
) {
  const sourceCore = source.product?.coreProductId ?? null;
  const targetCore = target.product?.coreProductId ?? null;
  const sameProductIdentity =
    source.productId === target.productId ||
    (sourceCore !== null && targetCore !== null && sourceCore === targetCore);

  if (!sameProductIdentity) {
    throw new Error("Target variant belongs to a different product identity");
  }

  const sourceBrand = getEffectiveVariantBrandId(source);
  const targetBrand = getEffectiveVariantBrandId(target);
  if (sourceBrand !== targetBrand) {
    throw new Error("Target variant belongs to a different brand");
  }
}

export function getReceivedRetailerQty(input: {
  receivedOrderQty: number;
  approvedOrderQty: number;
  retailerInventoryQty: number;
}) {
  if (
    input.receivedOrderQty < 0 ||
    input.receivedOrderQty > input.approvedOrderQty
  ) {
    throw new Error("Received quantity exceeds the approved quantity");
  }
  if (input.approvedOrderQty <= 0) return 0;
  return (
    (input.receivedOrderQty / input.approvedOrderQty) *
    input.retailerInventoryQty
  );
}

type ApprovalItem = {
  id: number;
  productId: number;
  productName?: string;
  variantId: number | null;
  targetVariantId?: number | null;
  supplyMode?: string | null;
};

export async function prepareB2bMovementForApproval(
  tx: any,
  input: {
    warehouseId: string;
    item: ApprovalItem;
    approvedQty: number;
    reserveCartons?: boolean;
  },
) {
  if (!input.item.variantId) {
    throw new Error("Order item is missing its source variant");
  }

  const source = await tx.query.productVariant.findFirst({
    where: eq(productVariant.id, input.item.variantId),
    with: {
      product: {
        columns: {
          id: true,
          brandId: true,
          coreProductId: true,
          trackingType: true,
          isReturnablePack: true,
        },
        with: {
          category: {
            with: {
              type: {
                columns: {
                  family: true,
                  name: true,
                  slug: true,
                  inventoryBehaviour: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!source) throw new Error("Source variant was not found");

  const activeCartons = await tx.query.carton.findMany({
    where: and(
      eq(carton.warehouseId, input.warehouseId),
      eq(carton.variantId, source.id),
      eq(carton.status, "active"),
    ),
    orderBy: [asc(carton.createdAt), asc(carton.id)],
    limit: input.approvedQty,
  });

  const productType = source.product?.category?.type;
  const resolvedMode = resolveWarehouseOrderMode({
    requestedMode: (input.item.supplyMode || undefined) as
      | FulfillmentMode
      | undefined,
    activeCartonCount: activeCartons.length,
    productType: {
      family: productType?.family,
      typeName: productType?.name,
      typeSlug: productType?.slug,
      inventoryBehaviour: productType?.inventoryBehaviour,
      trackingType: source.product?.trackingType,
      isReturnablePack: source.product?.isReturnablePack,
    },
  });

  const selectedCartons =
    resolvedMode.stockStrategy === "container_count" ? activeCartons : [];
  if (
    resolvedMode.stockStrategy === "container_count" &&
    selectedCartons.length !== input.approvedQty
  ) {
    throw new Error(
      `Only ${selectedCartons.length} unreserved ${resolvedMode.mode}s remain`,
    );
  }

  const requestedTargetId =
    input.item.targetVariantId ?? source.linkedRetailVariantId ?? source.id;
  if (
    resolvedMode.requiresTargetVariant &&
    requestedTargetId === source.id &&
    !input.item.targetVariantId &&
    !source.linkedRetailVariantId
  ) {
    throw new Error(
      `${resolvedMode.mode} fulfillment requires a retail target variant`,
    );
  }

  const target =
    requestedTargetId === source.id
      ? source
      : await tx.query.productVariant.findFirst({
          where: eq(productVariant.id, requestedTargetId),
          with: {
            product: {
              columns: { id: true, brandId: true, coreProductId: true },
            },
          },
        });
  if (!target) throw new Error("Target retail variant was not found");
  assertCompatibleB2bTargetVariant(source, target);

  const movement = buildB2bMovementSnapshot({
    orderQty: input.approvedQty,
    mode: resolvedMode.mode,
    inventoryBehaviour: resolvedMode.profile.inventoryBehaviour,
    stockUnit: resolvedMode.profile.stockUnit,
    cartons: selectedCartons,
    sourceIsLoose: source.packType === "loose",
    conversionLossPercent: Number(source.conversionLossPercent || 0),
  });

  if (input.reserveCartons) {
    for (const cartonId of movement.cartonIds) {
      const reserved = await tx
        .update(carton)
        .set({
          status: "reserved",
          reservedForOrderItemId: input.item.id,
          reservedAt: new Date(),
        })
        .where(
          and(
            eq(carton.id, cartonId),
            eq(carton.warehouseId, input.warehouseId),
            eq(carton.variantId, source.id),
            eq(carton.status, "active"),
          ),
        )
        .returning({ id: carton.id });
      if (reserved.length === 0) {
        throw new Error("Carton stock changed during approval; review again");
      }
    }
  }

  return {
    sourceVariantId: source.id,
    targetVariantId: target.id,
    brandId: getEffectiveVariantBrandId(source),
    mode: resolvedMode.mode,
    movement,
  };
}

/**
 * Persist line snapshots, reserve concrete cartons, and move the aggregated
 * normalized requirement from available to reserved stock exactly once per
 * source variant.
 */
export async function reserveB2bOrderItemsAtApproval(
  tx: any,
  input: {
    warehouseId: string;
    lines: Array<{ item: ApprovalItem; approvedQty: number }>;
  },
) {
  const requirements = new Map<
    number,
    {
      sourceInventoryQty: number;
      cartonInventoryQty: number;
      cartonCount: number;
      productNames: string[];
    }
  >();

  for (const { item, approvedQty } of input.lines) {
    if (approvedQty <= 0) {
      await tx
        .update(orderItem)
        .set({ inventoryQty: "0" })
        .where(eq(orderItem.id, item.id));
      continue;
    }

    const prepared = await prepareB2bMovementForApproval(tx, {
      warehouseId: input.warehouseId,
      item,
      approvedQty,
      reserveCartons: true,
    });
    const movement = prepared.movement;

    await tx
      .update(orderItem)
      .set({
        supplyMode: prepared.mode,
        targetVariantId:
          prepared.targetVariantId === prepared.sourceVariantId
            ? null
            : prepared.targetVariantId,
        quantityUnit: movement.quantityUnit,
        inventoryUnit: movement.inventoryUnit,
        conversionFactor: movement.conversionFactor.toFixed(4),
        inventoryQty: movement.sourceInventoryQty.toFixed(2),
      })
      .where(eq(orderItem.id, item.id));

    const existing = requirements.get(prepared.sourceVariantId);
    requirements.set(prepared.sourceVariantId, {
      sourceInventoryQty:
        (existing?.sourceInventoryQty ?? 0) + movement.sourceInventoryQty,
      cartonInventoryQty:
        (existing?.cartonInventoryQty ?? 0) + movement.cartonInventoryQty,
      cartonCount: (existing?.cartonCount ?? 0) + movement.cartonCount,
      productNames: [
        ...(existing?.productNames ?? []),
        item.productName ?? `variant ${prepared.sourceVariantId}`,
      ],
    });
  }

  for (const [sourceVariantId, requirement] of requirements) {
    const reserved = await tx
      .update(inventory)
      .set({
        availableQty: sql`${inventory.availableQty}::numeric - ${requirement.sourceInventoryQty}`,
        reservedQty: sql`${inventory.reservedQty}::numeric + ${requirement.sourceInventoryQty}`,
        ...(requirement.cartonCount > 0
          ? {
              inCartonQty: sql`${inventory.inCartonQty}::numeric - ${requirement.cartonInventoryQty}`,
              activeCartonCount: sql`${inventory.activeCartonCount} - ${requirement.cartonCount}`,
            }
          : {}),
      })
      .where(
        and(
          eq(inventory.ownerType, "warehouse"),
          eq(inventory.ownerId, input.warehouseId),
          eq(inventory.variantId, sourceVariantId),
          sql`${inventory.availableQty}::numeric >= ${requirement.sourceInventoryQty}`,
          ...(requirement.cartonCount > 0
            ? [
                sql`${inventory.inCartonQty}::numeric >= ${requirement.cartonInventoryQty}`,
                sql`${inventory.activeCartonCount} >= ${requirement.cartonCount}`,
              ]
            : []),
        ),
      )
      .returning({ id: inventory.id });
    if (reserved.length === 0) {
      throw new Error(
        `Stock changed while reserving ${requirement.productNames.join(", ")}; please review the order again`,
      );
    }
  }
}

export async function releaseB2bOrderReservations(
  tx: any,
  input: {
    warehouseId: string;
    items: Array<{
      id: number;
      variantId: number | null;
      quantity: number;
      modifiedQty?: number | null;
      inventoryQty?: number | string | null;
    }>;
  },
) {
  for (const item of input.items) {
    if (!item.variantId) continue;
    const approvedQty = Number(item.modifiedQty ?? item.quantity);
    if (approvedQty <= 0) continue;
    const sourceQty = Number(item.inventoryQty ?? approvedQty);
    if (!Number.isFinite(sourceQty) || sourceQty <= 0) {
      throw new Error(`Invalid reservation snapshot for order item ${item.id}`);
    }

    const allocatedCartons = await tx.query.carton.findMany({
      where: and(
        eq(carton.reservedForOrderItemId, item.id),
        eq(carton.status, "reserved"),
      ),
      columns: { id: true },
    });

    const released = await tx
      .update(inventory)
      .set({
        availableQty: sql`${inventory.availableQty}::numeric + ${sourceQty}`,
        reservedQty: sql`${inventory.reservedQty}::numeric - ${sourceQty}`,
        ...(allocatedCartons.length > 0
          ? {
              inCartonQty: sql`${inventory.inCartonQty}::numeric + ${sourceQty}`,
              activeCartonCount: sql`${inventory.activeCartonCount} + ${allocatedCartons.length}`,
            }
          : {}),
      })
      .where(
        and(
          eq(inventory.ownerType, "warehouse"),
          eq(inventory.ownerId, input.warehouseId),
          eq(inventory.variantId, item.variantId),
          sql`${inventory.reservedQty}::numeric >= ${sourceQty}`,
        ),
      )
      .returning({ id: inventory.id });
    if (released.length === 0) {
      throw new Error(`Reservation mismatch for order item ${item.id}`);
    }

    if (allocatedCartons.length > 0) {
      await tx
        .update(carton)
        .set({
          status: "active",
          reservedForOrderItemId: null,
          reservedAt: null,
        })
        .where(
          inArray(
            carton.id,
            allocatedCartons.map((row: { id: number }) => row.id),
          ),
        );
    }
  }
}

export async function markOrderCartonsDispatched(tx: any, orderIds: number[]) {
  if (orderIds.length === 0) return;
  const itemRows = await tx.query.orderItem.findMany({
    where: inArray(orderItem.orderId, orderIds),
    columns: { id: true },
  });
  if (itemRows.length === 0) return;
  await tx
    .update(carton)
    .set({ status: "dispatched" })
    .where(
      and(
        inArray(
          carton.reservedForOrderItemId,
          itemRows.map((item: { id: number }) => item.id),
        ),
        eq(carton.status, "reserved"),
      ),
    );
}
