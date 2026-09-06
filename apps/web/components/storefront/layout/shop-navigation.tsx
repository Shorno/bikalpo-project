"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { withCustomerStorefrontPreview } from "@/lib/customer-storefront-preview";
import { shopNavigationLinks } from "./shop-navigation-links";

export function ShopNavigation({
  previewMode = false,
}: {
  previewMode?: boolean;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-[var(--header-brand)] hover:bg-[#cee7e0] hover:text-[var(--header-hover)]"
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[85vw] max-w-80 p-0">
        <SheetHeader className="border-b px-5 py-5 text-left">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>

        <nav aria-label="Mobile navigation" className="p-3">
          <div className="space-y-1">
            {shopNavigationLinks.map(({ label, href }) => (
              <Link
                key={href}
                href={withCustomerStorefrontPreview(
                  href,
                  previewMode && href === "/products",
                )}
                className="flex min-h-11 items-center px-3 text-base font-semibold text-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {label}
              </Link>
            ))}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
