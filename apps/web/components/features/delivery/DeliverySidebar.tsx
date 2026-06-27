"use client";

import {
  BikeIcon,
  LayoutDashboardIcon,
  RotateCcw,
  UserIcon,
} from "lucide-react";
import { BaseSidebar, type NavItem } from "@/components/dashboard/base-sidebar";
import type { Sidebar } from "@/components/ui/sidebar";
import { DELIVERY_PORTAL_BASE } from "@/lib/delivery-routing";

export function DeliverySidebar(props: React.ComponentProps<typeof Sidebar>) {
  const deliveryNavLinks: NavItem[] = [
    {
      title: "Dashboard",
      url: DELIVERY_PORTAL_BASE,
      icon: LayoutDashboardIcon,
    },
    {
      title: "Deliveries",
      url: `${DELIVERY_PORTAL_BASE}/deliveries`,
      icon: BikeIcon,
    },
    {
      title: "Return History",
      url: `${DELIVERY_PORTAL_BASE}/returns`,
      icon: RotateCcw,
    },
    {
      title: "Profile",
      url: `${DELIVERY_PORTAL_BASE}/profile`,
      icon: UserIcon,
    },
  ];

  return <BaseSidebar navItems={deliveryNavLinks} {...props} />;
}
