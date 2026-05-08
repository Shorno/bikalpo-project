"use client";

import {
  ActivityIcon,
  Boxes,
  ClipboardListIcon,
  ContactIcon,
  DollarSignIcon,
  GiftIcon,
  HeadphonesIcon,
  ImageIcon,
  LayoutDashboardIcon,
  ListIcon,
  MapPinIcon,
  MegaphoneIcon,
  PackageIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  StoreIcon,
  TruckIcon,
  Undo2Icon,
  Users2Icon,
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
        title: "Product Catalog",
        url: `${ADMIN_BASE}/products`,
        icon: PackageIcon,
        items: [
          { title: "All Products", url: `${ADMIN_BASE}/products` },
          {
            title: "Consumer Products",
            url: `${ADMIN_BASE}/consumer-products`,
          },
          { title: "Web View", url: `${ADMIN_BASE}/web-view` },
          { title: "Stock / Inventory", url: `${ADMIN_BASE}/stock` },
        ],
      },
      {
        title: "Product Management",
        url: `${ADMIN_BASE}/types`,
        icon: Boxes,
        items: [
          { title: "Types", url: `${ADMIN_BASE}/types` },
          { title: "Categories", url: `${ADMIN_BASE}/categories` },
          { title: "Sub Categories", url: `${ADMIN_BASE}/subcategories` },
          { title: "Setup Requests", url: `${ADMIN_BASE}/setup-requests` },
          { title: "Core Products", url: `${ADMIN_BASE}/core-products` },
          { title: "Variants", url: `${ADMIN_BASE}/variant-options` },
          { title: "Brands", url: `${ADMIN_BASE}/brands` },
        ],
      },
      {
        title: "Customer Home Tabs",
        url: `${ADMIN_BASE}/customer-home-tabs`,
        icon: ListIcon,
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
        items: [
          { title: "All Invoices", url: `${ADMIN_BASE}/invoices` },
          { title: "Estimates", url: `${ADMIN_BASE}/estimates` },
        ],
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
        title: "Areas",
        url: `${ADMIN_BASE}/areas`,
        icon: MapPinIcon,
        items: [
          { title: "All Areas", url: `${ADMIN_BASE}/areas` },
          { title: "Area Analytics", url: `${ADMIN_BASE}/area-analytics` },
        ],
      },
      {
        title: "Delivery",
        url: `${ADMIN_BASE}/delivery`,
        icon: TruckIcon,
        items: [
          { title: "Deliveries", url: `${ADMIN_BASE}/delivery` },
          { title: "Delivery Rules", url: `${ADMIN_BASE}/delivery-rules` },
        ],
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
        title: "Support & Complaints",
        url: `${ADMIN_BASE}/tickets`,
        icon: HeadphonesIcon,
        items: [
          { title: "Support Tickets", url: `${ADMIN_BASE}/tickets` },
          { title: "Complaints", url: `${ADMIN_BASE}/complaints` },
        ],
      },
      {
        title: "Announcements",
        url: `${ADMIN_BASE}/announcements`,
        icon: MegaphoneIcon,
        items: [
          { title: "Announcements", url: `${ADMIN_BASE}/announcements` },
          { title: "Brand Updates", url: `${ADMIN_BASE}/brand-updates` },
        ],
      },
      {
        title: "To-Let Listings",
        url: `${ADMIN_BASE}/to-let`,
        icon: StoreIcon,
      },
      {
        title: "Offers",
        url: `${ADMIN_BASE}/offers`,
        icon: GiftIcon,
      },
    ],
  },
  {
    label: "People Management",
    items: [
      {
        title: "Users",
        url: `${ADMIN_BASE}/users/wholesalers`,
        icon: Users2Icon,
        items: [
          { title: "Wholesalers", url: `${ADMIN_BASE}/users/wholesalers` },
          { title: "Retailers", url: `${ADMIN_BASE}/users/retailers` },
        ],
      },
      {
        title: "Applications",
        url: `${ADMIN_BASE}/seller-applications`,
        icon: StoreIcon,
        items: [
          {
            title: "Seller Applications",
            url: `${ADMIN_BASE}/seller-applications`,
          },
          {
            title: "Warehouse Applications",
            url: `${ADMIN_BASE}/warehouse-applications`,
          },
        ],
      },
      {
        title: "Assignments",
        url: `${ADMIN_BASE}/warehouse-assignments`,
        icon: WarehouseIcon,
        items: [
          {
            title: "Warehouse Assignments",
            url: `${ADMIN_BASE}/warehouse-assignments`,
          },
          {
            title: "Shop Category Assignments",
            url: `${ADMIN_BASE}/shop-category-assignments`,
          },
        ],
      },
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
    label: "Marketing",
    items: [
      {
        title: "Marketing",
        url: `${ADMIN_BASE}/marketing`,
        icon: ImageIcon,
        items: [
          { title: "Material Requests", url: `${ADMIN_BASE}/marketing` },
          {
            title: "Materials & Designs",
            url: `${ADMIN_BASE}/marketing/materials`,
          },
        ],
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
  {
    label: "Landing Page",
    items: [
      {
        title: "Packages",
        url: `${ADMIN_BASE}/packages`,
        icon: PackageIcon,
      },
    ],
  },
  {
    label: "Referral & Rewards",
    items: [
      {
        title: "Referral & Rewards",
        url: `${ADMIN_BASE}/invite-tracking`,
        icon: GiftIcon,
        items: [
          { title: "Invite Tracking", url: `${ADMIN_BASE}/invite-tracking` },
          { title: "Admin Invites", url: `${ADMIN_BASE}/admin-invites` },
          { title: "Rewards", url: `${ADMIN_BASE}/rewards` },
        ],
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
        {isPending || !data ? (
          <UserNavSkeleton />
        ) : (
          <NavUser session={data as any} />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
