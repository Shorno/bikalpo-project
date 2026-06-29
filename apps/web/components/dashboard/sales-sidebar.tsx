"use client";

import {
  LayoutDashboardIcon,
} from "lucide-react";
import { BaseSidebar, type NavItem } from "@/components/dashboard/base-sidebar";
import type { Sidebar } from "@/components/ui/sidebar";
import { SALES_PORTAL_BASE } from "@/lib/sales-routing";

const salesNavLinks: NavItem[] = [
  {
    title: "Dashboard",
    url: SALES_PORTAL_BASE,
    icon: LayoutDashboardIcon,
  },
];

export function SalesSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return <BaseSidebar navItems={salesNavLinks} {...props} />;
}
