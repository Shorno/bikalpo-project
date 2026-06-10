import type { Brand } from "@bikalpo-project/db/schema";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TopBrandsCardProps {
  brands: Brand[];
}

export function TopBrandsCard({ brands }: TopBrandsCardProps) {
  if (!brands || brands.length === 0) return null;

  return (
    <Card className="py-4">
      <CardHeader className="pb-2 px-4">
        <CardTitle className="text-sm">Top Brands</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <div className="grid grid-cols-2 gap-2">
          {brands.slice(0, 8).map((brand) => (
            <Link
              key={brand.id}
              href={`/products?brand=${brand.slug}`}
              className="h-10 relative border rounded-md p-1.5 hover:border-primary/50 transition-colors group flex items-center justify-center"
            >
              {brand.logo ? (
                <Image
                  src={brand.logo}
                  alt={brand.name}
                  fill
                  className="object-contain grayscale group-hover:grayscale-0 transition-all opacity-70 group-hover:opacity-100"
                />
              ) : (
                <span className="text-xs font-semibold text-muted-foreground truncate px-1">
                  {brand.name}
                </span>
              )}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
