import {
  authorizeShopPermission,
  normalizeShopPermissionMap,
  permissionMapForShopActor,
  type ShopPermissionAction,
  type ShopPermissionMap,
  type ShopPermissionResource,
} from "@bikalpo-project/auth/shop-permissions";
import {
  resolveShopPortalActor,
  type ShopActor,
} from "@bikalpo-project/auth/shop-staff-access";
import { ORPCError } from "@orpc/server";

import { shopSessionUser } from "./shop-portal-scope";

export type AssignedShopRole = {
  id: number;
  name: string;
  permissions: Record<string, readonly string[]>;
};

export type ShopRoleGrantRepository = {
  findAssignedRole(
    userId: string,
    shopId: string,
  ): Promise<AssignedShopRole | null>;
};

export type ShopAuthorization = {
  shopId: string;
  actor: ShopActor;
  source: "owner" | "role" | "legacy";
  role: { id: number; name: string } | null;
  permissions: ShopPermissionMap;
  can(resource: ShopPermissionResource, action: ShopPermissionAction): boolean;
};

export async function resolveShopAuthorization(
  user: {
    id: string;
    role?: string | null;
    shopId?: string | null;
    shopFunction?: string | null;
  },
  repository: ShopRoleGrantRepository,
): Promise<ShopAuthorization> {
  const portal = resolveShopPortalActor(shopSessionUser(user));
  if (!portal) {
    throw new ORPCError("FORBIDDEN", {
      message: "Shop dashboard access required",
    });
  }

  if (portal.actor === "owner") {
    const permissions = permissionMapForShopActor("owner");
    return {
      ...portal,
      source: "owner",
      role: null,
      permissions,
      can: (resource, action) =>
        authorizeShopPermission(permissions, resource, action),
    };
  }

  const assignedRole = await repository.findAssignedRole(
    user.id,
    portal.shopId,
  );
  const permissions = assignedRole
    ? normalizeShopPermissionMap(assignedRole.permissions)
    : permissionMapForShopActor(portal.actor);

  return {
    ...portal,
    source: assignedRole ? "role" : "legacy",
    role: assignedRole
      ? { id: assignedRole.id, name: assignedRole.name }
      : null,
    permissions,
    can: (resource, action) =>
      authorizeShopPermission(permissions, resource, action),
  };
}

export async function requireShopPermission(
  user: {
    id: string;
    role?: string | null;
    shopId?: string | null;
    shopFunction?: string | null;
  },
  resource: ShopPermissionResource,
  action: ShopPermissionAction,
  repository: ShopRoleGrantRepository,
) {
  const access = await resolveShopAuthorization(user, repository);
  if (!access.can(resource, action)) {
    throw new ORPCError("FORBIDDEN", {
      message: `${resource.replaceAll("_", " ").replace(/^shop /, "Shop ")} ${action} access required`,
    });
  }
  return access;
}
