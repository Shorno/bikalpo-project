"use client";
import { useQuery } from "@tanstack/react-query";
import { MoreVertical, Store, UserCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CartButton } from "@/components/layout/cart-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  isCustomerStorefrontPreview,
  withCustomerStorefrontPreview,
} from "@/lib/customer-storefront-preview";
import { orpc } from "@/utils/orpc";
import styles from "../../layout/public-header.module.css";
import { ShopNavigation } from "./shop-navigation";
import { shopNavigationLinks } from "./shop-navigation-links";
import { ShopSearch } from "./shop-search";

export function ShopHeader({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const previewMode = isCustomerStorefrontPreview(searchParams.get("preview"));
  const storePath = `/stores/${slug}`;
  const { data } = useQuery(
    orpc.customer.getShopNavigation.queryOptions({ input: { slug } }),
  );
  const shop = data?.shop;
  const displayName = shop?.shopName || shop?.name || "Store";
  const logo = shop?.shopLogo || shop?.image;

  return (
    <nav className={`${styles.header} sticky top-0 z-50`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
        <div className={`${styles.actions} md:hidden`}>
          <ShopNavigation previewMode={previewMode} />
        </div>
        <Link
          href={withCustomerStorefrontPreview(storePath, previewMode)}
          aria-label={`${displayName} storefront home`}
          className="flex min-w-0 shrink-0 items-center gap-2 text-[var(--header-brand)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--header-brand)]"
        >
          {logo ? (
            <Image
              src={logo}
              alt={`${displayName} logo`}
              width={40}
              height={40}
              priority
              className="size-10 rounded-lg border border-[var(--header-line)] bg-white object-cover"
            />
          ) : (
            <span className="flex size-10 items-center justify-center rounded-lg border border-[var(--header-line)] bg-white">
              <Store className="size-5" aria-hidden="true" />
            </span>
          )}
          <span className="hidden max-w-36 truncate text-base font-bold sm:block">
            {displayName}
          </span>
        </Link>

        <ShopSearch storePath={storePath} />

        {!previewMode && (
          <div
            className={`${styles.actions} [&_.absolute]:bg-[var(--header-brand)] [&_.absolute]:text-white`}
          >
            <CartButton iconOnly />
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open store menu"
              className="shrink-0 text-[var(--header-brand)] hover:bg-[#cee7e0] hover:text-[var(--header-hover)]"
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
      <div className={styles.navigation}>
        <div className="mx-auto hidden h-12 max-w-7xl grid-cols-3 px-4 sm:px-6 md:grid lg:px-8">
          {shopNavigationLinks.map(({ label, href }) => {
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
                    ? "inline-flex h-12 items-center justify-center px-4 text-base font-bold text-[var(--header-brand)] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--header-brand)]"
                    : "inline-flex h-12 items-center justify-center px-4 text-base font-semibold text-[var(--header-ink)] transition-colors hover:text-[var(--header-brand)] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--header-brand)]"
                }
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
