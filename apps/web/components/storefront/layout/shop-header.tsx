"use client";
import { useQuery } from "@tanstack/react-query";
import { MoreVertical, Store, UserCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { ShopNavigation } from "./shop-navigation";
import { ShopSearch } from "./shop-search";

export function ShopHeader({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const previewMode = isCustomerStorefrontPreview(searchParams.get("preview"));
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
        <ShopNavigation previewMode={previewMode} />
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

        <ShopSearch storePath={storePath} />

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
