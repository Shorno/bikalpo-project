"use client";

import {
  Bell,
  CalendarCheck,
  ChevronDown,
  KeyRound,
  LogOut,
  Menu,
  Store,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  type AccountAudience,
  type AccountNavigationItem,
  createPropertyNavigationItems,
  getAccountNavigation,
} from "@/components/account/account-navigation";
import { Button } from "@/components/ui/button";
import { useToLetPropertyNavigation } from "@/hooks/use-to-let-property-api";
import { useToLetAlertNotifications } from "@/hooks/use-to-let-rental-api";
import { authClient } from "@/lib/auth-client";
import { redirectToRootLogin } from "@/lib/auth-routing";
import { cn } from "@/lib/utils";

export type AccountSidebarProps = {
  displayName: string;
  audience: AccountAudience;
};

export function AccountSidebar({ displayName, audience }: AccountSidebarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isAlertPath = pathname.startsWith("/account/to-let/alerts");
  const isBookingPath =
    pathname === "/account/to-let" ||
    pathname.startsWith("/account/to-let/bookings/");
  const isToLetPath = isAlertPath || isBookingPath;
  const [toLetOpen, setToLetOpen] = useState(isToLetPath);
  const propertyNavigation = useToLetPropertyNavigation();
  const alertNotifications = useToLetAlertNotifications(propertyNavigation.isConsumer);
  const unreadAlerts = alertNotifications.data?.unreadCount ?? 0;

  useEffect(() => {
    if (isToLetPath) setToLetOpen(true);
  }, [isToLetPath]);

  const sections = useMemo(() => {
    const nextSections = getAccountNavigation(audience);
    const rentalsSection = nextSections.find(
      (section) => section.id === "rentals",
    );

    if (rentalsSection && propertyNavigation.isConsumer) {
      rentalsSection.items.push(
        ...createPropertyNavigationItems(propertyNavigation),
      );
    }

    return nextSections;
  }, [audience, propertyNavigation]);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      await authClient.signOut({
        fetchOptions: { onSuccess: () => redirectToRootLogin() },
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const renderNavigationItem = (item: AccountNavigationItem) => {
    const isActive = item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        onClick={() => setMobileMenuOpen(false)}
        className={cn(
          "flex min-h-11 items-center gap-2.5 rounded-md px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
          isActive
            ? "bg-primary/10 font-medium text-primary"
            : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950",
        )}
      >
        <Icon
          className={cn(
            "size-4 shrink-0",
            isActive ? "text-primary" : "text-zinc-400",
          )}
          aria-hidden="true"
        />
        <span>{item.label}</span>
      </Link>
    );
  };

  const renderToLetChild = ({
    label,
    href,
    icon: Icon,
    isActive,
  }: {
    label: string;
    href: string;
    icon: typeof Bell;
    isActive: boolean;
  }) => (
    <Link
      key={href}
      href={href}
      aria-current={isActive ? "page" : undefined}
      onClick={() => setMobileMenuOpen(false)}
      className={cn(
        "flex min-h-10 items-center gap-2.5 rounded-md px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
        isActive
          ? "bg-primary/10 font-medium text-primary"
          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          isActive ? "text-primary" : "text-zinc-400",
        )}
        aria-hidden="true"
      />
      <span>{label}</span>
      {href === "/account/to-let/alerts" && unreadAlerts > 0 ? (
        <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold tabular-nums text-primary-foreground" aria-label={`${unreadAlerts} unread alerts`}>
          {unreadAlerts > 99 ? "99+" : unreadAlerts}
        </span>
      ) : null}
    </Link>
  );

  return (
    <aside className="w-full lg:sticky lg:top-24">
      <Button
        type="button"
        variant="outline"
        className="mb-3 flex min-h-11 w-full items-center justify-between rounded-lg border-zinc-200 bg-white px-4 text-zinc-900 lg:hidden"
        aria-expanded={mobileMenuOpen}
        aria-controls="account-navigation"
        onClick={() => setMobileMenuOpen((open) => !open)}
      >
        <span className="inline-flex items-center gap-2">
          <Menu className="size-4" aria-hidden="true" />
          Account menu
        </span>
        <ChevronDown
          className={cn(
            "size-4 transition-transform duration-200",
            mobileMenuOpen && "rotate-180",
          )}
          aria-hidden="true"
        />
      </Button>

      <nav
        id="account-navigation"
        aria-label="Account navigation"
        className={cn(
          "overflow-hidden rounded-lg border border-zinc-200 bg-white",
          mobileMenuOpen ? "block" : "hidden",
          "lg:block",
        )}
      >
        <div className="border-b border-zinc-200 px-4 py-4">
          <p className="text-sm font-semibold text-zinc-950">
            Hello, {displayName}
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Manage your account and buying activity.
          </p>
        </div>

        <div className="space-y-5 px-3 py-4">
          {sections.map((section) => {
            const isRentalsSection = section.id === "rentals";
            const visibleItems = isRentalsSection
              ? section.items.filter((item) => item.href !== "/account/to-let")
              : section.items;

            return (
              <section key={section.id} aria-labelledby={`nav-${section.id}`}>
                <h2
                  id={`nav-${section.id}`}
                  className="px-2 text-[13px] font-semibold text-zinc-950"
                >
                  {section.label}
                </h2>
                <div className="mt-1.5 space-y-0.5">
                  {isRentalsSection && (
                    <div>
                      <button
                        type="button"
                        aria-expanded={toLetOpen}
                        aria-controls="to-let-account-links"
                        onClick={() => setToLetOpen((open) => !open)}
                        className={cn(
                          "flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                          isToLetPath
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950",
                        )}
                      >
                        <KeyRound
                          className={cn(
                            "size-4 shrink-0",
                            isToLetPath ? "text-primary" : "text-zinc-400",
                          )}
                          aria-hidden="true"
                        />
                        <span>To-Let</span>
                        {!toLetOpen && unreadAlerts > 0 ? (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold tabular-nums text-primary-foreground" aria-label={`${unreadAlerts} unread alerts`}>
                            {unreadAlerts > 99 ? "99+" : unreadAlerts}
                          </span>
                        ) : null}
                        <ChevronDown
                          className={cn(
                            "ml-auto size-4 transition-transform duration-200",
                            toLetOpen && "rotate-180",
                          )}
                          aria-hidden="true"
                        />
                      </button>

                      {toLetOpen && (
                        <div
                          id="to-let-account-links"
                          className="ml-4 mt-1 space-y-0.5 border-l border-zinc-200 pl-2"
                        >
                          {renderToLetChild({
                            label: "My Alert",
                            href: "/account/to-let/alerts",
                            icon: Bell,
                            isActive: isAlertPath,
                          })}
                          {renderToLetChild({
                            label: "My Bookings",
                            href: "/account/to-let",
                            icon: CalendarCheck,
                            isActive: isBookingPath,
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {visibleItems.map(renderNavigationItem)}
                </div>
              </section>
            );
          })}
        </div>

        <div className="border-t border-zinc-200 p-3">
          {audience === "consumer" && (
            <Link
              href="/b2b/register"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-11 items-center gap-2.5 rounded-md px-2 text-sm font-medium text-zinc-700 outline-none transition-colors hover:bg-zinc-50 hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            >
              <Store className="size-4 text-zinc-400" aria-hidden="true" />
              Sell on Bikalpo
            </Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            aria-busy={isLoggingOut}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 text-sm font-medium text-red-600 outline-none transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-1 disabled:cursor-wait disabled:opacity-60"
          >
            <LogOut className="size-4" aria-hidden="true" />
            {isLoggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      </nav>
    </aside>
  );
}
