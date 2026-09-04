export const SHOP_PERMISSION_ACTIONS = [
  "view",
  "create",
  "update",
  "approve",
  "delete",
  "manage",
] as const;

const CRUD = ["view", "create", "update", "delete"] as const;
const VIEW = ["view"] as const;
const VIEW_UPDATE = ["view", "update"] as const;
const WORKFLOW = ["view", "create", "update", "approve", "delete"] as const;

/**
 * Better Auth is the source of truth for valid retailer-shop resources/actions.
 * Database-backed roles may only contain grants declared by this statement.
 */
export const SHOP_PERMISSION_STATEMENT = {
  shop_dashboard: VIEW,
  shop_products: CRUD,
  shop_product_catalog: ["view", "create", "update"] as const,
  shop_store: VIEW_UPDATE,
  shop_stock: ["view", "create", "update"] as const,
  shop_stock_adjustment: ["view", "create", "approve"] as const,
  shop_damage: ["view", "create", "update"] as const,
  shop_pricing: VIEW_UPDATE,
  shop_warehouses: ["view", "create", "update", "delete"] as const,
  shop_purchase_orders: WORKFLOW,
  shop_suppliers: CRUD,
  shop_pos: CRUD,
  shop_sales: ["view", "update", "delete"] as const,
  shop_daybook: VIEW,
  shop_emi: ["view", "create", "update", "approve"] as const,
  shop_finance: VIEW,
  shop_income: VIEW,
  shop_expenses: WORKFLOW,
  shop_receivables: ["view", "create", "update"] as const,
  shop_payables: ["view", "create", "update"] as const,
  shop_transactions: CRUD,
  shop_accounts: CRUD,
  shop_ledger: ["view", "update", "delete"] as const,
  shop_profit_loss: VIEW,
  shop_balance_sheet: VIEW,
  shop_finance_categories: CRUD,
  shop_customers: CRUD,
  shop_payees: CRUD,
  shop_connections: ["view", "create", "delete"] as const,
  shop_product_sync: VIEW_UPDATE,
  shop_incoming_orders: ["view", "update", "approve"] as const,
  shop_open_orders: ["view", "create", "update", "delete"] as const,
  shop_dispatch_orders: ["view", "create", "update"] as const,
  shop_delivery_management: ["view", "create", "update"] as const,
  shop_delivery_team: ["view", "create", "update", "delete", "manage"] as const,
  shop_sms_marketing: ["view", "create"] as const,
  shop_promotions: CRUD,
  shop_marketing_materials: ["view", "create"] as const,
  shop_sales_report: VIEW,
  shop_purchase_report: VIEW,
  shop_accounts_payable_report: VIEW,
  shop_accounts_receivable_report: VIEW,
  shop_profit_loss_report: VIEW,
  shop_stock_movement_report: VIEW,
  shop_referral: VIEW,
  shop_settings: VIEW_UPDATE,
  shop_staff: ["view", "create", "update", "delete", "manage"] as const,
  shop_system_control: VIEW_UPDATE,
  shop_support: ["view", "create", "update"] as const,
} as const;

export type ShopPermissionResource = keyof typeof SHOP_PERMISSION_STATEMENT;
export type ShopPermissionAction = (typeof SHOP_PERMISSION_ACTIONS)[number];

export type ShopPermissionMap = Partial<{
  [Resource in ShopPermissionResource]: ShopPermissionAction[];
}>;

export const SHOP_OWNER_ONLY_RESOURCES = [
  "shop_settings",
  "shop_staff",
  "shop_system_control",
] as const satisfies readonly ShopPermissionResource[];

export type ShopPermissionModule =
  | "overview"
  | "inventory"
  | "purchase"
  | "sales"
  | "finance"
  | "contacts"
  | "network"
  | "fulfillment"
  | "delivery"
  | "marketing"
  | "reports"
  | "referral"
  | "settings"
  | "staff"
  | "support";

export type ShopPermissionPage = {
  resource: ShopPermissionResource;
  module: ShopPermissionModule;
  label: string;
  description: string;
  href: string;
  paths: readonly { pattern: string; exact?: boolean }[];
};

export const SHOP_PERMISSION_MODULE_LABELS: Record<
  ShopPermissionModule,
  string
> = {
  overview: "Overview",
  inventory: "Inventory",
  purchase: "Supply & Purchasing",
  sales: "Sales",
  finance: "Finance & Accounts",
  contacts: "Contacts & Locations",
  network: "Network",
  fulfillment: "E-Commerce & Fulfillment",
  delivery: "Delivery Team",
  marketing: "Marketing",
  reports: "Reports",
  referral: "Referral",
  settings: "Settings",
  staff: "Staff",
  support: "Support",
};

const page = (
  resource: ShopPermissionResource,
  module: ShopPermissionModule,
  label: string,
  href: string,
  description: string,
  paths: ShopPermissionPage["paths"] = [{ pattern: href }],
): ShopPermissionPage => ({
  resource,
  module,
  label,
  href,
  description,
  paths,
});

/** One catalog feeds the role editor and direct-page authorization. */
export const SHOP_PERMISSION_PAGES: readonly ShopPermissionPage[] = [
  page(
    "shop_dashboard",
    "overview",
    "Dashboard",
    "/dashboard",
    "Shop overview and operational KPIs.",
    [{ pattern: "/dashboard", exact: true }],
  ),
  page(
    "shop_products",
    "inventory",
    "Products",
    "/dashboard/products",
    "Retail products and owner variants.",
  ),
  page(
    "shop_product_catalog",
    "inventory",
    "Product Catalog",
    "/dashboard/product-catalog",
    "Catalog browsing and product requests.",
  ),
  page(
    "shop_store",
    "sales",
    "My Store",
    "/dashboard/stores",
    "Storefront preview and store performance.",
  ),
  page(
    "shop_stock",
    "inventory",
    "Stock Control",
    "/dashboard/stock",
    "Stock overview, receipts, expiry, and conversions.",
    [
      { pattern: "/dashboard/stock" },
      { pattern: "/dashboard/inventory" },
    ],
  ),
  page(
    "shop_stock_adjustment",
    "inventory",
    "Stock Adjustment",
    "/dashboard/stock-adjustment",
    "Stock counts and adjustment workflow.",
  ),
  page(
    "shop_damage",
    "inventory",
    "Damage Register",
    "/dashboard/damage",
    "Damaged stock records.",
  ),
  page(
    "shop_pricing",
    "inventory",
    "Product Setup",
    "/dashboard/pricing",
    "Pricing, brands, and variant attributes.",
    [
      { pattern: "/dashboard/pricing" },
      { pattern: "/dashboard/products/brands" },
      { pattern: "/dashboard/products/variant-attributes" },
    ],
  ),
  page(
    "shop_warehouses",
    "purchase",
    "Warehouses",
    "/dashboard/warehouses",
    "Warehouse discovery and purchasing sources.",
  ),
  page(
    "shop_purchase_orders",
    "purchase",
    "Purchase Orders",
    "/dashboard/orders",
    "Wholesale purchasing and order tracking.",
    [
      { pattern: "/dashboard/orders" },
      { pattern: "/dashboard/order-from-warehouse" },
      { pattern: "/dashboard/purchases/manual" },
    ],
  ),
  page(
    "shop_suppliers",
    "purchase",
    "Suppliers",
    "/dashboard/suppliers",
    "Supplier records and bills.",
  ),
  page(
    "shop_pos",
    "sales",
    "Point of Sale",
    "/dashboard/pos",
    "Counter sales and held carts.",
  ),
  page(
    "shop_sales",
    "sales",
    "Sales",
    "/dashboard/sales",
    "Counter-sale history, collections, and voids.",
  ),
  page(
    "shop_daybook",
    "sales",
    "Daybook",
    "/dashboard/daybook",
    "Daily sales activity.",
  ),
  page(
    "shop_emi",
    "sales",
    "EMI Management",
    "/dashboard/emi",
    "Installment sales and collections.",
  ),
  page(
    "shop_finance",
    "finance",
    "Financial Overview",
    "/dashboard/finance",
    "Finance KPIs.",
    [{ pattern: "/dashboard/finance", exact: true }],
  ),
  page(
    "shop_income",
    "finance",
    "Income",
    "/dashboard/finance/income",
    "Income records.",
  ),
  page(
    "shop_expenses",
    "finance",
    "Expenses",
    "/dashboard/finance/expenses",
    "Expense entry and review.",
  ),
  page(
    "shop_receivables",
    "finance",
    "Receivable",
    "/dashboard/finance/receivable",
    "Customer outstanding balances.",
  ),
  page(
    "shop_payables",
    "finance",
    "Payable",
    "/dashboard/finance/payable",
    "Supplier balances and payments.",
  ),
  page(
    "shop_transactions",
    "finance",
    "Transactions",
    "/dashboard/finance/transactions",
    "Financial transactions.",
  ),
  page(
    "shop_accounts",
    "finance",
    "Payment Accounts",
    "/dashboard/payment-accounts",
    "Cash and bank accounts.",
  ),
  page(
    "shop_ledger",
    "finance",
    "Ledger",
    "/dashboard/finance/ledger",
    "General ledger and trial balance.",
    [
      { pattern: "/dashboard/finance/ledger" },
      { pattern: "/dashboard/finance/trial-balance" },
    ],
  ),
  page(
    "shop_profit_loss",
    "finance",
    "Profit & Loss",
    "/dashboard/finance/profit-loss",
    "Profit and loss statement.",
  ),
  page(
    "shop_balance_sheet",
    "finance",
    "Balance Sheet",
    "/dashboard/finance/balance-sheet",
    "Balance sheet.",
  ),
  page(
    "shop_finance_categories",
    "finance",
    "Finance Categories",
    "/dashboard/finance/categories",
    "Income and expense categories.",
  ),
  page(
    "shop_customers",
    "contacts",
    "Customers",
    "/dashboard/customers",
    "Shop-owned customer directory.",
  ),
  page(
    "shop_payees",
    "contacts",
    "Payees",
    "/dashboard/payees",
    "Expense payees.",
  ),
  page(
    "shop_connections",
    "network",
    "Connected Suppliers",
    "/dashboard/connected-suppliers",
    "Connected supply partners.",
  ),
  page(
    "shop_product_sync",
    "fulfillment",
    "Product Sync",
    "/dashboard/product-sync",
    "Storefront product synchronization.",
  ),
  page(
    "shop_incoming_orders",
    "fulfillment",
    "Incoming Orders",
    "/dashboard/incoming-orders",
    "Retailer order approval and invoicing.",
  ),
  page(
    "shop_open_orders",
    "purchase",
    "Open Orders",
    "/dashboard/open-orders",
    "Consumer request offers.",
  ),
  page(
    "shop_dispatch_orders",
    "fulfillment",
    "Dispatch Orders",
    "/dashboard/dispatch-orders",
    "Orders ready for handoff.",
  ),
  page(
    "shop_delivery_management",
    "fulfillment",
    "Delivery Management",
    "/dashboard/delivery-management",
    "Delivery groups and assignments.",
  ),
  page(
    "shop_delivery_team",
    "delivery",
    "Delivery Team",
    "/dashboard/delivery-team",
    "Retailer delivery staff and assignments.",
  ),
  page(
    "shop_sms_marketing",
    "marketing",
    "SMS Marketing",
    "/dashboard/sms-marketing",
    "Customer messaging campaigns.",
  ),
  page(
    "shop_promotions",
    "marketing",
    "Promotions",
    "/dashboard/promotions",
    "Retailer promotions and offers.",
  ),
  page(
    "shop_marketing_materials",
    "marketing",
    "Marketing Materials",
    "/dashboard/marketing-materials",
    "Request campaign materials.",
  ),
  page(
    "shop_sales_report",
    "reports",
    "Sales Report",
    "/dashboard/reports/sales",
    "Sales reporting.",
  ),
  page(
    "shop_purchase_report",
    "reports",
    "Purchase Report",
    "/dashboard/reports/purchase",
    "Purchase reporting.",
  ),
  page(
    "shop_accounts_payable_report",
    "reports",
    "Accounts Payable Report",
    "/dashboard/reports/accounts-payable",
    "Supplier payable reporting.",
  ),
  page(
    "shop_accounts_receivable_report",
    "reports",
    "Accounts Receivable Report",
    "/dashboard/reports/accounts-receivable",
    "Customer receivable reporting.",
  ),
  page(
    "shop_profit_loss_report",
    "reports",
    "Profit & Loss Report",
    "/dashboard/reports/profit-loss",
    "Profitability reporting.",
  ),
  page(
    "shop_stock_movement_report",
    "reports",
    "Stock Movement Report",
    "/dashboard/reports/stock-movement",
    "Inventory movement reporting.",
  ),
  page(
    "shop_referral",
    "referral",
    "Refer & Earn",
    "/dashboard/referral",
    "Referral program.",
  ),
  page(
    "shop_settings",
    "settings",
    "General Settings",
    "/dashboard/settings",
    "Business and login preferences.",
    [
      { pattern: "/dashboard/settings" },
      { pattern: "/dashboard/invoice-settings" },
    ],
  ),
  page(
    "shop_staff",
    "staff",
    "Roles & Permissions",
    "/dashboard/user-roles",
    "Staff accounts, named roles, and permissions.",
  ),
  page(
    "shop_system_control",
    "settings",
    "System Control",
    "/dashboard/system-control",
    "Approval and order controls.",
  ),
  page(
    "shop_support",
    "support",
    "Support",
    "/dashboard/support",
    "Support tickets.",
  ),
];

export const ALL_SHOP_PERMISSION_STATEMENTS = Object.fromEntries(
  Object.entries(SHOP_PERMISSION_STATEMENT).map(([resource, actions]) => [
    resource,
    [...actions],
  ]),
) as ShopPermissionMap;
