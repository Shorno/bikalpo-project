"use client";

import {
  Building2,
  Eye,
  LayoutGrid,
  MapPin,
  MoreVertical,
  Search,
  Store,
  Tags,
  UserCircle,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  { label: "For business", href: "/b2b", icon: Building2 },
];

function RetailerStoreSearch({ pathname }: { pathname: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [value, setValue] = useState(query);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setValue(query), [query]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const updateSearch = (nextValue: string) => {
    setValue(nextValue);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      const normalized = nextValue.trim().slice(0, 150);
      if (normalized) next.set("q", normalized);
      else next.delete("q");
      next.delete("page");
      const href = next.size ? `${pathname}?${next.toString()}` : pathname;
      router.replace(href, { scroll: false });
    }, 300);
  };

  return (
    <div className="relative min-w-0 flex-1 md:max-w-2xl">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => updateSearch(event.target.value)}
        placeholder="Search products"
        aria-label="Search products in this store"
        maxLength={150}
        className="h-10 w-full rounded-lg border border-white/25 bg-white pl-9 pr-9 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-white focus:ring-2 focus:ring-white/25"
      />
      {value && (
        <button
          type="button"
          onClick={() => updateSearch("")}
          aria-label="Clear store search"
          className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function RetailerStoreNavbar({ previewMode }: { previewMode: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b border-blue-950/25 bg-primary text-primary-foreground">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
        <MobileMenu previewMode={previewMode} />
        <Link
          href="/"
          aria-label="Bikalpo home"
          className="flex shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-foreground"
        >
          <Image
            src="/logos/site-logo-white.svg"
            alt="Bikalpo"
            width={96}
            height={36}
            priority
            className="h-auto w-16 object-contain sm:w-24"
          />
        </Link>

        <RetailerStoreSearch pathname={pathname} />

        {!previewMode && (
          <div className="[&_button]:text-white [&_button:hover]:bg-white/10 [&_button:hover]:text-white">
            <CartButton iconOnly />
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open store menu"
              className="shrink-0 text-white hover:bg-white/10 hover:text-white"
            >
              <MoreVertical className="size-5" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <Link
                href={withCustomerStorefrontPreview("/stores", previewMode)}
              >
                <Store className="size-4" aria-hidden="true" />
                Browse stores
              </Link>
            </DropdownMenuItem>
            {!previewMode && (
              <DropdownMenuItem asChild>
                <Link href="/account">
                  <UserCircle className="size-4" aria-hidden="true" />
                  My account
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}

export function Navbar() {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previewMode = isCustomerStorefrontPreview(searchParams.get("preview"));
  const isRetailerStorefront = /^\/stores\/[^/]+\/?$/.test(pathname);

  if (isRetailerStorefront) {
    return <RetailerStoreNavbar previewMode={previewMode} />;
  }

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
