import {
  normalizeShopPermissionMap,
  permissionMapForShopActor,
  type ShopPermissionMap,
} from "@bikalpo-project/auth/shop-permissions";
import {
  SHOP_FUNCTIONS,
  type ShopFunction,
} from "@bikalpo-project/auth/shop-staff-access";
import { db } from "@bikalpo-project/db";
import {
  shopRole,
  shopRolePermission,
  shopUserRole,
  user,
} from "@bikalpo-project/db/schema";
import { and, eq, inArray } from "drizzle-orm";

const DEFAULT_ROLE_NAMES: Record<Exclude<ShopFunction, "delivery">, string> = {
  shop_admin: "Shop Administrator",
  purchase_manager: "Purchase Manager",
  sales_agent: "Sales Agent",
  inventory: "Inventory Manager",
};

export function permissionRows(roleId: number, permissions: ShopPermissionMap) {
  return Object.entries(permissions).map(([resource, actions]) => ({
    roleId,
    resource,
    actions: [...actions],
  }));
}

/** Lazily creates editable copies of the legacy templates and assigns old staff. */
export async function ensureDefaultShopRoles(shopId: string) {
  const existing = await db
    .select()
    .from(shopRole)
    .where(eq(shopRole.shopId, shopId));
  const byFunction = new Map(
    existing.map((role) => [role.legacyFunction, role]),
  );

  for (const shopFunction of SHOP_FUNCTIONS) {
    if (shopFunction === "delivery" || byFunction.has(shopFunction)) continue;
    const role = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(shopRole)
        .values({
          shopId,
          name: DEFAULT_ROLE_NAMES[shopFunction],
          description:
            "Editable default role migrated from the previous access model.",
          isSystem: true,
          legacyFunction: shopFunction,
        })
        .onConflictDoNothing()
        .returning();
      const stored =
        created ??
        (
          await tx
            .select()
            .from(shopRole)
            .where(
              and(
                eq(shopRole.shopId, shopId),
                eq(shopRole.legacyFunction, shopFunction),
              ),
            )
            .limit(1)
        )[0];
      if (created && stored) {
        const rows = permissionRows(
          stored.id,
          normalizeShopPermissionMap(permissionMapForShopActor(shopFunction)),
        );
        if (rows.length) await tx.insert(shopRolePermission).values(rows);
      }
      return stored;
    });
    if (!role) continue;
    byFunction.set(shopFunction, role);
  }

  const unassignedStaff = await db
    .select({ id: user.id, shopFunction: user.shopFunction })
    .from(user)
    .leftJoin(shopUserRole, eq(shopUserRole.userId, user.id))
    .where(
      and(
        eq(user.shopId, shopId),
        eq(user.role, "shop_staff"),
        inArray(user.shopFunction, [...SHOP_FUNCTIONS]),
      ),
    );
  for (const member of unassignedStaff) {
    if (!member.shopFunction || member.shopFunction === "delivery") continue;
    const role = byFunction.get(member.shopFunction);
    if (!role) continue;
    await db
      .insert(shopUserRole)
      .values({ userId: member.id, shopId, roleId: role.id })
      .onConflictDoNothing();
  }

  return [...byFunction.values()];
}
