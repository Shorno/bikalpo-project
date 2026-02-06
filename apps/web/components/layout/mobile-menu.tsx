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

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/deals", label: "Today's Deals" },
  { href: "/new-arrivals", label: "New Arrivals" },
  { href: "/best-sellers", label: "Best Sellers" },
];

const categories = [
  { href: "/category/electronics", label: "Electronics" },
  { href: "/category/food", label: "Food" },
  { href: "/category/grocery", label: "Grocery" },
  { href: "/category/fashion", label: "Fashion" },
  { href: "/category/home-garden", label: "Home & Garden" },
];

export function MobileMenu() {
  return (
    <Sheet>
      <SheetTrigger asChild className="md:hidden">
        <Button variant="ghost" size="icon">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] px-6">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <div className="mt-6 flex flex-col gap-6 px-2">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Categories
            </p>
            {categories.map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="block py-2.5 text-sm hover:text-primary transition-colors"
              >
                {cat.label}
              </Link>
            ))}
          </div>
          <div className="border-t pt-6 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Quick Links
            </p>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block py-2.5 text-sm hover:text-primary transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
