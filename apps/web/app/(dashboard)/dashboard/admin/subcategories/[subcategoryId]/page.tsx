"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Boxes,
  FolderTree,
  Package,
  Store,
  Tag,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ADMIN_BASE } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

export default function SubcategoryDetailPage() {
  const params = useParams();
  const id = Number(params.subcategoryId);

  const { data, isLoading } = useQuery(
    orpc.adminSubcategory.getById.queryOptions({ input: { id } }),
  );

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (!data?.subcategory) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Sub category not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={`${ADMIN_BASE}/subcategories`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sub Categories
          </Link>
        </Button>
      </div>
    );
  }

  const sub = data.subcategory;
  const products = data.products ?? [];
  const brands = data.brands ?? [];
  const variants = data.variants ?? [];

  return (
    <div className="space-y-8">
      {/* Back button */}
      <Button asChild variant="ghost" size="sm">
        <Link href={`${ADMIN_BASE}/subcategories`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Sub Categories
        </Link>
      </Button>

      {/* Header — flat layout */}
      <div className="flex flex-col md:flex-row md:items-start gap-5">
        <div className="w-20 h-20 relative rounded-lg overflow-hidden border shadow-sm flex-shrink-0">
          <Image
            src={sub.image}
            alt={sub.name}
            fill
            className="object-cover"
          />
        </div>
        <div className="space-y-1.5 flex-1">
          <h1 className="text-2xl font-bold">{sub.name}</h1>
          <p className="text-sm text-muted-foreground font-mono">
            /{sub.slug}
          </p>
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <Badge
              variant={sub.isActive ? "default" : "secondary"}
              className={cn(
                sub.isActive && "bg-green-600 hover:bg-green-700",
              )}
            >
              {sub.isActive ? "Active" : "Inactive"}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <FolderTree className="h-3 w-3" />
              {sub.category.name}
            </Badge>
            {sub.category.type && (
              <Badge variant="outline" className="gap-1">
                <Boxes className="h-3 w-3" />
                {sub.category.type.name}
              </Badge>
            )}
            <Badge variant="outline" className="font-mono">
              Order: {sub.displayOrder}
            </Badge>
          </div>
        </div>

        {/* Inline stats */}
        <div className="flex gap-6 md:gap-8 pt-2 md:pt-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Package className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xl font-bold leading-none">
                {products.length}
              </p>
              <p className="text-xs text-muted-foreground">Products</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Tag className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <p className="text-xl font-bold leading-none">
                {brands.length}
              </p>
              <p className="text-xs text-muted-foreground">Brands</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Store className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <p className="text-xl font-bold leading-none">
                {variants.length}
              </p>
              <p className="text-xs text-muted-foreground">Variants</p>
            </div>
          </div>
        </div>
      </div>

      {/* Products */}
      <section>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <Package className="h-5 w-5" />
          Products ({products.length})
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          All products under the {sub.name} subcategory
        </p>
        {products.length > 0 ? (
          <div className="rounded-lg border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[60px]">Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="w-10 h-10 relative rounded-md overflow-hidden border">
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {product.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {product.size}
                    </TableCell>
                    <TableCell>
                      {product.brand ? (
                        <Badge variant="outline" className="text-xs">
                          {product.brand.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          product.status === "active" ? "default" : "secondary"
                        }
                        className={cn(
                          "text-xs",
                          product.status === "active" &&
                            "bg-green-600 hover:bg-green-700",
                        )}
                      >
                        {product.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground border rounded-lg">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No products in this subcategory yet</p>
          </div>
        )}
      </section>

      {/* Brands Used */}
      <section>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Tag className="h-5 w-5" />
          Brands Used ({brands.length})
        </h2>
        {brands.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {brands.map((brand) => (
              <Badge key={brand.id} variant="outline" className="text-sm py-1 px-3">
                {brand.name}
              </Badge>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground border rounded-lg">
            <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No brands associated yet</p>
          </div>
        )}
      </section>

      {/* Variants Used */}
      <section>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Store className="h-5 w-5" />
          Variants Used ({variants.length})
        </h2>
        {variants.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <Badge key={v.id} variant="outline" className="text-sm py-1 px-3 gap-1.5">
                {v.unitLabel}
                {v.packType && (
                  <span className="text-muted-foreground text-xs">
                    ({v.packType})
                  </span>
                )}
                {v.sku && (
                  <span className="text-muted-foreground font-mono text-xs">
                    · {v.sku}
                  </span>
                )}
              </Badge>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground border rounded-lg">
            <Store className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No variants associated yet</p>
          </div>
        )}
      </section>
    </div>
  );
}
