"use client";

import {
  ActivityIcon,
  Boxes,
  ClipboardListIcon,
  ContactIcon,
  DollarSignIcon,
  FileTextIcon,
  HeadphonesIcon,
  LayoutDashboardIcon,
  ListIcon,
  MegaphoneIcon,
  PackageIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  TagIcon,
  TruckIcon,
  Undo2Icon,
  Users2Icon,
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
import { ADMIN_BASE } from "@/lib/routes";

const adminNavGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        url: ADMIN_BASE,
        icon: LayoutDashboardIcon,
      },
    ],
  },
  {
    label: "Catalog",
    items: [
      {
        title: "Products",
        url: `${ADMIN_BASE}/products`,
        icon: PackageIcon,
      },
      {
        title: "Stock / Inventory",
        url: `${ADMIN_BASE}/stock`,
        icon: Boxes,
      },
      {
        title: "Categories",
        url: `${ADMIN_BASE}/categories`,
        icon: ListIcon,
      },
      {
        title: "Brands",
        url: `${ADMIN_BASE}/brands`,
        icon: TagIcon,
      },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        title: "Orders",
        url: `${ADMIN_BASE}/orders`,
        icon: ShoppingCartIcon,
      },
      {
        title: "Invoices",
        url: `${ADMIN_BASE}/invoices`,
        icon: ReceiptIcon,
      },
      {
        title: "Estimates",
        url: `${ADMIN_BASE}/estimates`,
        icon: FileTextIcon,
      },
      {
        title: "Customers",
        url: `${ADMIN_BASE}/customers`,
        icon: ContactIcon,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        title: "Delivery",
        url: `${ADMIN_BASE}/delivery`,
        icon: TruckIcon,
      },
      {
        title: "Delivery rules",
        url: `${ADMIN_BASE}/delivery-rules`,
        icon: TruckIcon,
      },
      {
        title: "Returns",
        url: `${ADMIN_BASE}/returns`,
        icon: Undo2Icon,
      },
    ],
  },
  {
    label: "Customer Service",
    items: [
      {
        title: "Item Requests",
        url: `${ADMIN_BASE}/item-requests`,
        icon: ClipboardListIcon,
      },
      {
        title: "Support Tickets",
        url: `${ADMIN_BASE}/tickets`,
        icon: HeadphonesIcon,
      },
      {
        title: "Announcements",
        url: `${ADMIN_BASE}/announcements`,
        icon: MegaphoneIcon,
      },
      {
        title: "Brand Updates",
        url: `${ADMIN_BASE}/brand-updates`,
        icon: TagIcon,
      },
    ],
  },
  {
    label: "Employee Management",
    items: [
      {
        title: "Salesmen",
        url: `${ADMIN_BASE}/salesmen`,
        icon: Users2Icon,
      },
      {
        title: "Deliverymen",
        url: `${ADMIN_BASE}/deliverymen`,
        icon: TruckIcon,
      },
    ],
  },
  {
    label: "Reports & Analytics",
    items: [
      {
        title: "Sales Reports",
        url: `${ADMIN_BASE}/sales-reports`,
        icon: DollarSignIcon,
      },
      {
        title: "Employee Performance",
        url: `${ADMIN_BASE}/employee-performance`,
        icon: Users2Icon,
      },
    ],
  },
  {
    label: "Audit Management",
    items: [
      {
        title: "System Activity",
        url: `${ADMIN_BASE}/audit`,
        icon: ActivityIcon,
      },
    ],
  },
];

export function AdminSidebar(props: React.ComponentProps<typeof Sidebar>) {
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
              <Link href="/">
                <p className="text-2xl font-bold">Bikalpo</p>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="mt-4 thin-scrollbar">
        <NavGrouped groups={adminNavGroups} />
      </SidebarContent>
      <SidebarFooter>
        {isPending || !data ? <UserNavSkeleton /> : <NavUser session={data} />}
      </SidebarFooter>
    </Sidebar>
  );
}
