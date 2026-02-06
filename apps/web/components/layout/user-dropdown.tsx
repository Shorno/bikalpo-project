"use client";

import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  Receipt,
  UserCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
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

const DASHBOARD_PATHS: Record<string, string> = {
  admin: "/dashboard/admin",
  salesman: "/dashboard/sales",
  deliveryman: "/dashboard/delivery",
};

const STAFF_ROLES = ["admin", "salesman", "deliveryman"];

export function UserDropdown() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [isMounted, setIsMounted] = React.useState(false);

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
    return (
      <Button asChild>
        <Link href="/login">Login</Link>
      </Button>
    );
  }

  const user = session.user;
  const userRole = user.role || "guest";
  const isStaff = STAFF_ROLES.includes(userRole);
  const dashboardPath = DASHBOARD_PATHS[userRole] || "/dashboard";

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
          router.push("/");
          router.refresh();
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
          // Staff roles (admin, salesman, deliveryman) - only show dashboard
          <DropdownMenuItem asChild>
            <Link href={dashboardPath} className="cursor-pointer">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </DropdownMenuItem>
        ) : userRole === "guest" ? (
          // Guest role - pending approval
          <DropdownMenuItem asChild>
            <Link href="/pending-approval" className="cursor-pointer">
              <UserCircle className="mr-2 h-4 w-4" />
              Pending Approval
            </Link>
          </DropdownMenuItem>
        ) : (
          // Customer role - show all account navigation links
          <>
            <DropdownMenuItem asChild>
              <Link href="/customer/account" className="cursor-pointer">
                <UserCircle className="mr-2 h-4 w-4" />
                My Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/customer/account/orders" className="cursor-pointer">
                <Package className="mr-2 h-4 w-4" />
                Orders
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/customer/account/estimates"
                className="cursor-pointer"
              >
                <Receipt className="mr-2 h-4 w-4" />
                Estimates
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/customer/account/payments"
                className="cursor-pointer"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Payments
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/customer/account/addresses"
                className="cursor-pointer"
              >
                <MapPin className="mr-2 h-4 w-4" />
                Addresses
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
