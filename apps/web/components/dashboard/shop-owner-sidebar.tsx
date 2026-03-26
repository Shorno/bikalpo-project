"use client";

import {
  BoxesIcon,
  DollarSignIcon,
  ExternalLinkIcon,
  HeadphonesIcon,
  InboxIcon,
  LayoutDashboardIcon,
  PackageIcon,
  SettingsIcon,
  ShoppingCartIcon,
  StoreIcon,
  WarehouseIcon,
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

const SHOP_DASHBOARD_BASE = "/dashboard";

const shopOwnerNavGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        url: SHOP_DASHBOARD_BASE,
        icon: LayoutDashboardIcon,
      },
    ],
  },
  {
    label: "Orders",
    items: [
      {
        title: "Consumer Orders",
        url: `${SHOP_DASHBOARD_BASE}/incoming-orders`,
        icon: InboxIcon,
      },
      {
        title: "My B2B Orders",
        url: `${SHOP_DASHBOARD_BASE}/orders`,
        icon: ShoppingCartIcon,
      },
      {
        title: "Order from Warehouse",
        url: `${SHOP_DASHBOARD_BASE}/order-from-warehouse`,
        icon: WarehouseIcon,
      },
    ],
  },
  {
    label: "Shop Management",
    items: [
      {
        title: "Products",
        url: `${SHOP_DASHBOARD_BASE}/products`,
        icon: PackageIcon,
      },
      {
        title: "Inventory",
        url: `${SHOP_DASHBOARD_BASE}/inventory`,
        icon: BoxesIcon,
      },
      {
        title: "Pricing",
        url: `${SHOP_DASHBOARD_BASE}/pricing`,
        icon: DollarSignIcon,
      },
    ],
  },
  {
    label: "Shop Settings",
    items: [
      {
        title: "Shop Profile",
        url: `${SHOP_DASHBOARD_BASE}/settings`,
        icon: SettingsIcon,
      },
      {
        title: "Store Page",
        url: `${SHOP_DASHBOARD_BASE}/stores`,
        icon: StoreIcon,
      },
      {
        title: "Support",
        url: `${SHOP_DASHBOARD_BASE}/support`,
        icon: HeadphonesIcon,
      },
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
        {isPending || !data ? <UserNavSkeleton /> : <NavUser session={data as any} />}
      </SidebarFooter>
    </Sidebar>
  );
}
