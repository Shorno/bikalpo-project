"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart3Icon,
  BookOpenIcon,
  BoxesIcon,
  CalculatorIcon,
  ClipboardIcon,
  ClipboardListIcon,
  CreditCardIcon,
  FileTextIcon,
  InboxIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  MapPinIcon,
  MegaphoneIcon,
  NetworkIcon,
  PackageIcon,
  PackagePlusIcon,
  PackageSearchIcon,
  PercentIcon,
  RotateCcwIcon,
  SettingsIcon,
  ShieldIcon,
  ShoppingCartIcon,
  StoreIcon,
  TagIcon,
  TrendingDownIcon,
  TruckIcon,
  UserCheckIcon,
  UsersIcon,
  WalletIcon,
  WarehouseIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { orpc } from "@/utils/orpc";

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
      { title: "Products", url: `${WH}/products`, icon: PackageIcon },
      { title: "Product Catalog", url: `${WH}/catalog`, icon: TagIcon },
      {
        title: "Catalog Requests",
        url: `${WH}/catalog/requests`,
        icon: ClipboardListIcon,
      },
      { title: "Pricing", url: `${WH}/pricing`, icon: WalletIcon },
      {
        title: "Inventory Management",
        url: `${WH}/inventory`,
        icon: ClipboardIcon,
      },
      {
        title: "Stock Control",
        url: `${WH}/stock`,
        icon: BoxesIcon,
        items: [
          { title: "Stock Overview", url: `${WH}/stock` },
          { title: "Stock", url: `${WH}/stock/list` },
          { title: "Brands", url: `${WH}/stock/brands` },
          { title: "Carton Tracking", url: `${WH}/carton-tracking` },
          { title: "Expired Products", url: `${WH}/stock/expired` },
          { title: "Stock Adjustment", url: `${WH}/stock-adjustment` },
          { title: "Unit/Carton Inventory", url: `${WH}/stock/unit-carton` },
          { title: "Add Stock", url: `${WH}/stock/add` },
        ],
      },
    ],
  },
  {
    label: "Supply Management",
    items: [
      {
        title: "Order Management",
        url: `${WH}/order-management`,
        icon: InboxIcon,
      },
      {
        title: "Dispatch Orders",
        url: `${WH}/dispatch-orders`,
        icon: TruckIcon,
      },
      {
        title: "Delivery Management",
        url: `${WH}/delivery-management`,
        icon: PackageSearchIcon,
      },
      {
        title: "Delivery Tracking",
        url: `${WH}/delivery-tracking`,
        icon: PackageSearchIcon,
      },
      {
        title: "Delivery Areas",
        url: `${WH}/delivery-management/areas`,
        icon: MapPinIcon,
      },
      { title: "Returns", url: `${WH}/returns`, icon: RotateCcwIcon },
    ],
  },
  {
    label: "Sales Management",
    items: [
      { title: "POS", url: `${WH}/pos`, icon: CalculatorIcon },
      { title: "Sales", url: `${WH}/sales`, icon: ShoppingCartIcon },
      {
        title: "Estimate Management",
        url: `${WH}/estimates`,
        icon: FileTextIcon,
      },
      { title: "Customer", url: `${WH}/customers`, icon: UsersIcon },
      {
        title: "Sales History",
        url: `${WH}/sales-history`,
        icon: FileTextIcon,
      },
      { title: "Daybook", url: `${WH}/daybook`, icon: BookOpenIcon },
    ],
  },
  {
    label: "Purchase Management",
    items: [
      {
        title: "Quick Purchase",
        url: `${WH}/quick-purchase`,
        icon: PackagePlusIcon,
      },

      {
        title: "Supplier Purchases",
        url: `${WH}/purchases`,
        icon: ClipboardListIcon,
      },
      { title: "Suppliers", url: `${WH}/suppliers`, icon: UsersIcon },
      {
        title: "Purchase History",
        url: `${WH}/purchase-history`,
        icon: FileTextIcon,
      },
    ],
  },
  {
    label: "Team Management",
    items: [
      { title: "Sales Team", url: `${WH}/sales-team`, icon: UserCheckIcon },
      { title: "Delivery Team", url: `${WH}/delivery-team`, icon: TruckIcon },
      {
        title: "Rider Assignment",
        url: `${WH}/delivery-team/assignment`,
        icon: UserCheckIcon,
      },
      {
        title: "Assign Orders",
        url: `${WH}/delivery-team/assignments`,
        icon: ClipboardListIcon,
      },
      {
        title: "Staff Performance",
        url: `${WH}/staff-performance`,
        icon: BarChart3Icon,
      },
    ],
  },
  {
    label: "Network Stores",
    items: [
      {
        title: "Connected Stores",
        url: `${WH}/connected-stores`,
        icon: NetworkIcon,
      },
      {
        title: "Store Requests",
        url: `${WH}/store-requests`,
        icon: InboxIcon,
      },
      {
        title: "Warehouse Requests",
        url: `${WH}/supplier-requests`,
        icon: WarehouseIcon,
      },
    ],
  },
  {
    label: "Promotions & Marketing",
    items: [
      {
        title: "Promo Campaigns",
        url: `${WH}/promo-campaigns`,
        icon: MegaphoneIcon,
      },
      {
        title: "Discount Offers",
        url: `${WH}/discount-offers`,
        icon: PercentIcon,
      },
      {
        title: "Marketing Materials",
        url: `${WH}/marketing-materials`,
        icon: PackageIcon,
      },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        title: "Inventory Report",
        url: `${WH}/reports/inventory`,
        icon: ClipboardIcon,
      },
      {
        title: "Supply Report",
        url: `${WH}/reports/supply`,
        icon: TruckIcon,
      },
      {
        title: "Purchase Report",
        url: `${WH}/reports/purchase`,
        icon: FileTextIcon,
      },
      {
        title: "Team Performance",
        url: `${WH}/reports/team-performance`,
        icon: BarChart3Icon,
      },
    ],
  },
  {
    label: "Finance & Accounts",
    items: [
      {
        title: "Financial Overview (KPI)",
        url: `${WH}/finance`,
        icon: WalletIcon,
      },
      { title: "Income", url: `${WH}/finance/income`, icon: WalletIcon },
      {
        title: "Expenses",
        url: `${WH}/finance/expenses`,
        icon: TrendingDownIcon,
      },
      {
        title: "Receivable",
        url: `${WH}/finance/receivable`,
        icon: CreditCardIcon,
      },
      {
        title: "Payable",
        url: `${WH}/finance/payable`,
        icon: CreditCardIcon,
      },
      {
        title: "Transactions",
        url: `${WH}/transactions`,
        icon: CreditCardIcon,
      },
      {
        title: "Accounts",
        url: `${WH}/payment-accounts`,
        icon: CreditCardIcon,
      },
      { title: "Ledger", url: `${WH}/finance/ledger`, icon: FileTextIcon },
      {
        title: "Cash Collection",
        url: `${WH}/finance/cash-collection`,
        icon: WalletIcon,
      },
      {
        title: "Profit & Loss (Simple)",
        url: `${WH}/finance/profit-loss`,
        icon: BarChart3Icon,
      },
      {
        title: "Balance Sheet",
        url: `${WH}/finance/balance-sheet`,
        icon: FileTextIcon,
      },
      {
        title: "Ledger / Trial Balance (Hidden / Advanced)",
        url: `${WH}/finance/trial-balance`,
        icon: FileTextIcon,
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        title: "Warehouse Profile",
        url: `${WH}/settings`,
        icon: SettingsIcon,
      },
      {
        title: "Payment Accounts",
        url: `${WH}/payment-accounts`,
        icon: CreditCardIcon,
      },
      { title: "User Roles", url: `${WH}/user-roles`, icon: ShieldIcon },
      {
        title: "Support & Help",
        url: `${WH}/support`,
        icon: LifeBuoyIcon,
        items: [
          { title: "Live Support", url: `${WH}/support/live` },
          { title: "My Tickets", url: `${WH}/support` },
          { title: "Complaint", url: `${WH}/support/complaints` },
          { title: "Help Center", url: `${WH}/support/help-center` },
          { title: "Emergency Contact", url: `${WH}/support/emergency` },
        ],
      },
    ],
  },
];

export function WarehouseSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { data, isPending } = authClient.useSession();
  const [hasMounted, setHasMounted] = useState(false);
  const { data: estimateApprovalData } = useQuery({
    queryKey: ["warehouseEstimate", "pendingApprovalCount"],
    queryFn: () => orpc.warehouseEstimate.getPendingApprovalCount.call({}),
    enabled: hasMounted && !isPending && !!data?.user,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const pendingEstimateApprovalCount =
    estimateApprovalData?.pendingApprovalCount ?? 0;
  const warehouseNavGroupsWithBadges = useMemo(
    () =>
      warehouseNavGroups.map((group) => {
        if (group.label !== "Sales Management") return group;

        return {
          ...group,
          items: group.items.map((item) =>
            item.title === "Estimate Management"
              ? { ...item, badge: pendingEstimateApprovalCount }
              : item,
          ),
        };
      }),
    [pendingEstimateApprovalCount],
  );

  useEffect(() => {
    setHasMounted(true);
  }, []);

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
                  {hasMounted
                    ? (data?.user as any)?.warehouseName || "My Warehouse"
                    : "My Warehouse"}
                </p>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="mt-4 thin-scrollbar">
        <NavGrouped groups={warehouseNavGroupsWithBadges} />
      </SidebarContent>
      <SidebarFooter>
        {!hasMounted || isPending || !data ? (
          <UserNavSkeleton />
        ) : (
          <NavUser session={data as any} />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
