"use client";

import {
  Baby,
  ChevronRight,
  Gamepad2,
  Home,
  Menu,
  Package,
  PenTool,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useActiveCategories } from "@/hooks/use-customer-api";

// Icon mapping for categories
const categoryIcons: Record<string, any> = {
  food: ShoppingBag,
  "baby-food": Baby,
  diapers: Baby,
  cleaning: Sparkles,
  "pet-care": Package,
  beauty: Stethoscope,
  fashion: Shirt,
  "home-kitchen": Home,
  stationeries: PenTool,
  toys: Gamepad2,
  gadget: Smartphone,
};

function getCategoryIcon(slug: string) {
  const key = Object.keys(categoryIcons).find((k) =>
    slug.toLowerCase().includes(k),
  );
  return key ? categoryIcons[key] : Package;
}

export function MobileMenu() {
  const { data: categoriesData } = useActiveCategories();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10"
          aria-label="Menu"
        >
          <Menu className="size-6" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[85vw] max-w-[320px] p-0 overflow-y-auto"
      >
        <SheetHeader className="px-4 py-4 bg-gray-50 border-b">
          <SheetTitle className="text-left text-sm font-bold uppercase tracking-wide flex items-center gap-2">
            <Menu className="size-4" />
            SHOP BY CATEGORY
          </SheetTitle>
        </SheetHeader>

        {/* Categories List */}
        {categoriesData?.categories && categoriesData.categories.length > 0 && (
          <div className="py-2">
            {categoriesData.categories.map((cat) => {
              const IconComponent = getCategoryIcon(cat.slug);
              return (
                <Link
                  key={cat.slug}
                  href={`/products/${cat.slug}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                >
                  <div className="shrink-0">
                    {cat.image ? (
                      <Image
                        src={cat.image}
                        alt={cat.name}
                        width={24}
                        height={24}
                        className="object-contain"
                      />
                    ) : (
                      <IconComponent className="size-6 text-gray-600" />
                    )}
                  </div>
                  <span className="flex-1 text-sm font-medium text-gray-900">
                    {cat.name}
                  </span>
                  <ChevronRight className="size-4 text-gray-400 shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
