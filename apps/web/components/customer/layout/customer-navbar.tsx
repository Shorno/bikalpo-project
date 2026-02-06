"use client";

import Image from "next/image";
import Link from "next/link";
import {
  MobileOrderStatus,
  OrderStatusButton,
} from "@/components/customer/layout/order-status-badge";
import SearchInput from "@/components/features/home/search/search-input";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { UserDropdown } from "@/components/layout/user-dropdown";
import { useIsMobile } from "@/hooks/use-mobile";

export function CustomerNavbar() {
  const isMobile = useIsMobile();

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="border-b">
        <div className="container mx-auto">
          <div className="relative flex h-16 items-center justify-between gap-4 px-4">
            <div className="flex items-center gap-2 z-10">
              <MobileMenu />
              <Link href="/" className="flex items-center shrink-0">
                <Image
                  src={"/logos/site-logo-white.svg"}
                  alt="Logo"
                  width={isMobile ? 100 : 120}
                  height={isMobile ? 100 : 120}
                />
              </Link>
            </div>

            {/* Absolutely centered search bar */}
            <div className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl px-4">
              <SearchInput className="w-full" />
            </div>

            <div className="flex items-center gap-1 sm:gap-2 shrink-0 z-10">
              {/* Mobile: Compact status badge inside navbar */}
              <MobileOrderStatus />
              {/* Desktop: Full status button */}
              <OrderStatusButton />
              <UserDropdown />
            </div>
          </div>
        </div>
      </div>

      <div className="md:hidden px-4 py-2 border-b bg-gray-50">
        <SearchInput className="w-full" />
      </div>
    </nav>
  );
}
