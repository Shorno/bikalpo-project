"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Box,
  CheckCircle2,
  Edit,
  Eye,
  Package,
  Settings,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useShopProductDetail } from "@/hooks/use-shop-products-api";

// ────────────────────────────────────────────────────────────────
// Stock Status Badge
// ────────────────────────────────────────────────────────────────

function StockBadge({ status }: { status: string }) {
  switch (status) {
    case "in_stock":
      return (
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 border-emerald-200"
        >
          <CheckCircle2 className="w-3 h-3 mr-1" />
          In Stock
        </Badge>
      );
    case "low":
      return (
        <Badge
          variant="outline"
          className="bg-amber-50 text-amber-700 border-amber-200"
        >
          <AlertTriangle className="w-3 h-3 mr-1" />
          Low
        </Badge>
      );
    case "out_of_stock":
      return (
        <Badge
          variant="outline"
          className="bg-red-50 text-red-700 border-red-200"
        >
          <XCircle className="w-3 h-3 mr-1" />
          Out of Stock
        </Badge>
      );
    default:
      return null;
  }
}

// ────────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────────

export default function ShopProductDetailPage() {
  const params = useParams();
  const productId = Number(params.productId);

  const { data, isLoading, isError } = useShopProductDetail(
    Number.isNaN(productId) ? null : productId,
  );

  if (isLoading) return <DetailSkeleton />;

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <BackButton />
        <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
          <XCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Product not found</p>
        </div>
      </div>
    );
  }

  const { product, variants, totalStock } = data;

  // Compute overall status
  const lowVariants = variants.filter((v) => v.stockStatus === "low");
  const outVariants = variants.filter((v) => v.stockStatus === "out_of_stock");

  let overallStatus: "in_stock" | "low" | "out_of_stock" = "in_stock";
  if (totalStock <= 0) overallStatus = "out_of_stock";
  else if (outVariants.length > 0 || lowVariants.length > 0)
    overallStatus = "low";

  return (
    <div className="space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <BackButton />
        <div className="flex gap-2">
          {product.isRetailerOwned && (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href={`/dashboard/products/${product.id}/edit`}>
                <Edit className="h-3.5 w-3.5" />
                Edit Product
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            View Stock Details
          </Button>
        </div>
      </div>

      {/* Product Overview Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-6">
            {/* Image */}
            <div className="flex-shrink-0">
              {product.image ? (
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 border">
                  <Image
                    src={product.image}
                    alt={product.name}
                    width={96}
                    height={96}
                    className="object-cover w-full h-full"
                  />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-lg bg-gray-100 border flex items-center justify-center">
                  <Box className="w-8 h-8 text-gray-400" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900">
                {product.name}
              </h1>
              {product.coreProduct && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  Core Identity: {product.coreProduct.name} (
                  {product.coreProduct.sku})
                </p>
              )}

              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="secondary">
                  {product.category?.name ?? "Uncategorized"}
                </Badge>
                {product.subCategory && (
                  <Badge variant="outline">{product.subCategory.name}</Badge>
                )}
                <Badge
                  variant={
                    product.status === "active" ? "default" : "secondary"
                  }
                  className={
                    product.status === "active" ? "bg-emerald-600" : ""
                  }
                >
                  {product.status}
                </Badge>
              </div>

              {/* Brands */}
              {product.brands && product.brands.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  <span className="text-xs text-muted-foreground">Brands:</span>
                  {product.brands.map((b) => (
                    <Badge key={b.id} variant="outline" className="text-xs">
                      {b.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Stock Summary */}
            <div className="flex-shrink-0 text-right">
              <p className="text-sm text-muted-foreground">Total Stock</p>
              <p className="text-3xl font-bold text-gray-900">{totalStock}</p>
              <div className="mt-2">
                <StockBadge status={overallStatus} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="h-5 w-5 mx-auto text-blue-500 mb-1" />
            <p className="text-2xl font-bold">{variants.length}</p>
            <p className="text-xs text-muted-foreground">Total Variants</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto text-amber-500 mb-1" />
            <p className="text-2xl font-bold">{lowVariants.length}</p>
            <p className="text-xs text-muted-foreground">Low Stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <XCircle className="h-5 w-5 mx-auto text-red-500 mb-1" />
            <p className="text-2xl font-bold">{outVariants.length}</p>
            <p className="text-xs text-muted-foreground">Out of Stock</p>
          </CardContent>
        </Card>
      </div>

      {/* Variant Stock Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Variant Stock Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50">
                <TableHead>Brand</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Available Qty</TableHead>
                <TableHead className="text-right">Reserved</TableHead>
                <TableHead className="text-right">Retail Price</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No variants found for this product
                  </TableCell>
                </TableRow>
              ) : (
                variants.map((v) => (
                  <TableRow key={v.variantId}>
                    <TableCell className="font-medium">
                      {v.brandName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{v.unitLabel}</span>
                      {v.weightKg && v.weightKg !== "0" && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({v.weightKg} KG)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                        {v.sku ?? "—"}
                      </code>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {v.availableQty}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {v.reservedQty}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {v.retailPrice ? `৳${v.retailPrice}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <StockBadge status={v.stockStatus} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Product Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Product Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SettingItem
              label="Pack Return"
              value={product.isReturnablePack ? "Enabled" : "Disabled"}
              active={product.isReturnablePack}
            />
            <SettingItem
              label="Expiry Tracking"
              value={product.expiryEnabled ? "Enabled" : "Disabled"}
              active={product.expiryEnabled}
            />
            <SettingItem
              label="Damage Control"
              value={product.damageControlEnabled ? "Enabled" : "Disabled"}
              active={product.damageControlEnabled}
            />
            <SettingItem
              label="Tracking Type"
              value={
                product.trackingType === "none" ? "None" : product.trackingType
              }
              active={product.trackingType !== "none"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Variant-Level Alerts */}
      {(lowVariants.length > 0 || outVariants.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Variant Alerts
          </h3>
          <div className="space-y-1 text-sm text-amber-700">
            {outVariants.map((v) => (
              <p key={v.variantId}>
                ❌ <strong>{v.brandName ?? "Unknown"}</strong> → {v.unitLabel} —
                Out of stock
              </p>
            ))}
            {lowVariants.map((v) => (
              <p key={v.variantId}>
                ⚠ <strong>{v.brandName ?? "Unknown"}</strong> → {v.unitLabel} —{" "}
                {v.availableQty} remaining
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────

function BackButton() {
  return (
    <Link href="/dashboard/products">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Products
      </Button>
    </Link>
  );
}

function SettingItem({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 border">
      <div
        className={`w-2 h-2 rounded-full ${active ? "bg-emerald-500" : "bg-gray-300"}`}
      />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Skeleton
// ────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-6">
            <Skeleton className="w-24 h-24 rounded-lg" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
            <div className="text-right space-y-2">
              <Skeleton className="h-4 w-20 ml-auto" />
              <Skeleton className="h-10 w-16 ml-auto" />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 text-center space-y-2">
              <Skeleton className="h-5 w-5 mx-auto" />
              <Skeleton className="h-8 w-8 mx-auto" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
