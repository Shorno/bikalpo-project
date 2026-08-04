"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import EditCoreProductDialog from "@/components/features/core-product/components/edit-core-product-dialog";
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
import { Button } from "@/components/ui/button";
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

export default function CoreProductDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [showEdit, setShowEdit] = useState(false);
  const { data, isError, isLoading, refetch } = useQuery(
    orpc.adminCoreProduct.getById.queryOptions({ input: { id } }),
  );

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
  const identity = data?.coreProduct;
  if (!identity) return null;

  return (
    <div className="space-y-5">
      <SetupDetailHeader
        actions={
          <Button onClick={() => setShowEdit(true)}>Edit Core Identity</Button>
        }
        backHref={`${ADMIN_BASE}/core-products`}
        backLabel="Back to Core Identities"
        code={identity.sku}
        hierarchy={[identity.category.name, identity.subCategory?.name]
          .filter(Boolean)
          .join(" / ")}
        name={identity.name}
        status={<ActiveStatusBadge isActive={identity.isActive} />}
      />
      <EditCoreProductDialog
        coreProduct={identity}
        onOpenChange={setShowEdit}
        open={showEdit}
      />

      <SetupMetricStrip
        metrics={[
          {
            label: "Configured brands",
            value: identity.configuredBrands.length,
          },
          { label: "Pack variants", value: identity.packVariantCount },
          { label: "Loose variants", value: identity.looseVariantCount },
          { label: "Products", value: identity.configuredProducts.length },
        ]}
      />

      <SetupSection title="Identity details">
        <dl className="grid gap-x-8 gap-y-4 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Type</dt>
            <dd className="mt-1 font-medium">
              {identity.category.type?.name ?? "Legacy unassigned"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Category</dt>
            <dd className="mt-1 font-medium">{identity.category.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Sub Category</dt>
            <dd className="mt-1 font-medium">
              {identity.subCategory?.name ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Top brand</dt>
            <dd className="mt-1 font-medium">
              {identity.topBrand?.name ?? "—"}
            </dd>
          </div>
          {identity.description && (
            <div className="sm:col-span-2 lg:col-span-4">
              <dt className="text-xs text-muted-foreground">Description</dt>
              <dd className="mt-1 max-w-3xl text-muted-foreground">
                {identity.description}
              </dd>
            </div>
          )}
        </dl>
      </SetupSection>

      <div className="grid gap-5 xl:grid-cols-2">
        <SetupSection
          description="Derived from configured products; no obsolete brand-mode flags are stored."
          title="Configured brands"
        >
          {identity.configuredBrands.length === 0 ? (
            <SetupEmptySection
              description="Configure a product to establish brand usage for this identity."
              title="No configured brands"
            />
          ) : (
            <div className="divide-y">
              {identity.configuredBrands.map((brand) => (
                <div
                  className="flex items-center justify-between px-4 py-3"
                  key={brand.id}
                >
                  <span className="text-sm font-medium">{brand.name}</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {brand.productCount} products
                  </span>
                </div>
              ))}
            </div>
          )}
        </SetupSection>

        <SetupSection
          description="Pack and Loose structure derived from scoped Variant Options in configured products."
          title="Variant structure"
        >
          {identity.variantOptions.length === 0 ? (
            <SetupEmptySection
              description="No variants have been configured for this identity."
              title="No variant structure"
            />
          ) : (
            <div className="divide-y">
              {identity.variantOptions.map((variant) => (
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
        action={
          <Button asChild size="sm" variant="outline">
            <a href={`${ADMIN_BASE}/setup-requests`}>Review Setup Requests</a>
          </Button>
        }
        description="Admin, warehouse, and shop product records configured from this identity."
        title="Configured products"
      >
        {identity.configuredProducts.length === 0 ? (
          <SetupEmptySection
            description="No product records are currently configured from this identity."
            title="No configured products"
          />
        ) : (
          <SetupRelatedTable>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Owner source</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {identity.configuredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.brand?.name ?? "—"}</TableCell>
                  <TableCell className="capitalize">
                    {product.creatorSource}
                  </TableCell>
                  <TableCell className="capitalize">{product.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </SetupRelatedTable>
        )}
      </SetupSection>
    </div>
  );
}
