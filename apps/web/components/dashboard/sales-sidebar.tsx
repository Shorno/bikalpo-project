"use client";

import {
  FileTextIcon,
  LayoutDashboardIcon,
  Package,
  Users,
} from "lucide-react";
import { BaseSidebar, type NavItem } from "@/components/dashboard/base-sidebar";
import type { Sidebar } from "@/components/ui/sidebar";
import { SALES_BASE } from "@/lib/routes";

const salesNavLinks: NavItem[] = [
  {
    title: "Dashboard",
    url: SALES_BASE,
    icon: LayoutDashboardIcon,
  },
  {
    title: "Customers",
    url: `${SALES_BASE}/customers`,
    icon: Users,
  },
  {
    title: "Estimates",
    url: `${SALES_BASE}/estimates`,
    icon: FileTextIcon,
  },
  {
    title: "Orders",
    url: `${SALES_BASE}/orders`,
    icon: Package,
  },
];

export function SalesSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return <BaseSidebar navItems={salesNavLinks} {...props} />;
}
