"use client";
import {
  ChevronRight,
  Menu,
  Phone,
  Search,
  Smartphone,
  Store,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import SearchInput from "@/components/features/home/search/search-input";
import { useIsMobile } from "@/hooks/use-mobile";
import { useActiveCategories } from "@/hooks/use-customer-api";
import { CartButton } from "./cart-button";
import { MobileMenu } from "./mobile-menu";
import { UserDropdown } from "./user-dropdown";
import { authClient } from "@/lib/auth-client";

const topNavLinks = [
  { label: "RAMADAN SPECIAL", href: "/products?tag=ramadan" },
  { label: "GREAT DEALS", href: "/products?sort=discount" },
  { label: "BUY & SAVE MORE", href: "/products?tag=bundle" },
  { label: "OUR BRANDS", href: "/products?view=brands" },
];

export function Navbar() {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const { data: categoriesData } = useActiveCategories();
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);

  const isHomePage = pathname === "/";

  return (
    <nav className="sticky top-0 z-50 shadow-md">
      {/* ── Row 1: Main header (red/primary) ──────────────────── */}
      <div className="bg-primary">
        <div className="container mx-auto">
          <div className="flex h-16 items-center gap-4 px-4">
            {/* Mobile menu + Logo */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="md:hidden">
                <MobileMenu />
              </div>
              <Link href="/" className="flex items-center shrink-0">
                <Image
                  src={"/logos/site-logo-white.svg"}
                  alt="Bikalpo"
                  width={isMobile ? 90 : 120}
                  height={44}
                  priority
                  className="object-contain"
                />
              </Link>
            </div>

            {/* Search bar — large, prominent, with yellow button */}
            <div className="flex-1 max-w-2xl mx-4 hidden md:block">
              <SearchInput
                className="w-full [&_input]:bg-white [&_input]:rounded-none [&_input]:h-10 [&_input]:text-sm [&_input]:placeholder:text-gray-400 [&_.input-group]:rounded-sm [&_.input-group]:border-0 [&_.input-group]:h-10 [&_svg]:text-primary"
                variant="public"
              />
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0">
              {/* App download */}
              <Button
                variant="ghost"
                size="sm"
                className="hidden lg:flex items-center gap-1.5 text-white hover:bg-white/10 hover:text-white border border-white/30 text-xs px-3 h-8 rounded-sm font-medium"
                asChild
              >
                <Link href="#">
                  <Smartphone className="size-4" />
                  Download App
                </Link>
              </Button>

              {/* Cart */}
              <div className="text-white [&_button]:text-white [&_button:hover]:bg-white/10 [&_button:hover]:text-white [&_.absolute]:bg-white [&_.absolute]:text-primary">
                <CartButton />
              </div>

              {/* Auth */}
              <div className="[&_button]:bg-white [&_button]:text-primary [&_button]:font-semibold [&_button:hover]:bg-white/90 [&_a]:bg-white [&_a]:text-primary [&_a]:font-semibold [&_a:hover]:bg-white/90">
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

      {/* ── Row 2: Category nav bar (white bg, like Shwapno) ──── */}
      <div className="hidden md:block bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center h-10">
            {/* Shop by Category — text style with menu icon, not a button */}
            <div
              className="relative"
              onMouseEnter={() => {
                if (!isHomePage) setCategoryMenuOpen(true);
              }}
              onMouseLeave={() => setCategoryMenuOpen(false)}
            >
              <button className="flex items-center gap-2 h-10 px-3 text-gray-800 text-sm font-semibold shrink-0 hover:text-primary transition-colors">
                <Menu className="size-4" />
                <span>SHOP BY CATEGORY</span>
              </button>

              {/* Category dropdown */}
              {categoryMenuOpen && categoriesData?.categories && (
                <div className="absolute top-[100%] left-0 w-60 bg-white shadow-xl border-x border-b border-gray-200 z-50 rounded-b-sm">
                  <div className="py-1">
                    {categoriesData.categories.map((cat) => (
                      <Link
                        key={cat.slug}
                        href={`/products/${cat.slug}`}
                        className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 hover:text-primary transition-colors group"
                      >
                        <span className="font-medium">{cat.name}</span>
                        <ChevronRight className="size-3.5 opacity-40 group-hover:text-primary group-hover:opacity-100" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="w-px h-5 bg-gray-300 mx-1" />

            {/* Nav links — uppercase, spaced */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
              {topNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-2 text-xs font-semibold text-gray-700 hover:text-primary whitespace-nowrap transition-colors tracking-wide"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right side info */}
            <div className="ml-auto flex items-center gap-4 shrink-0">
              <Link
                href="/store"
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary transition-colors"
              >
                <Store className="size-3.5" />
                Our outlets
              </Link>
              <Link
                href="/contact"
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary transition-colors"
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
