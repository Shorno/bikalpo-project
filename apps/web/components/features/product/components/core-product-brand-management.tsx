"use client";

import { ArrowLeft, Edit3, Package, Plus, RotateCcw } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ManagedBrandProduct = {
  productId: number;
  productName: string;
  productImage?: string | null;
  brandId: number;
  brandName: string;
  brandLogo?: string | null;
  status: string;
  variantCount: number;
};

type CoreProductBrandManagementProps = {
  core: {
    id: number;
    name: string;
    image?: string | null;
    brandCreationMode: "single" | "batch";
    categoryName?: string | null;
    subCategoryName?: string | null;
  };
  products: ManagedBrandProduct[];
  addableBrandCount: number;
  backHref: string;
  addHref: string;
  editConfigurationHref: string;
  productEditHref: (productId: number) => string;
};

export function CoreProductBrandManagement({
  core,
  products,
  addableBrandCount,
  backHref,
  addHref,
  editConfigurationHref,
  productEditHref,
}: CoreProductBrandManagementProps) {
  const isSingleMode = core.brandCreationMode === "single";
  const actionHref = isSingleMode ? addHref : editConfigurationHref;
  const actionLabel = isSingleMode
    ? addableBrandCount > 0
      ? "Add Brand"
      : "All Brands Added"
    : products.length > 0
      ? "Edit Configuration"
      : "Add Brands";
  const actionDisabled = isSingleMode && addableBrandCount === 0;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="shrink-0">
              <Link href={backHref} aria-label="Back to catalog">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                Products / Brand products
              </p>
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-semibold">{core.name}</h1>
                <Badge variant="secondary">{products.length} configured</Badge>
              </div>
            </div>
          </div>
          {actionDisabled ? (
            <Button disabled>{actionLabel}</Button>
          ) : (
            <Button asChild>
              <Link href={actionHref}>
                <Plus className="h-4 w-4" />
                {actionLabel}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <section className="flex items-center gap-4 rounded-xl border bg-card p-4">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
            {core.image ? (
              <Image
                src={core.image}
                alt=""
                fill
                sizes="64px"
                className="object-contain"
                unoptimized={core.image.startsWith("http")}
              />
            ) : (
              <Package className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium">{core.name}</p>
            <p className="text-sm text-muted-foreground">
              {[core.categoryName, core.subCategoryName]
                .filter(Boolean)
                .join(" · ") || "Core product"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isSingleMode
                ? "Each save creates or updates one independent Brand Product."
                : "Brands are synchronized together as one desired configuration."}
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Configured brands</h2>
            <p className="text-sm text-muted-foreground">
              Active and inactive products are both listed here.
            </p>
          </div>
          {products.length === 0 ? (
            <div className="p-10 text-center">
              <Package className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium">No brand products yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Use {isSingleMode ? "Add Brand" : "Add Brands"} to create the
                first product.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Variants</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const inactive = product.status === "inactive";
                  return (
                    <TableRow key={product.productId}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                            {product.brandLogo || product.productImage ? (
                              <Image
                                src={
                                  product.brandLogo ||
                                  product.productImage ||
                                  ""
                                }
                                alt=""
                                fill
                                sizes="36px"
                                className="object-contain"
                                unoptimized={(
                                  product.brandLogo ||
                                  product.productImage ||
                                  ""
                                ).startsWith("http")}
                              />
                            ) : (
                              <Package className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {product.brandName}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {product.productName}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={inactive ? "outline" : "secondary"}>
                          {product.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{product.variantCount}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={productEditHref(product.productId)}>
                            {inactive ? (
                              <RotateCcw className="h-4 w-4" />
                            ) : (
                              <Edit3 className="h-4 w-4" />
                            )}
                            {inactive ? "Reactivate / Edit" : "Edit"}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>
      </main>
    </div>
  );
}
