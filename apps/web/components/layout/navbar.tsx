"use client";

import { Building2, Eye, KeyRound, LayoutGrid, MapPin, Tags } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  isCustomerStorefrontPreview,
  withCustomerStorefrontPreview,
} from "@/lib/customer-storefront-preview";
import { CartButton } from "./cart-button";
import { MobileMenu } from "./mobile-menu";
import { NavbarSearch } from "./navbar-search";
import { UserDropdown } from "./user-dropdown";

const storefrontLinks = [
  { label: "Products", href: "/products", icon: LayoutGrid },
  { label: "Offers", href: "/offers", icon: Tags },
  { label: "Stores", href: "/stores", icon: MapPin },
  { label: "To-Let", href: "/to-let", icon: KeyRound },
  { label: "For business", href: "/b2b", icon: Building2 },
];

export function Navbar() {
  const isMobile = useIsMobile();
  const searchParams = useSearchParams();
  const previewMode = isCustomerStorefrontPreview(searchParams.get("preview"));

  return (
    <nav className="sticky top-0 z-50 border-b border-blue-950/25 bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-3 sm:gap-5">
          <div className="md:hidden">
            <MobileMenu previewMode={previewMode} />
          </div>

          <Link
            href="/"
            aria-label="Bikalpo home"
            className="flex shrink-0 items-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-foreground"
          >
            <Image
              src="/logos/site-logo-white.svg"
              alt="Bikalpo"
              width={isMobile ? 88 : 112}
              height={42}
              priority
              className="object-contain"
            />
          </Link>

          <div className="hidden min-w-0 flex-1 md:block">
            <NavbarSearch previewMode={previewMode} />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="text-primary-foreground [&_button]:text-primary-foreground [&_button:hover]:bg-white/10 [&_button:hover]:text-primary-foreground [&_.absolute]:bg-background [&_.absolute]:text-foreground">
              {previewMode ? (
                <span className="inline-flex h-10 items-center gap-1.5 px-3 text-xs font-semibold text-primary-foreground">
                  <Eye className="size-4" />
                  Preview
                </span>
              ) : (
                <CartButton />
              )}
            </div>
            <div className="[&_a]:bg-background [&_a]:font-semibold [&_a]:text-primary [&_a:hover]:bg-background/90 [&_button]:bg-background [&_button]:font-semibold [&_button]:text-primary [&_button:hover]:bg-background/90">
              <UserDropdown />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/15 bg-[oklch(0.43_0.19_265)]">
        <div className="mx-auto hidden h-10 max-w-7xl items-center gap-1 px-4 sm:px-6 md:flex lg:px-8">
          {storefrontLinks.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={withCustomerStorefrontPreview(
                href,
                previewMode && (href === "/products" || href === "/stores"),
              )}
              className="inline-flex h-10 items-center gap-1.5 px-3 text-xs font-medium text-blue-50 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
            >
              <Icon className="size-3.5" />
              {label}
            </Link>
          ))}
          <Link
            href="/contact"
            className="ml-auto text-xs font-medium text-blue-100 hover:text-white hover:underline hover:underline-offset-4"
          >
            Contact
          </Link>
        </div>

        <div className="px-4 py-2 md:hidden">
          <NavbarSearch previewMode={previewMode} />
        </div>
      </div>
    </nav>
  );
}
