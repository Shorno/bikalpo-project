"use client";

import {
    LayoutDashboardIcon,
    PackageIcon,
    ShoppingCartIcon,
    BoxesIcon,
    StoreIcon,
    SettingsIcon,
    HeadphonesIcon,
    InboxIcon,
    WarehouseIcon,
    TruckIcon,
    UsersIcon,
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
import { WAREHOUSE_BASE } from "@/lib/routes";

const warehouseNavGroups: NavGroup[] = [
    {
        label: "Overview",
        items: [
            {
                title: "Dashboard",
                url: WAREHOUSE_BASE,
                icon: LayoutDashboardIcon,
            },
        ],
    },
    {
        label: "Orders",
        items: [
            {
                title: "Incoming Orders",
                url: `${WAREHOUSE_BASE}/incoming-orders`,
                icon: InboxIcon,
            },
            {
                title: "My Orders",
                url: `${WAREHOUSE_BASE}/orders`,
                icon: ShoppingCartIcon,
            },
        ],
    },
    {
        label: "Warehouse Management",
        items: [
            {
                title: "Inventory",
                url: `${WAREHOUSE_BASE}/inventory`,
                icon: BoxesIcon,
            },
            {
                title: "Products",
                url: `${WAREHOUSE_BASE}/products`,
                icon: PackageIcon,
            },
        ],
    },
    {
        label: "Procurement",
        items: [
            {
                title: "Suppliers",
                url: `${WAREHOUSE_BASE}/suppliers`,
                icon: UsersIcon,
            },
            {
                title: "Purchases",
                url: `${WAREHOUSE_BASE}/purchases`,
                icon: TruckIcon,
            },
        ],
    },
    {
        label: "Settings",
        items: [
            {
                title: "Warehouse Profile",
                url: `${WAREHOUSE_BASE}/settings`,
                icon: SettingsIcon,
            },
            {
                title: "Storefront",
                url: `${WAREHOUSE_BASE}/store`,
                icon: StoreIcon,
            },
            {
                title: "Support",
                url: `${WAREHOUSE_BASE}/support`,
                icon: HeadphonesIcon,
            },
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
                {isPending || !data ? <UserNavSkeleton /> : <NavUser session={data} />}
            </SidebarFooter>
        </Sidebar>
    );
}
