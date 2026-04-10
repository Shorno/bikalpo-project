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
  variants?: (ProductVariant & { brand?: { id: number; name: string } | null })[];
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
      accessorKey: "brand",
      header: () => <div className="text-center">Brand</div>,
      cell: ({ row }) => {
        const product = row.original;
        // Derive brands from variants (variant-level brand only)
        const variantBrands = (product.variants ?? [])
          .map((v) => v.brand?.name)
          .filter(Boolean);
        const uniqueBrands = [...new Set(variantBrands)];
        return (
          <div className="text-center">
            {uniqueBrands.length > 0 ? (
              <span className="font-medium">{uniqueBrands.join(", ")}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "size",
      header: () => <div className="text-center">Size</div>,
      cell: ({ row }) => (
        <div className="text-center">{row.getValue("size")}</div>
      ),
    },
    {
      accessorKey: "price",
      header: ({ column }) => {
        return (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              Price
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        );
      },
      cell: ({ row }) => {
        const price = parseFloat(row.getValue("price"));
        if (!price || price === 0) {
          return (
            <div className="text-center text-sm text-amber-600 font-medium">
              Set by shop owners
            </div>
          );
        }
        const formatted = new Intl.NumberFormat("en-BD", {
          style: "currency",
          currency: "BDT",
          minimumFractionDigits: 2,
        }).format(price);
        return <div className="text-center font-medium">{formatted}</div>;
      },
    },
    {
      accessorKey: "stockQuantity",
      header: ({ column }) => {
        return (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              Stock
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        );
      },
      cell: ({ row }) => (
        <div className="text-center">{row.getValue("stockQuantity")}</div>
      ),
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
