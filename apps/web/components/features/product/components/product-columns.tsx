"use client";

import type {
  Category,
  Product,
  ProductImage,
  ProductVariant,
  SubCategory,
} from "@bikalpo-project/db/schema";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Pencil } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DeleteProductDialog from "./delete-product-dialog";

export interface ProductWithRelations extends Product {
  images: ProductImage[];
  category: Category;
  subCategory: SubCategory | null;
  brand?: { id: number; name: string } | null;
  variants?: (Pick<ProductVariant, "id" | "variantType" | "brandId" | "unitLabel"> & {
    brand?: { id: number; name: string } | null;
  })[];
}

export function useProductColumns() {
  const columns: ColumnDef<ProductWithRelations>[] = [
    {
      accessorKey: "image",
      header: "Image",
      cell: ({ row }) => (
        <div className="w-16 h-16 relative">
          <Image
            src={row.getValue("image")}
            alt={row.getValue("name")}
            fill
            className="object-cover rounded-md"
          />
        </div>
      ),
      enableSorting: false,
      size: 80,
    },
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              Name
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        );
      },
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("name")}</div>
      ),
    },
    {
      accessorKey: "category",
      header: () => <div className="text-center">Category</div>,
      cell: ({ row }) => {
        const product = row.original;
        return (
          <div className="text-center">
            <div className="font-medium">{product.category.name}</div>
            {product.subCategory && (
              <div className="text-xs text-muted-foreground">
                {product.subCategory.name}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "variants",
      header: () => <div>Variants</div>,
      cell: ({ row }) => {
        const product = row.original;
        // Prefer new variantPrices (Core Identity), fall back to old variants
        const rawVps = (product as any).variantPrices ?? [];
        // Deduplicate by variantOptionId (keep latest)
        const seen = new Set<number>();
        const vps = rawVps.filter((vp: any) => {
          if (seen.has(vp.variantOptionId)) return false;
          seen.add(vp.variantOptionId);
          return true;
        });
        if (vps.length > 0) {
          const trade = vps.filter((vp: any) => vp.variantType === "trade");
          const retail = vps.filter((vp: any) => vp.variantType === "retail");
          const unset = vps.filter((vp: any) => !vp.variantType);
          return (
            <div className="space-y-1">
              {trade.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {trade.map((vp: any) => (
                    <Badge key={vp.id} variant="outline" className="text-[10px] border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                      B2B · {vp.variantOption?.name || "Trade"}
                    </Badge>
                  ))}
                </div>
              )}
              {retail.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {retail.map((vp: any) => (
                    <Badge key={vp.id} variant="outline" className="text-[10px] border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                      B2C · {vp.variantOption?.name || "Retail"}
                    </Badge>
                  ))}
                </div>
              )}
              {unset.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {unset.map((vp: any) => (
                    <Badge key={vp.id} variant="outline" className="text-[10px]">
                      {vp.variantOption?.name || "Variant"}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          );
        }
        // Fallback: old product_variant system
        const variants = product.variants ?? [];
        if (variants.length === 0) {
          return <span className="text-muted-foreground text-xs">—</span>;
        }
        const trade = variants.filter((v) => v.variantType === "trade");
        const retail = variants.filter((v) => v.variantType === "retail");
        return (
          <div className="space-y-1">
            {trade.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {trade.map((v) => (
                  <Badge key={v.id} variant="outline" className="text-[10px] border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                    B2B · {v.unitLabel || "Trade"}
                  </Badge>
                ))}
              </div>
            )}
            {retail.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {retail.map((v) => (
                  <Badge key={v.id} variant="outline" className="text-[10px] border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                    B2C · {v.unitLabel || "Retail"}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "brands",
      header: () => <div>Brands</div>,
      cell: ({ row }) => {
        const product = row.original;
        // New M2M brands
        const pbs = (product as any).productBrands ?? [];
        if (pbs.length > 0) {
          return (
            <div className="flex flex-wrap gap-1">
              {pbs.map((pb: any) => (
                <Badge key={pb.id} variant="outline" className="text-[10px] border-green-300 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300">
                  {pb.brand?.name || "Brand"}
                </Badge>
              ))}
            </div>
          );
        }
        // Fallback: old single brand
        if (product.brand?.name) {
          return (
            <Badge variant="outline" className="text-[10px] border-green-300 bg-green-50 text-green-700">
              {product.brand.name}
            </Badge>
          );
        }
        return <span className="text-muted-foreground text-xs">—</span>;
      },
    },

    {
      accessorKey: "inStock",
      header: () => <div className="text-center">Status</div>,
      cell: ({ row }) => {
        const inStock = row.getValue("inStock") as boolean;
        return (
          <div className="flex justify-center">
            <Badge variant={inStock ? "default" : "secondary"}>
              {inStock ? "In Stock" : "Out of Stock"}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "isFeatured",
      header: () => <div className="text-center">Featured</div>,
      cell: ({ row }) => {
        const isFeatured = row.getValue("isFeatured") as boolean;
        return (
          <div className="flex justify-center">
            <Badge variant={isFeatured ? "default" : "outline"}>
              {isFeatured ? "Yes" : "No"}
            </Badge>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-center">Actions</div>,
      enableHiding: false,
      cell: ({ row }) => {
        const product = row.original;

        return (
          <div className="flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/admin/products/${product.id}/edit`}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                <DeleteProductDialog
                  productId={product.id}
                  productName={product.name}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return columns;
}
