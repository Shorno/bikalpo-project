"use client";

import {
  BarChart3,
  ChevronDown,
  FileText,
  Home,
  Package,
  RotateCcw,
  Truck,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface EmployeeSidebarProps {
  userRole: string | null;
  userName: string;
  userEmail: string;
}

export function EmployeeSidebar({
  userRole,
  userName,
  userEmail,
}: EmployeeSidebarProps) {
  const pathname = usePathname();

  const salesmanNavItems = [
    {
      title: "Dashboard",
      href: "/employee",
      icon: Home,
    },
    {
      title: "Salesman Hub",
      href: "/employee/salesman",
      icon: BarChart3,
    },
    {
      title: "Estimates",
      href: "/employee/estimates",
      icon: FileText,
    },
    {
      title: "Returns",
      href: "/employee/returns",
      icon: RotateCcw,
    },
  ];

  const deliverymanNavItems = [
    {
      title: "Dashboard",
      href: "/employee",
      icon: Home,
    },
    {
      title: "Deliveries",
      href: "/employee/delivery",
      icon: Truck,
    },
    {
      title: "Returns",
      href: "/employee/returns",
      icon: RotateCcw,
    },
  ];

  const navItems =
    userRole === "salesman" ? salesmanNavItems : deliverymanNavItems;

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/employee">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Package className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Bikalpo</span>
                  <span className="truncate text-xs capitalize">
                    {userRole || "Employee"} Portal
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/")
                    }
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-muted">
                <User className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{userName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {userEmail}
                </span>
              </div>
              <ChevronDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
