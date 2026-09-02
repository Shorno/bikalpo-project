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
import { publicNavigationLinks } from "./public-navigation";

export function MobileMenu({ previewMode = false }: { previewMode?: boolean }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10 hover:text-white"
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
            {publicNavigationLinks.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={withCustomerStorefrontPreview(
                  href,
                  previewMode && href === "/products",
                )}
                className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Icon className="size-4 text-muted-foreground" />
                {label}
              </Link>
            ))}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
