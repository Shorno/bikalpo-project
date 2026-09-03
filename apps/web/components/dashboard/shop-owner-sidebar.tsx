"use client";

import {
  AlertTriangleIcon,
  ArrowRightLeftIcon,
  BarChart3Icon,
  BookOpenIcon,
  BoxesIcon,
  ClipboardListIcon,
  CreditCardIcon,
  DollarSignIcon,
  ExternalLinkIcon,
  FileTextIcon,
  GiftIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  PackageIcon,
  PackageSearchIcon,
  PlusCircleIcon,
  ReceiptIcon,
  SettingsIcon,
  ShoppingCartIcon,
  SmartphoneIcon,
  StoreIcon,
  TagIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  TruckIcon,
  UsersIcon,
  WalletIcon,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import Link from "next/link";
import { type NavGroup, NavGrouped } from "@/components/dashboard/nav-grouped";
import { NavUser } from "@/components/dashboard/nav-user";
import UserNavSkeleton from "@/components/dashboard/user-nav-skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  canManageShopStaff,
  canShopActorAccessModule,
  resolveShopFunctionForUser,
  type ShopActor,
  type ShopModule,
} from "@bikalpo-project/auth/shop-staff-access";
import { authClient } from "@/lib/auth-client";

const D = "/dashboard";

const shopOwnerNavGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: D, icon: LayoutDashboardIcon }],
  },
  {
    label: "Inventory Management",
    items: [
      { title: "Inventory", url: `${D}/products`, icon: BoxesIcon },
      {
        title: "Product Catalog",
        url: `${D}/product-catalog`,
        icon: BookOpenIcon,
      },
      {
        title: "Catalog Requests",
        url: `${D}/product-catalog/requests`,
        icon: ClipboardListIcon,
      },
      { title: "My Store", url: `${D}/stores`, icon: StoreIcon },
    ],
  },
  {
    label: "Supply & Purchasing",
    items: [
      {
        title: "Stock Control",
        url: `${D}/stock`,
        icon: BoxesIcon,
        items: [
          { title: "Stock Overview", url: `${D}/stock` },
          { title: "Stock (Real-time)", url: `${D}/stock/live` },
          { title: "Low Stock", url: `${D}/stock/low` },
          { title: "Expired Products", url: `${D}/stock/expired` },
          { title: "Empty Pack", url: `${D}/stock/empty-pack` },
          { title: "Conversions", url: `${D}/stock/conversions` },
        ],
      },
      { title: "Add Stock", url: `${D}/stock/add`, icon: PlusCircleIcon },
      {
        title: "Stock Adjustment",
        url: `${D}/stock-adjustment`,
        icon: ArrowRightLeftIcon,
      },
      { title: "Damage", url: `${D}/damage`, icon: AlertTriangleIcon },
      {
        title: "Setup",
        url: `${D}/pricing`,
        icon: SettingsIcon,
        items: [
          { title: "Price", url: `${D}/pricing` },
          { title: "Brands", url: `${D}/products/brands` },
          {
            title: "Variant Attributes",
            url: `${D}/products/variant-attributes`,
          },
        ],
      },
      { title: "Warehouses", url: `${D}/warehouses`, icon: WarehouseIcon },
      {
        title: "Purchase Management",
        url: `${D}/orders`,
        icon: ShoppingCartIcon,
        items: [
          { title: "Purchase Orders", url: `${D}/orders` },
          { title: "Order Tracking", url: `${D}/orders/tracking` },
          { title: "Purchase History", url: `${D}/orders/history` },
        ],
      },
      { title: "Suppliers", url: `${D}/suppliers`, icon: UsersIcon },
    ],
  },
  {
    label: "Sales",
    items: [
      { title: "Point of Sale", url: `${D}/pos`, icon: ReceiptIcon },
      { title: "Sales", url: `${D}/sales`, icon: ShoppingCartIcon },
      { title: "Daybook", url: `${D}/daybook`, icon: BookOpenIcon },
      { title: "EMI Management", url: `${D}/emi`, icon: ReceiptIcon },
    ],
  },
  {
    label: "Finance & Accounts",
    items: [
      {
        title: "Financial Overview (KPI)",
        url: `${D}/finance`,
        icon: BarChart3Icon,
      },
      { title: "Income", url: `${D}/finance/income`, icon: TrendingUpIcon },
      {
        title: "Expenses",
        url: `${D}/finance/expenses`,
        icon: TrendingDownIcon,
      },
      {
        title: "Receivable",
        url: `${D}/finance/receivable`,
        icon: DollarSignIcon,
      },
      { title: "Payable", url: `${D}/finance/payable`, icon: WalletIcon },
      {
        title: "Transactions",
        url: `${D}/finance/transactions`,
        icon: ReceiptIcon,
      },
      {
        title: "Accounts",
        url: `${D}/payment-accounts`,
        icon: CreditCardIcon,
      },
      { title: "Ledger", url: `${D}/finance/ledger`, icon: FileTextIcon },
      {
        title: "Cash Collection",
        url: `${D}/finance/cash-collection`,
        icon: DollarSignIcon,
      },
      {
        title: "Profit & Loss (Simple)",
        url: `${D}/finance/profit-loss`,
        icon: BarChart3Icon,
      },
      {
        title: "Balance Sheet",
        url: `${D}/finance/balance-sheet`,
        icon: FileTextIcon,
      },
      {
        title: "Categories",
        url: `${D}/finance/categories`,
        icon: TagIcon,
      },
      {
        title: "Ledger / Trial Balance (Hidden / Advanced)",
        url: `${D}/finance/trial-balance`,
        icon: FileTextIcon,
      },
    ],
  },
  {
    label: "Contacts & Locations",
    items: [
      { title: "Customers", url: `${D}/customers`, icon: UsersIcon },
      { title: "Suppliers", url: `${D}/suppliers`, icon: UsersIcon },
      { title: "Payees", url: `${D}/payees`, icon: UsersIcon },
    ],
  },
  {
    label: "Network",
    items: [
      {
        title: "Connected Suppliers",
        url: `${D}/connected-suppliers`,
        icon: UsersIcon,
      },
    ],
  },
  {
    label: "E-Commerce & Fulfillment",
    items: [
      { title: "Product Sync", url: `${D}/product-sync`, icon: PackageIcon },
      {
        title: "Order Management",
        url: `${D}/incoming-orders`,
        icon: ShoppingCartIcon,
      },
      {
        title: "Open Orders",
        url: `${D}/open-orders`,
        icon: PackageIcon,
      },
      {
        title: "Dispatch Orders",
        url: `${D}/dispatch-orders`,
        icon: TruckIcon,
      },
      {
        title: "Delivery Management",
        url: `${D}/delivery-management`,
        icon: PackageSearchIcon,
      },
    ],
  },
  {
    label: "Team Management",
    items: [
      { title: "Delivery Team", url: `${D}/delivery-team`, icon: TruckIcon },
      {
        title: "Delivery Assignment",
        url: `${D}/delivery-team/assignments`,
        icon: ClipboardListIcon,
      },
    ],
  },
  {
    label: "Marketing",
    items: [
      {
        title: "SMS Marketing",
        url: `${D}/sms-marketing`,
        icon: SmartphoneIcon,
      },
      { title: "Promotions", url: `${D}/promotions`, icon: MegaphoneIcon },
      {
        title: "Marketing Materials",
        url: `${D}/marketing-materials`,
        icon: PackageIcon,
      },
    ],
  },
  {
    label: "Reports",
    hideLabel: true,
    items: [
      {
        activePrefixes: [`${D}/reports`],
        defaultOpen: true,
        title: "Reports",
        url: `${D}/reports`,
        icon: FileTextIcon,
        items: [
          {
            title: "Sales Report",
            url: `${D}/reports/sales`,
            icon: FileTextIcon,
          },
          {
            title: "Purchase Report",
            url: `${D}/reports/purchase`,
            icon: FileTextIcon,
          },
          {
            title: "ACCOUNTS PAYABLE Report",
            url: `${D}/reports/accounts-payable`,
            icon: FileTextIcon,
          },
          {
            title: "ACCOUNTS RECEIVABLE Report",
            url: `${D}/reports/accounts-receivable`,
            icon: FileTextIcon,
          },
          {
            title: "PROFIT & LOSS Report",
            url: `${D}/reports/profit-loss`,
            icon: FileTextIcon,
          },
        ],
      },
    ],
  },
  {
    label: "Referral",
    items: [{ title: "Refer & Earn", url: `${D}/referral`, icon: GiftIcon }],
  },
  {
    label: "Settings",
    items: [
      {
        title: "Settings",
        url: `${D}/settings`,
        icon: SettingsIcon,
        items: [
          { title: "General Settings", url: `${D}/settings` },
          {
            title: "User Roles and Permissions",
            url: `${D}/user-roles`,
          },
          { title: "System Control", url: `${D}/system-control` },
        ],
      },
    ],
  },
];

const SHOP_NAV_GROUP_MODULE: Record<string, ShopModule> = {
  Overview: "overview",
  "Inventory Management": "inventory",
  "Supply & Purchasing": "purchase",
  Sales: "sales",
  "Finance & Accounts": "finance",
  "Contacts & Locations": "contacts",
  Network: "network",
  "E-Commerce & Fulfillment": "fulfillment",
  "Team Management": "delivery",
  Marketing: "marketing",
  Reports: "reports",
  Referral: "referral",
  Settings: "settings",
};

function visibleShopNavGroups(actor: ShopActor | null): NavGroup[] {
  const effectiveActor = actor ?? "owner";
  return shopOwnerNavGroups.flatMap((group) => {
    const module = SHOP_NAV_GROUP_MODULE[group.label];
    if (module && !canShopActorAccessModule(effectiveActor, module)) {
      return [];
    }
    if (group.label !== "Settings" || canManageShopStaff(effectiveActor)) {
      return [group];
    }
    return [
      {
        ...group,
        items: group.items.map((item) => ({
          ...item,
          items: item.items?.filter(
            (sub) =>
              sub.url !== `${D}/user-roles` &&
              sub.url !== `${D}/system-control`,
          ),
        })),
      },
    ];
  });
}

export function ShopOwnerSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { data, isPending } = authClient.useSession();
  const actor = resolveShopFunctionForUser({
    role: data?.user.role,
    shopFunction: data?.user.shopFunction,
  });
  const groups = isPending ? shopOwnerNavGroups : visibleShopNavGroups(actor);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
            <StoreIcon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate group-hover:text-emerald-600 transition-colors">
              My Shop
            </p>
            <p className="text-xs text-muted-foreground">Shop Dashboard</p>
          </div>
        </Link>
        <a
          href="http://bikalpo.localhost:3001"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 pl-12"
        >
          <ExternalLinkIcon className="w-3 h-3" />
          bikalpo.com
        </a>
      </SidebarHeader>
      <SidebarContent className="mt-4 thin-scrollbar">
        <NavGrouped groups={groups} />
      </SidebarContent>
      <SidebarFooter>
        {isPending || !data ? (
          <UserNavSkeleton />
        ) : (
          <NavUser session={data as any} />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
