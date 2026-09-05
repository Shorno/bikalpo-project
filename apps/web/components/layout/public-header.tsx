"use client";
import { Eye, Search } from "lucide-react";
import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ToLetSearchButton } from "@/components/features/to-let/to-let-search-button";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  isCustomerStorefrontPreview,
  withCustomerStorefrontPreview,
} from "@/lib/customer-storefront-preview";
import { CartButton } from "./cart-button";
import { MobileMenu } from "./mobile-menu";
import { NavbarSearch } from "./navbar-search";
import styles from "./public-header.module.css";
import { publicNavigationLinks } from "./public-navigation";
import { UserDropdown } from "./user-dropdown";

export function PublicHeader() {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previewMode = isCustomerStorefrontPreview(searchParams.get("preview"));
  const isToLetPage = pathname.startsWith("/to-let");

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
    <Form
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
      <ToLetSearchButton className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-xs font-semibold text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60" />
    </Form>
  );
}
