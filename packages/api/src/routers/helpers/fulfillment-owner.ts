import { deliveryGroup, invoice, user } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { eq, type SQL, sql } from "drizzle-orm";

/**
 * The organization that owns a fulfillment desk and all of its operational
 * resources. Admin is deliberately represented as unscoped for existing
 * platform administration screens; warehouse and shop owners are always
 * tenant-scoped.
 */
export type FulfillmentOwner =
    | { kind: "warehouse"; id: string }
    | { kind: "shop"; id: string }
    | { kind: "admin"; id: string };

export type FulfillmentManager = {
    id: string;
    role?: string | null;
};

export function getFulfillmentOwner(
    manager: FulfillmentManager,
): FulfillmentOwner {
    switch (manager.role) {
        case "warehouse":
            return { kind: "warehouse", id: manager.id };
        case "shop_owner":
            return { kind: "shop", id: manager.id };
        case "admin":
            return { kind: "admin", id: manager.id };
        default:
            throw new ORPCError("FORBIDDEN", {
                message: "Fulfillment manager access required",
            });
    }
}

export function fulfillmentGroupOwnerCondition(
    owner: FulfillmentOwner,
): SQL | undefined {
    if (owner.kind === "warehouse") {
        return eq(deliveryGroup.warehouseId, owner.id);
    }
    if (owner.kind === "shop") {
        return eq(deliveryGroup.shopId, owner.id);
    }
    return undefined;
}

export function fulfillmentRiderOwnerCondition(
    owner: FulfillmentOwner,
): SQL | undefined {
    if (owner.kind === "warehouse") return eq(user.warehouseId, owner.id);
    if (owner.kind === "shop") return eq(user.shopId, owner.id);
    return undefined;
}

export function fulfillmentInvoiceOwnerCondition(
    owner: FulfillmentOwner,
): SQL | undefined {
    if (owner.kind === "warehouse") {
        return sql`EXISTS (
            SELECT 1 FROM "order" scoped_order
            WHERE scoped_order."id" = ${invoice.orderId}
                AND scoped_order."warehouse_id" = ${owner.id}
        )`;
    }
    if (owner.kind === "shop") {
        return sql`EXISTS (
            SELECT 1 FROM "order" scoped_order
            WHERE scoped_order."id" = ${invoice.orderId}
                AND scoped_order."shop_id" = ${owner.id}
                AND scoped_order."order_type" = 'b2c'
        )`;
    }
    return undefined;
}

export function fulfillmentGroupOwnerValues(owner: FulfillmentOwner) {
    return {
        warehouseId: owner.kind === "warehouse" ? owner.id : null,
        shopId: owner.kind === "shop" ? owner.id : null,
    };
}

export function fulfillmentOwnerLabel(owner: FulfillmentOwner) {
    return owner.kind === "shop" ? "store" : owner.kind;
}
