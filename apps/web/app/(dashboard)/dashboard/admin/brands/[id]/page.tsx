"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import EditBrandDialog from "@/components/features/brand/components/edit-brand-dialog";
import {
  ActiveStatusBadge,
  SetupDetailHeader,
  SetupEmptySection,
  SetupErrorState,
  SetupMetricStrip,
  SetupRelatedTable,
  SetupSection,
} from "@/components/features/product-setup";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ADMIN_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";

export default function BrandDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const {
    data: brand,
    isError,
    isLoading,
    refetch,
  } = useQuery(orpc.brand.getAdminById.queryOptions({ input: { id } }));

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError) return <SetupErrorState onRetry={() => void refetch()} />;
  if (!brand) return null;

  return (
    <div className="space-y-5">
      <SetupDetailHeader
        actions={<EditBrandDialog brand={brand} />}
        backHref={`${ADMIN_BASE}/brands`}
        backLabel="Back to brands"
        code={brand.skuCode ?? brand.slug}
        hierarchy={
          brand.categories.length > 0
            ? brand.categories.map((item) => item.name).join(" / ")
            : "Not used in a category"
        }
        name={brand.name}
        status={<ActiveStatusBadge isActive={brand.isActive} />}
      />

      <SetupMetricStrip
        metrics={[
          { label: "Products", value: brand.productCount },
          { label: "Core Identities", value: brand.coreIdentities.length },
          { label: "Categories", value: brand.categories.length },
          { label: "Variants", value: brand.variants.length },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <SetupSection
          description="Canonical identities currently configured with this brand."
          title="Core Identity usage"
        >
          {brand.coreIdentities.length === 0 ? (
            <SetupEmptySection
              description="The brand has not been configured on a Core Identity."
              title="No Core Identity usage"
            />
          ) : (
            <SetupRelatedTable>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Core Identity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brand.coreIdentities.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">
                      {item.sku}
                    </TableCell>
                    <TableCell>{item.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </SetupRelatedTable>
          )}
        </SetupSection>

        <SetupSection
          description="Pack and Loose options found on configured products."
          title="Variant structure"
        >
          {brand.variants.length === 0 ? (
            <SetupEmptySection
              description="No scoped variants currently use this brand."
              title="No variant structure"
            />
          ) : (
            <div className="divide-y">
              {brand.variants.map((variant) => (
                <div
                  className="flex items-center justify-between gap-3 px-4 py-3"
                  key={variant.id}
                >
                  <div>
                    <p className="text-sm font-medium">{variant.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {[variant.size, variant.unit].filter(Boolean).join(" ")}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {variant.variantType === "pack" ? "Pack" : "Loose"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </SetupSection>
      </div>

      <SetupSection
        description="Product records that currently reference this brand."
        title="Configured products"
      >
        {brand.configuredProducts.length === 0 ? (
          <SetupEmptySection
            description="Existing products will appear here after the brand is configured."
            title="No configured products"
          />
        ) : (
          <SetupRelatedTable>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Core Identity</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brand.configuredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.category.name}</TableCell>
                  <TableCell>{product.coreProduct?.name ?? "—"}</TableCell>
                  <TableCell className="capitalize">{product.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </SetupRelatedTable>
        )}
      </SetupSection>

      <p className="text-xs text-muted-foreground">
        Top-selling variant:{" "}
        {brand.topSellingVariant?.name ?? "No delivered-order data yet"}
      </p>
    </div>
  );
}
