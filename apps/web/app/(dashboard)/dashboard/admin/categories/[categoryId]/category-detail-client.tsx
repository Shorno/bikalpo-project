"use client";

import type { SubCategory } from "@bikalpo-project/db/schema";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Boxes, FolderTree, Package } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface CategoryProduct {
  id: number;
  name: string;
  slug: string;
  size: string;
  status: string;
  subCategory?: { id: number; name: string } | null;
  images?: { imageUrl: string }[];
}

interface CategoryDetail {
  id: number;
  name: string;
  slug: string;
  image: string;
  isActive: boolean;
  displayOrder: number;
  typeId: number | null;
  type?: { id: number; name: string } | null;
  subCategory: SubCategory[];
  products: CategoryProduct[];
}

export default function CategoryDetailClient({
  category,
}: {
  category: CategoryDetail;
}) {
  return (
    <div className="space-y-8">
      {/* Header — flat layout */}
      <div className="flex flex-col md:flex-row md:items-start gap-5">
        <div className="w-20 h-20 relative rounded-lg overflow-hidden border shadow-sm flex-shrink-0">
          <Image
            src={category.image}
            alt={category.name}
            fill
            className="object-cover"
          />
        </div>
        <div className="space-y-1.5 flex-1">
          <h1 className="text-2xl font-bold">{category.name}</h1>
          <p className="text-sm text-muted-foreground font-mono">
            /{category.slug}
          </p>
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <Badge
              variant={category.isActive ? "default" : "secondary"}
              className={cn(
                category.isActive && "bg-green-600 hover:bg-green-700",
              )}
            >
              {category.isActive ? "Active" : "Inactive"}
            </Badge>
            {category.type && (
              <Badge variant="outline" className="gap-1">
                <Boxes className="h-3 w-3" />
                {category.type.name}
              </Badge>
            )}
            <Badge variant="outline" className="font-mono">
              Order: {category.displayOrder}
            </Badge>
          </div>
        </div>

        {/* Inline stats */}
        <div className="flex gap-6 md:gap-8 pt-2 md:pt-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <FolderTree className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold leading-none">
                {category.subCategory.length}
              </p>
              <p className="text-xs text-muted-foreground">Subcategories</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Package className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xl font-bold leading-none">
                {category.products.length}
              </p>
              <p className="text-xs text-muted-foreground">Products</p>
            </div>
          </div>
        </div>
      </div>

      {/* Subcategories */}
      <section>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <FolderTree className="h-5 w-5" />
          Subcategories ({category.subCategory.length})
        </h2>
        {category.subCategory.length > 0 ? (
          <div className="rounded-lg border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[60px]">Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {category.subCategory.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <div className="w-10 h-10 relative rounded-md overflow-hidden border">
                        <Image
                          src={sub.image}
                          alt={sub.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{sub.name}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {sub.slug}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={sub.isActive ? "default" : "secondary"}
                        className={cn(
                          "text-xs",
                          sub.isActive && "bg-green-600 hover:bg-green-700",
                        )}
                      >
                        {sub.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono">
                        {sub.displayOrder}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground border rounded-lg">
            <FolderTree className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No subcategories yet</p>
          </div>
        )}
      </section>

      {/* Products */}
      <section>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <Package className="h-5 w-5" />
          Products ({category.products.length})
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          All products under the {category.name} category
        </p>
        {category.products.length > 0 ? (
          <div className="rounded-lg border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[60px]">Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Subcategory</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {category.products.map((product) => {
                  const imgUrl =
                    product.images?.[0]?.imageUrl || "/placeholder.png";
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="w-10 h-10 relative rounded-md overflow-hidden border">
                          <Image
                            src={imgUrl}
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
                        {product.subCategory ? (
                          <Badge variant="outline" className="text-xs">
                            {product.subCategory.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            product.status === "active"
                              ? "default"
                              : "secondary"
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
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground border rounded-lg">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No products in this category yet</p>
          </div>
        )}
      </section>
    </div>
  );
}
