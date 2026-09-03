export const SHOP_STAFF_PLATFORM_ROLE = "shop_staff" as const;

export const SHOP_FUNCTIONS = [
  "shop_admin",
  "purchase_manager",
  "sales_agent",
  "delivery",
  "inventory",
] as const;

export type ShopFunction = (typeof SHOP_FUNCTIONS)[number];

export const SHOP_MODULES = [
  "overview",
  "inventory",
  "purchase",
  "sales",
  "delivery",
  "finance",
  "contacts",
  "network",
  "fulfillment",
  "marketing",
  "reports",
  "referral",
  "settings",
  "staff",
] as const;

export type ShopModule = (typeof SHOP_MODULES)[number];

export type ShopActor = "owner" | ShopFunction;

export type ShopAccessLevel =
  | "Full Control"
  | "All Modules"
  | "Purchase"
  | "Sales"
  | "Delivery"
  | "Inventory";

const SHOP_FUNCTION_LABELS: Record<ShopFunction, string> = {
  shop_admin: "Admin",
  purchase_manager: "Purchase Mgr",
  sales_agent: "Sales Agent",
  delivery: "Delivery",
  inventory: "Warehouse",
};

const SHOP_FUNCTION_ACCESS_LEVELS: Record<ShopFunction, ShopAccessLevel> = {
  shop_admin: "All Modules",
  purchase_manager: "Purchase",
  sales_agent: "Sales",
  delivery: "Delivery",
  inventory: "Inventory",
};

const OWNER_MODULES = new Set<ShopModule>(SHOP_MODULES);

const SHOP_ADMIN_MODULES = new Set<ShopModule>(
  SHOP_MODULES.filter((module) => module !== "staff"),
);

const FUNCTION_MODULES: Record<ShopFunction, ReadonlySet<ShopModule>> = {
  shop_admin: SHOP_ADMIN_MODULES,
  purchase_manager: new Set(["overview", "purchase", "contacts", "network"]),
  sales_agent: new Set(["overview", "sales", "contacts", "fulfillment"]),
  delivery: new Set(["overview", "delivery", "fulfillment"]),
  inventory: new Set(["overview", "inventory"]),
};

export function listAssignableShopFunctions(): ShopFunction[] {
  return [...SHOP_FUNCTIONS];
}

export function shopFunctionLabel(shopFunction: ShopFunction): string {
  return SHOP_FUNCTION_LABELS[shopFunction];
}

export function shopFunctionAccessLevel(
  shopFunction: ShopFunction,
): ShopAccessLevel {
  return SHOP_FUNCTION_ACCESS_LEVELS[shopFunction];
}

export function canShopActorAccessModule(
  actor: ShopActor,
  module: ShopModule,
): boolean {
  if (actor === "owner") return OWNER_MODULES.has(module);
  return FUNCTION_MODULES[actor].has(module);
}

export function modulesForShopActor(actor: ShopActor): ShopModule[] {
  return SHOP_MODULES.filter((module) => canShopActorAccessModule(actor, module));
}

export function shopPortalShopId(user: {
  id: string;
  role: string | null | undefined;
  shopId?: string | null;
}): string | null {
  if (user.role === "shop_owner") return user.id;
  if (user.role === SHOP_STAFF_PLATFORM_ROLE && user.shopId) {
    return user.shopId;
  }
  return null;
}

export function canManageShopStaff(actor: ShopActor): boolean {
  return actor === "owner";
}

export function platformRoleForShopFunction(
  shopFunction: ShopFunction,
): "deliveryman" | typeof SHOP_STAFF_PLATFORM_ROLE {
  return shopFunction === "delivery" ? "deliveryman" : SHOP_STAFF_PLATFORM_ROLE;
}

export function isShopPortalRole(role: string | null | undefined): boolean {
  return role === "shop_owner" || role === SHOP_STAFF_PLATFORM_ROLE;
}

export function isShopFunction(
  value: string | null | undefined,
): value is ShopFunction {
  return SHOP_FUNCTIONS.includes(value as ShopFunction);
}

export function resolveShopFunctionForUser(user: {
  role: string | null | undefined;
  shopFunction?: string | null;
}): ShopActor | null {
  if (user.role === "shop_owner") return "owner";
  if (user.role === "deliveryman") return "delivery";
  if (user.role === SHOP_STAFF_PLATFORM_ROLE && isShopFunction(user.shopFunction)) {
    return user.shopFunction;
  }
  return null;
}

export function presentShopDirectoryMember(user: {
  id: string;
  name: string;
  role: string | null | undefined;
  shopFunction: string | null | undefined;
  banned: boolean | null | undefined;
}) {
  const actor = resolveShopFunctionForUser(user);
  if (actor === "owner") {
    return {
      id: user.id,
      name: user.name,
      roleLabel: "Super Admin",
      accessLevel: "Full Control" as const,
      isOwner: true,
      canOpenProfile: true,
      banned: Boolean(user.banned),
      actor,
    };
  }

  if (actor) {
    return {
      id: user.id,
      name: user.name,
      roleLabel: shopFunctionLabel(actor),
      accessLevel: shopFunctionAccessLevel(actor),
      isOwner: false,
      canOpenProfile: true,
      banned: Boolean(user.banned),
      actor,
    };
  }

  return {
    id: user.id,
    name: user.name,
    roleLabel: user.role || "Unknown",
    accessLevel: "All Modules" as const,
    isOwner: false,
    canOpenProfile: true,
    banned: Boolean(user.banned),
    actor,
  };
}
