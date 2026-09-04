import {
  canShopActorAccessModule,
  resolveShopPortalActor,
  type ShopActor,
  type ShopModule,
} from "@bikalpo-project/auth/shop-staff-access";
import { ORPCError } from "@orpc/server";

export type ShopSessionUser = {
  id: string;
  role: string | null;
  shopId: string | null;
  shopFunction: string | null;
};

const authorizedModules = Symbol("authorizedShopModules");
type AuthorizedUser = {
  [authorizedModules]?: Set<ShopModule>;
};

export function markShopModuleAuthorized(
  user: { id: string; role?: string | null },
  module: ShopModule,
) {
  const target = user as AuthorizedUser;
  target[authorizedModules] ??= new Set();
  target[authorizedModules]?.add(module);
}

export function shopSessionUser(user: {
  id: string;
  role?: string | null;
}): ShopSessionUser {
  const extra = user as {
    shopId?: string | null;
    shopFunction?: string | null;
  };
  return {
    id: user.id,
    role: user.role ?? null,
    shopId: extra.shopId ?? null,
    shopFunction: extra.shopFunction ?? null,
  };
}

export function requireShopPortalActor(user: {
  id: string;
  role?: string | null;
}): {
  shopId: string;
  actor: ShopActor;
} {
  const portal = resolveShopPortalActor(shopSessionUser(user));
  if (!portal) {
    throw new ORPCError("FORBIDDEN", {
      message: "Shop dashboard access required",
    });
  }
  return portal;
}

export function shopTenantId(user: {
  id: string;
  role?: string | null;
}): string {
  return requireShopPortalActor(user).shopId;
}

export function requireShopModule(
  user: { id: string; role?: string | null },
  module: ShopModule,
): { shopId: string; actor: ShopActor } {
  const portal = requireShopPortalActor(user);
  const wasAuthorized = (user as AuthorizedUser)[authorizedModules]?.has(
    module,
  );
  if (!wasAuthorized && !canShopActorAccessModule(portal.actor, module)) {
    throw new ORPCError("FORBIDDEN", {
      message: `Shop ${module} access required`,
    });
  }
  return portal;
}

export function shopOrWarehouseOwnerScope(
  user: { id: string; role?: string | null },
  shopModule: ShopModule,
): { ownerType: "shop" | "warehouse"; ownerId: string } {
  if (user.role === "warehouse") {
    return { ownerType: "warehouse", ownerId: user.id };
  }
  const portal = requireShopModule(user, shopModule);
  return { ownerType: "shop", ownerId: portal.shopId };
}
