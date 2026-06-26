"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { NavMain } from "@/components/dashboard/nav-main";
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
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
};

type BaseSidebarProps = React.ComponentProps<typeof Sidebar> & {
  navItems: NavItem[];
};

export function BaseSidebar({ navItems, ...props }: BaseSidebarProps) {
  const { data, isPending } = authClient.useSession();

  const { data: warehouseDetails } = useQuery({
    ...orpc.deliveryman.getAssignedWarehouse.queryOptions({}),
    enabled: (data?.user as any)?.role === "deliveryman",
  });

  const warehouseName =
    (data?.user as any)?.warehouseName ||
    warehouseDetails?.warehouseName ||
    warehouseDetails?.name;

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5! h-auto py-2!"
            >
              <Link href="/">
                {warehouseName ? (
                  <div className="flex flex-col items-start gap-1 leading-none">
                    <span className="text-lg font-bold text-sidebar-foreground">
                      {warehouseName}
                    </span>
                    <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary ring-1 ring-inset ring-primary/20">
                      Bikalpo
                    </span>
                  </div>
                ) : (
                  <p className={"text-2xl font-bold"}>Bikalpo</p>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        {isPending || !data ? <UserNavSkeleton /> : <NavUser session={data as any} />}
      </SidebarFooter>
    </Sidebar>
  );
}
