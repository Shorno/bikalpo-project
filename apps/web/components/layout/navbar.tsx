"use client";

import { useQuery } from "@tanstack/react-query";
import { Eye, MoreVertical, Search, Store, UserCircle, X } from "lucide-react";
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
import { orpc } from "@/utils/orpc";
import { CartButton } from "./cart-button";
import { MobileMenu } from "./mobile-menu";
import styles from "./navbar.module.css";
import { NavbarSearch } from "./navbar-search";
import { publicNavigationLinks } from "./public-navigation";
import { UserDropdown } from "./user-dropdown";

function RetailerStoreSearch({ storePath }: { storePath: string }) {
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
      const href = next.size ? `${storePath}?${next.toString()}` : storePath;
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
        placeholder="Search this store"
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

function RetailerStoreNavbar({
  previewMode,
  slug,
}: {
  previewMode: boolean;
  slug: string;
}) {
  const storePath = `/stores/${slug}`;
  const { data } = useQuery(
    orpc.customer.getShopNavigation.queryOptions({ input: { slug } }),
  );
  const shop = data?.shop;
  const displayName = shop?.shopName || shop?.name || "Store";
  const logo = shop?.shopLogo || shop?.image;

  return (
    <nav className="sticky top-0 z-50 border-b border-blue-950/25 bg-primary text-primary-foreground">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
        <MobileMenu previewMode={previewMode} />
        <Link
          href={withCustomerStorefrontPreview(storePath, previewMode)}
          aria-label={`${displayName} storefront home`}
          className="flex min-w-0 shrink-0 items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-foreground"
        >
          {logo ? (
            <Image
              src={logo}
              alt={`${displayName} logo`}
              width={40}
              height={40}
              priority
              className="size-10 rounded-lg border border-white/25 bg-white object-cover"
            />
          ) : (
            <span className="flex size-10 items-center justify-center rounded-lg border border-white/25 bg-white/10">
              <Store className="size-5" aria-hidden="true" />
            </span>
          )}
          <span className="hidden max-w-36 truncate text-sm font-semibold sm:block">
            {displayName}
          </span>
        </Link>

        <RetailerStoreSearch storePath={storePath} />

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
  const retailerStoreMatch = pathname.match(/^\/stores\/([^/]+)(?:\/.*)?$/);
  const isToLetPage = pathname.startsWith("/to-let");

  if (retailerStoreMatch?.[1]) {
    return (
      <RetailerStoreNavbar
        previewMode={previewMode}
        slug={retailerStoreMatch[1]}
      />
    );
  }

  return (
    <nav className={`${styles.header} sticky top-0 z-50`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-2 sm:gap-5">
          <div className={`${styles.actions} md:hidden`}>
            <MobileMenu previewMode={previewMode} />
          </div>

          <Link
            href="/"
            aria-label="Bikalpo home"
            className="flex shrink-0 items-center gap-2 text-xl font-bold tracking-tight text-[var(--header-brand)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--header-brand)]"
          >
            <Image
              src="/logos/bikalpo-logo.jpg"
              alt=""
              width={1080}
              height={1316}
              sizes="40px"
              priority
              className="size-10 rounded-md object-cover"
            />
            <span className="hidden min-[360px]:inline">Bikalpo</span>
          </Link>

          <div className="hidden min-w-0 flex-1 md:block">
            {isToLetPage ? (
              <ToLetHeaderSearch />
            ) : (
              <NavbarSearch previewMode={previewMode} />
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <div
              className={`${styles.actions} [&_.absolute]:bg-[var(--header-brand)] [&_.absolute]:text-white`}
            >
              {previewMode ? (
                <span className="inline-flex h-10 items-center gap-1.5 px-3 text-xs font-semibold text-[var(--header-brand)]">
                  <Eye className="size-4" />
                  Preview
                </span>
              ) : (
                <CartButton iconOnly={isMobile} />
              )}
            </div>
            <div
              className={`${styles.actions} [&_a]:bg-white [&_a]:font-semibold [&_button]:bg-white [&_button]:font-semibold`}
            >
              <UserDropdown />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.navigation}>
        <div className="mx-auto hidden h-10 max-w-7xl items-center gap-1 px-4 sm:px-6 md:flex lg:px-8">
          {publicNavigationLinks.map(({ label, href, icon: Icon }) => {
            const isActive =
              pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={href}
                href={withCustomerStorefrontPreview(
                  href,
                  previewMode && href === "/products",
                )}
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "inline-flex h-10 items-center gap-1.5 border-b-2 border-white bg-[var(--header-hover)] px-3 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
                    : "inline-flex h-10 items-center gap-1.5 px-3 text-xs font-medium text-blue-50 transition-colors hover:bg-[var(--header-hover)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
                }
              >
                <Icon className="size-3.5" />
                {label}
              </Link>
            );
          })}
        </div>

        <div className={`${styles.mobileSearch} px-4 py-2 md:hidden`}>
          {isToLetPage ? (
            <ToLetHeaderSearch />
          ) : (
            <NavbarSearch previewMode={previewMode} />
          )}
        </div>
      </div>
    </nav>
  );
}

function ToLetHeaderSearch() {
  return (
    <form
      action="/to-let#listings"
      role="search"
      className="flex h-11 items-center gap-2 rounded-full border border-[var(--header-line)] bg-white px-4 text-[var(--header-ink)] focus-within:outline-2 focus-within:outline-[var(--header-brand)]"
    >
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <input
        type="search"
        name="q"
        placeholder="Search your listings"
        className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        className="inline-flex min-h-11 items-center rounded-full px-3 text-xs font-semibold text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Search
      </button>
    </form>
  );
}
