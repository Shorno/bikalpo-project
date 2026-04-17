"use client";

import {
  BarChart3Icon,
  BookOpenIcon,
  BoxesIcon,
  ClipboardListIcon,
  CreditCardIcon,
  FileTextIcon,
  HeadphonesIcon,
  InboxIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  PackageIcon,
  PercentIcon,
  RotateCcwIcon,
  SettingsIcon,
  ShieldIcon,
  ShoppingCartIcon,
  StoreIcon,
  TagIcon,
  TruckIcon,
  TrendingDownIcon,
  UserCheckIcon,
  UsersIcon,
  WarehouseIcon,
  WalletIcon,
  NetworkIcon,
  PackageSearchIcon,
  ClipboardIcon,
  ArrowRightLeftIcon,
  MapPinIcon,
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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

const WH = "/warehouse/dashboard";

const warehouseNavGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        url: WH,
        icon: LayoutDashboardIcon,
      },
    ],
  },
  {
    label: "Inventory",
    items: [
      { title: "My Store", url: `${WH}/store`, icon: StoreIcon },
      { title: "Stock", url: `${WH}/stock`, icon: BoxesIcon },
      { title: "Product Catalog", url: `${WH}/products`, icon: PackageIcon },
      { title: "Stock Adjustment", url: `${WH}/stock-adjustment`, icon: ArrowRightLeftIcon },
    ],
  },
  {
    label: "Supply Management",
    items: [
      { title: "Supply Orders", url: `${WH}/supply-orders`, icon: InboxIcon },
      { title: "Dispatch Orders", url: `${WH}/dispatch-orders`, icon: TruckIcon },
      { title: "Delivery Tracking", url: `${WH}/delivery-tracking`, icon: PackageSearchIcon },
      { title: "Delivery Areas", url: `${WH}/delivery-management/areas`, icon: MapPinIcon },
      { title: "Returns", url: `${WH}/returns`, icon: RotateCcwIcon },
    ],
  },
  {
    label: "Sales Management",
    items: [
      { title: "Sales", url: `${WH}/sales`, icon: ShoppingCartIcon },
      { title: "Customer", url: `${WH}/customers`, icon: UsersIcon },
      { title: "Sales History", url: `${WH}/sales-history`, icon: FileTextIcon },
      { title: "Daybook", url: `${WH}/daybook`, icon: BookOpenIcon },
    ],
  },
  {
    label: "Purchase Management",
    items: [
      { title: "Purchase Orders", url: `${WH}/purchases`, icon: ClipboardListIcon },
      { title: "Suppliers", url: `${WH}/suppliers`, icon: UsersIcon },
      { title: "Purchase History", url: `${WH}/purchase-history`, icon: FileTextIcon },
    ],
  },
  {
    label: "Team Management",
    items: [
      { title: "Sales Team", url: `${WH}/sales-team`, icon: UserCheckIcon },
      { title: "Delivery Team", url: `${WH}/delivery-team`, icon: TruckIcon },
      { title: "Staff Performance", url: `${WH}/staff-performance`, icon: BarChart3Icon },
    ],
  },
  {
    label: "Network Stores",
    items: [
      { title: "Connected Stores", url: `${WH}/connected-stores`, icon: NetworkIcon },
      { title: "Store Requests", url: `${WH}/store-requests`, icon: InboxIcon },
    ],
  },
  {
    label: "Promotions & Marketing",
    items: [
      { title: "Promo Campaigns", url: `${WH}/promo-campaigns`, icon: MegaphoneIcon },
      { title: "Discount Offers", url: `${WH}/discount-offers`, icon: PercentIcon },
      { title: "Marketing Materials", url: `${WH}/marketing-materials`, icon: PackageIcon },
    ],
  },
  {
    label: "Reports",
    items: [
      { title: "Inventory Report", url: `${WH}/reports/inventory`, icon: ClipboardIcon },
      { title: "Supply Report", url: `${WH}/reports/supply`, icon: TruckIcon },
      { title: "Purchase Report", url: `${WH}/reports/purchase`, icon: FileTextIcon },
      { title: "Team Performance", url: `${WH}/reports/team-performance`, icon: BarChart3Icon },
    ],
  },
  {
    label: "Finance & Accounts",
    items: [
      { title: "Finance Dashboard", url: `${WH}/finance`, icon: WalletIcon },
      { title: "Expenses", url: `${WH}/finance/expenses`, icon: TrendingDownIcon },
      { title: "Payable", url: `${WH}/finance/payable`, icon: CreditCardIcon },
      { title: "Profit & Loss", url: `${WH}/finance/profit-loss`, icon: BarChart3Icon },
      { title: "Payees", url: `${WH}/finance/payees`, icon: UsersIcon },
      { title: "Transactions", url: `${WH}/transactions`, icon: CreditCardIcon },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Warehouse Profile", url: `${WH}/settings`, icon: SettingsIcon },
      { title: "Payment Accounts", url: `${WH}/payment-accounts`, icon: CreditCardIcon },
      { title: "User Roles", url: `${WH}/user-roles`, icon: ShieldIcon },
      { title: "Support", url: `${WH}/support`, icon: HeadphonesIcon },
    ],
  },
];

export function WarehouseSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { data, isPending } = authClient.useSession();

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/" className="flex items-center gap-2">
                <WarehouseIcon className="w-5 h-5 text-amber-600" />
                <p className="text-lg font-bold">
                  {(data?.user as any)?.warehouseName || "My Warehouse"}
                </p>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="mt-4 thin-scrollbar">
        <NavGrouped groups={warehouseNavGroups} />
      </SidebarContent>
      <SidebarFooter>
        {isPending || !data ? <UserNavSkeleton /> : <NavUser session={data as any} />}
      </SidebarFooter>
    </Sidebar>
  );
}
