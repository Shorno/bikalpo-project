"use client";

import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  Receipt,
  Store,
  UserCircle,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { useLoginRequired } from "@/components/features/auth/login-required-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { redirectToRootLogin } from "@/lib/auth-routing";
import { getSalesSubdomainUrl } from "@/lib/sales-routing";

const DASHBOARD_PATHS: Record<string, string> = {
  admin: "/dashboard/admin",
  deliveryman: "/dashboard",
};

const STAFF_ROLES = ["admin", "salesman", "deliveryman"];

export function UserDropdown() {
  const { data: session, isPending } = authClient.useSession();
  const [isMounted, setIsMounted] = React.useState(false);
  const { showLoginModal } = useLoginRequired();
  const pathname = usePathname();

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // During SSR and initial render, show a consistent placeholder to prevent hydration mismatch
  if (!isMounted || isPending) {
    return (
      <Avatar className={"h-10 w-10"}>
        <AvatarFallback>U</AvatarFallback>
      </Avatar>
    );
  }

  if (!session) {
    if (pathname === "/login" || pathname === "/b2b/login") {
      return null;
    }

    return <Button onClick={showLoginModal}>Login</Button>;
  }

  const user = session.user;
  const userRole = user.role || "consumer";
  const isStaff = STAFF_ROLES.includes(userRole);
  const isSeller = userRole === "shop_owner" && user.isSeller;
  const dashboardPath =
    userRole === "salesman"
      ? `${getSalesSubdomainUrl()}/dashboard`
      : DASHBOARD_PATHS[userRole] || "/dashboard";

  // Shop owner dashboard – if already on shop/b2b subdomain, just use relative path
  const isOnShopSubdomain =
    typeof window !== "undefined" &&
    (window.location.host.startsWith("shop.") ||
      window.location.host.startsWith("b2b."));
  const shopDashboardUrl = isOnShopSubdomain
    ? "/dashboard"
    : process.env.NEXT_PUBLIC_SHOP_SUBDOMAIN_URL
      ? `${process.env.NEXT_PUBLIC_SHOP_SUBDOMAIN_URL}/dashboard`
      : `${window.location.protocol}//shop.${window.location.host}/dashboard`;

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const handleLogout = async () => {
    // Cart will be cleared automatically by the CartProvider when the session changes
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          redirectToRootLogin();
        },
      },
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={user.image || undefined}
              alt={user.name || "User"}
            />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isStaff ? (
          // Staff roles (admin, salesman, deliveryman) - show dashboard
          <DropdownMenuItem asChild>
            <Link href={dashboardPath} className="cursor-pointer">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </DropdownMenuItem>
        ) : isSeller ? (
          // Shop owner who is a seller - show shop dashboard + account links
          <>
            <DropdownMenuItem asChild>
              <a href={shopDashboardUrl} className="cursor-pointer">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Shop Dashboard
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/shop/account" className="cursor-pointer">
                <UserCircle className="mr-2 h-4 w-4" />
                My Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/shop/account/orders" className="cursor-pointer">
                <Package className="mr-2 h-4 w-4" />
                Orders
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/shop/account/estimates" className="cursor-pointer">
                <Receipt className="mr-2 h-4 w-4" />
                Estimates
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/shop/account/payments" className="cursor-pointer">
                <CreditCard className="mr-2 h-4 w-4" />
                Payments
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : (
          // Consumer role - show account navigation + become a seller link
          <>
            <DropdownMenuItem asChild>
              <Link href="/account" className="cursor-pointer">
                <UserCircle className="mr-2 h-4 w-4" />
                My Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/account/orders" className="cursor-pointer">
                <Package className="mr-2 h-4 w-4" />
                Orders
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/account/estimates" className="cursor-pointer">
                <Receipt className="mr-2 h-4 w-4" />
                Estimates
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/account/payments" className="cursor-pointer">
                <CreditCard className="mr-2 h-4 w-4" />
                Payments
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/account/addresses" className="cursor-pointer">
                <MapPin className="mr-2 h-4 w-4" />
                Addresses
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/b2b/register" className="cursor-pointer">
                <Store className="mr-2 h-4 w-4" />
                Become a Seller
              </Link>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-red-600"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
