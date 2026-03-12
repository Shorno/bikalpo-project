"use client";
import { Phone, Smartphone, Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import SearchInput from "@/components/features/home/search/search-input";
import { useIsMobile } from "@/hooks/use-mobile";
import { CartButton } from "./cart-button";
import { MobileMenu } from "./mobile-menu";
import { UserDropdown } from "./user-dropdown";
import { authClient } from "@/lib/auth-client";
import { EnhancedCategoryDropdown } from "./enhanced-category-dropdown";

const topNavLinks = [
  { label: "Ramadan Special", href: "/products?tag=ramadan" },
  { label: "Great Deals", href: "/products?sort=discount" },
  { label: "Buy & Save More", href: "/products?tag=bundle" },
  { label: "Our Brands", href: "/products?view=brands" },
];

export function Navbar() {
  const isMobile = useIsMobile();
  const { data: session } = authClient.useSession();

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-md">
      {/* Main header row */}
      <div className="bg-primary">
        <div className="container mx-auto">
          <div className="flex h-16 items-center gap-3 px-4">
            {/* Mobile menu + Logo */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="md:hidden">
                <MobileMenu />
              </div>
              <Link href="/" className="flex items-center shrink-0">
                <Image
                  src={"/logos/site-logo-white.svg"}
                  alt="Bikalpo"
                  width={isMobile ? 90 : 110}
                  height={40}
                  priority
                  className="object-contain"
                />
              </Link>
            </div>

            {/* Search bar */}
            <div className="flex-1 max-w-2xl mx-2 hidden md:block">
              <SearchInput
                className="w-full [&_input]:bg-white [&_input]:rounded-none [&_.input-group]:rounded-sm"
                variant="public"
              />
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0">
              {/* App download - hidden on mobile */}
              <Button
                variant="ghost"
                size="sm"
                className="hidden lg:flex items-center gap-1.5 text-white hover:bg-primary-foreground/10 hover:text-white border border-white/40 text-xs px-3"
                asChild
              >
                <Link href="#">
                  <Smartphone className="size-4" />
                  Download App
                </Link>
              </Button>

              {/* Cart */}
              <div className="text-white [&_button]:text-white [&_button:hover]:bg-primary-foreground/10 [&_button:hover]:text-white [&_.absolute]:bg-white [&_.absolute]:text-primary">
                <CartButton />
              </div>

              {/* Auth */}
              <div className="[&_button]:bg-white [&_button]:text-primary [&_button:hover]:bg-white/90 [&_a]:bg-white [&_a]:text-primary [&_a:hover]:bg-white/90">
                <UserDropdown />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile search row */}
      <div className="md:hidden px-4 py-2 border-b bg-gray-50">
        <SearchInput className="w-full" variant="public" />
      </div>

      {/* Category navigation row */}
      <div className="hidden md:block bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center h-10">
            {/* Enhanced Shop by Category */}
            <EnhancedCategoryDropdown />

            <Separator orientation="vertical" className="h-6 mx-1" />

            {/* Top nav links */}
            <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
              {topNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-2 text-xs font-medium text-gray-700 hover:text-primary whitespace-nowrap transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right side info */}
            <div className="ml-auto flex items-center gap-3 shrink-0">
              <Link
                href="/store"
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-primary"
              >
                <Store className="size-3.5" />
                Our outlets
              </Link>
              <Link
                href="/contact"
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-primary"
              >
                <Phone className="size-3.5" />
                Help line
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
