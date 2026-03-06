"use client";
import Image from "next/image";
import Link from "next/link";
import SearchInput from "@/components/features/home/search/search-input";
import { useIsMobile } from "@/hooks/use-mobile";
import { CartButton } from "./cart-button";
import { MobileMenu } from "./mobile-menu";
import { UserDropdown } from "./user-dropdown";
import { authClient } from "@/lib/auth-client";

export function Navbar() {
  const isMobile = useIsMobile();
  const { data } = authClient.useSession()

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="border-b">
        <div className="container mx-auto">
          <div className="flex h-16 items-center gap-4 px-4">
            <div className="flex items-center gap-2 shrink-0">
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

            {/* Navigation links */}
            <div className="hidden md:flex items-center gap-4 shrink-0">
              <Link href="/store" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                Shops
              </Link>
            </div>

            {/* Search bar - takes remaining space */}
            <div className="hidden md:block flex-1 max-w-xl mx-auto">
              <SearchInput className="w-full" variant="public" />
            </div>

            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <CartButton />
              <UserDropdown />
            </div>
          </div>
        </div>
      </div>

      <div className="md:hidden px-4 py-2 border-b bg-gray-50">
        <SearchInput className="w-full" variant="public" />
      </div>
    </nav>
  );
}
