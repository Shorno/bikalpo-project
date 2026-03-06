"use client";

import {
    LayoutDashboardIcon,
    PackageIcon,
    ShoppingCartIcon,
    BoxesIcon,
    DollarSignIcon,
    StoreIcon,
    SettingsIcon,
    HeadphonesIcon,
    BarChart3Icon,
    InboxIcon,
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
                url: `${SHOP_DASHBOARD_BASE}/store`,
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
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            className="data-[slot=sidebar-menu-button]:p-1.5!"
                        >
                            <Link href="/" className="flex items-center gap-2">
                                <StoreIcon className="w-5 h-5 text-emerald-600" />
                                <p className="text-lg font-bold">
                                    {data?.user?.shopName || "My Shop"}
                                </p>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent className="mt-4 thin-scrollbar">
                <NavGrouped groups={shopOwnerNavGroups} />
            </SidebarContent>
            <SidebarFooter>
                {isPending || !data ? <UserNavSkeleton /> : <NavUser session={data} />}
            </SidebarFooter>
        </Sidebar>
    );
}
