"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";

export type NavItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: number;
  activePrefixes?: string[];
  defaultOpen?: boolean;
  items?: { title: string; url: string; badge?: number; icon?: LucideIcon }[];
};

export type NavGroup = {
  label: string;
  hideLabel?: boolean;
  items: NavItem[];
};

function isNavItemActive(pathname: string, item: NavItem) {
  if (pathname === item.url) return true;
  return (
    item.activePrefixes?.some((prefix) => pathname.startsWith(prefix)) ?? false
  );
}

function NavBadge({ count }: { count?: number }) {
  if (!count || count <= 0) return null;
  return (
    <Badge className="ml-auto h-5 min-w-5 justify-center bg-amber-100 px-1.5 text-[10px] text-amber-800 hover:bg-amber-100">
      {count > 99 ? "99+" : count}
    </Badge>
  );
}

export function NavGrouped({ groups }: { groups: NavGroup[] }) {
  const { setOpenMobile } = useSidebar();
  const pathname = usePathname();

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          {!group.hideLabel && (
            <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">
              {group.label}
            </SidebarGroupLabel>
          )}
          <SidebarMenu>
            {group.items.map((item) => {
              // Items with sub-items → collapsible
              if (item.items && item.items.length > 0) {
                const isChildActive = item.items.some(
                  (sub) => pathname === sub.url,
                );
                const isParentActive = isNavItemActive(pathname, item);

                return (
                  <Collapsible
                    key={item.title}
                    asChild
                    defaultOpen={
                      item.defaultOpen || isChildActive || isParentActive
                    }
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={isParentActive || isChildActive}
                          className="flex items-center gap-3 px-3 h-10 text-sm font-medium"
                        >
                          {item.icon && <item.icon size={18} />}
                          <span>{item.title}</span>
                          <NavBadge count={item.badge} />
                          <ChevronRight className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items.map((sub) => {
                            const isSubActive = pathname === sub.url;
                            return (
                              <SidebarMenuSubItem key={sub.title}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={isSubActive}
                                >
                                  <Link
                                    href={sub.url}
                                    onClick={() => setOpenMobile(false)}
                                  >
                                    {sub.icon && <sub.icon size={16} />}
                                    <span>{sub.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              }

              // Simple items → direct link (no sub-items)
              const isActive = isNavItemActive(pathname, item);
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    asChild
                    onClick={() => setOpenMobile(false)}
                    isActive={isActive}
                    className="flex items-center gap-3 px-3 h-10 text-sm font-medium"
                  >
                    <Link href={item.url}>
                      {item.icon && <item.icon size={18} />}
                      <span>{item.title}</span>
                      <NavBadge count={item.badge} />
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  );
}
