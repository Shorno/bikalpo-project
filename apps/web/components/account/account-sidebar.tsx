"use client";

import {
  Check,
  FileQuestion,
  FileText,
  Headphones,
  LayoutDashboard,
  Lock,
  LogOut,
  MapPin,
  Package,
  ShoppingCart,
  Truck,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCart } from "@/actions/cart/cart-actions";
import { getCustomerItemRequests } from "@/actions/item-request/get-item-requests";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const sidebarItems = [
  {
    label: "Dashboard",
    href: "/account",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Profile",
    href: "/account/profile",
    icon: User,
  },
  {
    label: "My Orders History",
    href: "/account/orders",
    icon: Package,
  },
  {
    label: "Track Order",
    href: "/account/track",
    icon: Truck,
  },
  {
    label: "Estimates",
    href: "/account/estimates",
    icon: FileText,
  },
  {
    label: "Addresses",
    href: "/account/addresses",
    icon: MapPin,
  },
  {
    label: "My Request Item",
    href: "/account/requests",
    icon: FileQuestion,
    badgeKey: "requests",
  },
  {
    label: "My Cart",
    href: "/checkout",
    icon: ShoppingCart,
    badgeKey: "cart",
  },
  {
    label: "Security",
    href: "/account/security",
    icon: Lock,
  },
];

const bottomItems = [
  {
    label: "Customer support",
    href: "/account/support",
    icon: Headphones,
  },
];

export function AccountSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [counts, setCounts] = useState<{ cart: number; requests: number }>({
    cart: 0,
    requests: 0,
  });

  useEffect(() => {
    const fetchCounts = async () => {
      const [cartRes, requestRes] = await Promise.all([
        getCart(),
        getCustomerItemRequests({ limit: 1 } as any),
      ]);

      setCounts({
        cart: cartRes.totalItems || 0,
        requests: requestRes.success
          ? requestRes.data?.pagination.totalCount || 0
          : 0,
      });
    };

    fetchCounts();
  }, []);

  const handleLogout = async () => {
    // Cart will be cleared automatically when session changes
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/");
        },
      },
    });
  };

  return (
    <aside className="w-full lg:w-64 shrink-0 py-0">
      <nav className="bg-white rounded-lg border border-gray-100 overflow-hidden">
        <div className="flex flex-col divide-y divide-gray-100">
          {/* Dashboard/Top Items */}
          {sidebarItems.map((item) => {
            const isActive =
              "exact" in item && item.exact
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            const badgeCount = item.badgeKey
              ? counts[item.badgeKey as keyof typeof counts]
              : 0;

            return (
              <Button
                key={item.href}
                variant="ghost"
                className={cn(
                  "justify-start gap-3 h-12 rounded-none px-4 transition-colors",
                  isActive
                    ? "bg-emerald-50 text-emerald-600 font-medium"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                )}
                asChild
              >
                <Link href={item.href}>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <Icon
                        className={cn(
                          "h-5 w-5",
                          isActive ? "text-emerald-500" : "text-[#7B8B9A]",
                        )}
                      />
                      <span className="text-[15px]">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {badgeCount > 0 && (
                        <span
                          className={cn(
                            "flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full text-[11px] font-bold",
                            item.badgeKey === "requests"
                              ? "bg-emerald-600 text-white"
                              : "bg-emerald-50 text-emerald-600",
                          )}
                        >
                          {badgeCount}
                        </span>
                      )}
                      {isActive && (
                        <Check className="h-4 w-4 text-emerald-500" />
                      )}
                    </div>
                  </div>
                </Link>
              </Button>
            );
          })}

          {/* Bottom Items */}
          {bottomItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.href}
                variant="ghost"
                className="justify-start gap-3 h-12 rounded-none px-4 text-gray-600 hover:bg-gray-50 flex"
                asChild
              >
                <Link href={item.href}>
                  <Icon className="h-5 w-5 text-[#7B8B9A]" />
                  <span className="text-[15px]">{item.label}</span>
                </Link>
              </Button>
            );
          })}

          {/* Logout Button */}
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="justify-start gap-3 h-12 rounded-none px-4 text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-[15px]">Logout</span>
          </Button>
        </div>
      </nav>
    </aside>
  );
}
