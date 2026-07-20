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
  HeadphonesIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  PackageIcon,
  PackageSearchIcon,
  PlusCircleIcon,
  ReceiptIcon,
  SettingsIcon,
  ShieldIcon,
  ShoppingCartIcon,
  SmartphoneIcon,
  StoreIcon,
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
      { title: "Ledger", url: `${D}/finance/ledger`, icon: FileTextIcon },
      {
        title: "Profit & Loss",
        url: `${D}/finance/profit-loss`,
        icon: BarChart3Icon,
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
    items: [
      { title: "Sales Report", url: `${D}/reports/sales`, icon: BarChart3Icon },
      {
        title: "Purchase Report",
        url: `${D}/reports/purchase`,
        icon: FileTextIcon,
      },
      {
        title: "Stock Movement",
        url: `${D}/reports/stock-movement`,
        icon: BoxesIcon,
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
      { title: "Business Profile", url: `${D}/settings`, icon: SettingsIcon },
      {
        title: "Payment Accounts",
        url: `${D}/payment-accounts`,
        icon: CreditCardIcon,
      },
      { title: "User Roles", url: `${D}/user-roles`, icon: ShieldIcon },
      {
        title: "Invoice Settings",
        url: `${D}/invoice-settings`,
        icon: FileTextIcon,
      },
      { title: "Support", url: `${D}/support`, icon: HeadphonesIcon },
    ],
  },
];

export function ShopOwnerSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { data, isPending } = authClient.useSession();

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
            <StoreIcon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate group-hover:text-emerald-600 transition-colors">
              {data?.user?.shopName || "My Shop"}
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
        <NavGrouped groups={shopOwnerNavGroups} />
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
