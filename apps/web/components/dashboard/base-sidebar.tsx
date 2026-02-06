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
import { authClient } from "@/lib/auth-client";

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
                <p className={"text-2xl font-bold"}>Bikalpo</p>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        {isPending || !data ? <UserNavSkeleton /> : <NavUser session={data} />}
      </SidebarFooter>
    </Sidebar>
  );
}
