"use client";

import { BikeIcon, LayoutDashboardIcon, RotateCcw } from "lucide-react";
import { BaseSidebar, type NavItem } from "@/components/dashboard/base-sidebar";
import type { Sidebar } from "@/components/ui/sidebar";
import { DELIVERY_BASE } from "@/lib/routes";

const deliveryNavLinks: NavItem[] = [
  {
    title: "Dashboard",
    url: DELIVERY_BASE,
    icon: LayoutDashboardIcon,
  },
  {
    title: "Deliveries",
    url: `${DELIVERY_BASE}/deliveries`,
    icon: BikeIcon,
  },
  {
    title: "Return History",
    url: `${DELIVERY_BASE}/returns`,
    icon: RotateCcw,
  },
];

export function DeliverySidebar(props: React.ComponentProps<typeof Sidebar>) {
  return <BaseSidebar navItems={deliveryNavLinks} {...props} />;
}
