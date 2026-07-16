"use client";

import {
  Building2,
  CircleHelp,
  FileText,
  LayoutGrid,
  MapPin,
  Menu,
  Tags,
} from "lucide-react";
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

const primaryLinks = [
  { label: "Products", href: "/products", icon: LayoutGrid },
  { label: "Offers", href: "/offers", icon: Tags },
  { label: "Stores", href: "/stores", icon: MapPin },
  { label: "For business", href: "/b2b", icon: Building2 },
];

const supportLinks = [
  { label: "Contact", href: "/contact", icon: CircleHelp },
  { label: "Terms and conditions", href: "/terms", icon: FileText },
];

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
            {primaryLinks.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={withCustomerStorefrontPreview(
                  href,
                  previewMode && (href === "/products" || href === "/stores"),
                )}
                className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Icon className="size-4 text-muted-foreground" />
                {label}
              </Link>
            ))}
          </div>

          <div className="my-3 border-t" />

          <div className="space-y-1">
            {supportLinks.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
