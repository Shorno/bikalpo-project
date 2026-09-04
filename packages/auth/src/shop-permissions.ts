import { ac } from "./permissions";
import {
  ALL_SHOP_PERMISSION_STATEMENTS,
  SHOP_PERMISSION_PAGES,
  SHOP_PERMISSION_STATEMENT,
  type ShopPermissionAction,
  type ShopPermissionMap,
  type ShopPermissionResource,
} from "./shop-permission-catalog";
import type { ShopActor } from "./shop-staff-access";

export * from "./shop-permission-catalog";

const LEGACY_ACTOR_RESOURCES: Record<
  Exclude<ShopActor, "owner">,
  readonly ShopPermissionResource[]
> = {
  custom: [],
  shop_admin: SHOP_PERMISSION_PAGES.filter(
    (entry) =>
      entry.resource !== "shop_staff" &&
      entry.resource !== "shop_system_control",
  ).map((entry) => entry.resource),
  purchase_manager: [
    "shop_dashboard",
    "shop_purchase_orders",
    "shop_warehouses",
    "shop_suppliers",
    "shop_customers",
    "shop_payees",
    "shop_connections",
    "shop_purchase_report",
    "shop_accounts_payable_report",
  ],
  sales_agent: [
    "shop_dashboard",
    "shop_store",
    "shop_pos",
    "shop_sales",
    "shop_daybook",
    "shop_emi",
    "shop_customers",
    "shop_payees",
    "shop_product_sync",
    "shop_incoming_orders",
    "shop_dispatch_orders",
    "shop_delivery_management",
    "shop_sales_report",
    "shop_accounts_receivable_report",
  ],
  delivery: [
    "shop_dashboard",
    "shop_dispatch_orders",
    "shop_delivery_management",
  ],
  inventory: [
    "shop_dashboard",
    "shop_products",
    "shop_product_catalog",
    "shop_stock",
    "shop_stock_adjustment",
    "shop_damage",
    "shop_pricing",
    "shop_stock_movement_report",
  ],
};

function permissionMapForResources(
  resources: readonly ShopPermissionResource[],
): ShopPermissionMap {
  return Object.fromEntries(
    resources.map((resource) => [
      resource,
      [...SHOP_PERMISSION_STATEMENT[resource]],
    ]),
  ) as ShopPermissionMap;
}

export function normalizeShopPermissionMap(
  input: Record<string, readonly string[]>,
): ShopPermissionMap {
  const normalized: ShopPermissionMap = {};
  for (const [resource, requestedActions] of Object.entries(input)) {
    if (!(resource in SHOP_PERMISSION_STATEMENT)) continue;
    const typedResource = resource as ShopPermissionResource;
    const allowedActions = SHOP_PERMISSION_STATEMENT[
      typedResource
    ] as readonly string[];
    const actions = [...new Set(requestedActions)].filter((action) =>
      allowedActions.includes(action),
    ) as ShopPermissionAction[];
    if (actions.length > 0) normalized[typedResource] = actions;
  }
  return normalized;
}

export function isValidShopPermissionMapInput(
  input: Record<string, readonly string[]>,
): boolean {
  return Object.entries(input).every(([resource, actions]) => {
    if (!(resource in SHOP_PERMISSION_STATEMENT)) return false;
    const allowed = SHOP_PERMISSION_STATEMENT[
      resource as ShopPermissionResource
    ] as readonly string[];
    return (
      new Set(actions).size === actions.length &&
      actions.every((action) => allowed.includes(action)) &&
      (!actions.some((action) => action !== "view") || actions.includes("view"))
    );
  });
}

export function authorizeShopPermission(
  permissionMap: ShopPermissionMap,
  resource: ShopPermissionResource,
  action: ShopPermissionAction,
): boolean {
  if (
    !(SHOP_PERMISSION_STATEMENT[resource] as readonly string[]).includes(action)
  ) {
    return false;
  }
  const role = ac.newRole(permissionMap as never);
  return role.authorize({ [resource]: [action] } as never).success;
}

export function permissionMapForShopActor(actor: ShopActor): ShopPermissionMap {
  if (actor === "owner") {
    return normalizeShopPermissionMap(ALL_SHOP_PERMISSION_STATEMENTS);
  }
  return permissionMapForResources(LEGACY_ACTOR_RESOURCES[actor]);
}

function pathMatches(
  pathname: string,
  matcher: { pattern: string; exact?: boolean },
): boolean {
  if (matcher.exact) return pathname === matcher.pattern;
  return (
    pathname === matcher.pattern || pathname.startsWith(`${matcher.pattern}/`)
  );
}

export function permissionPageForPath(pathname: string) {
  return SHOP_PERMISSION_PAGES.flatMap((entry) =>
    entry.paths.map((matcher) => ({ entry, matcher })),
  )
    .filter(({ matcher }) => pathMatches(pathname, matcher))
    .sort(
      (left, right) =>
        right.matcher.pattern.length - left.matcher.pattern.length,
    )[0]?.entry;
}

export function canPermissionMapAccessPath(
  permissionMap: ShopPermissionMap,
  pathname: string,
): boolean {
  const page = permissionPageForPath(pathname);
  return page
    ? authorizeShopPermission(permissionMap, page.resource, "view")
    : false;
}

export function canPermissionMapAccessModule(
  permissionMap: ShopPermissionMap,
  module: import("./shop-permission-catalog").ShopPermissionModule,
): boolean {
  return SHOP_PERMISSION_PAGES.some(
    (page) =>
      page.module === module &&
      authorizeShopPermission(permissionMap, page.resource, "view"),
  );
}
