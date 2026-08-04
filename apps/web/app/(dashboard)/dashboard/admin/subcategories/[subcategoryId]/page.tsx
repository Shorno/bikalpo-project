"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  ActiveStatusBadge,
  SetupDetailHeader,
  SetupEmptySection,
  SetupErrorState,
  SetupMetricStrip,
  SetupRelatedTable,
  SetupSection,
} from "@/components/features/product-setup";
import EditSubcategoryDialog from "@/components/features/subcategory/components/edit-subcategory-dialog";
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

export default function SubcategoryDetailPage() {
  const params = useParams<{ subcategoryId: string }>();
  const id = Number(params.subcategoryId);
  const [showEdit, setShowEdit] = useState(false);
  const { data, isError, isLoading, refetch } = useQuery(
    orpc.adminSubcategory.getById.queryOptions({ input: { id } }),
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
  const subcategory = data?.subcategory;
  if (!subcategory) return null;

  return (
    <div className="space-y-5">
      <SetupDetailHeader
        actions={
          <Button onClick={() => setShowEdit(true)}>Edit Sub Category</Button>
        }
        backHref={`${ADMIN_BASE}/subcategories`}
        backLabel="Back to Sub Categories"
        code={subcategory.skuCode ?? subcategory.slug}
        hierarchy={[subcategory.category.type?.name, subcategory.category.name]
          .filter(Boolean)
          .join(" / ")}
        name={subcategory.name}
        status={<ActiveStatusBadge isActive={subcategory.isActive} />}
      />
      <EditSubcategoryDialog
        onOpenChange={setShowEdit}
        open={showEdit}
        subcategory={subcategory}
      />

      <SetupMetricStrip
        metrics={[
          { label: "Core Identities", value: data.coreProducts.length },
          { label: "Active sellers", value: data.activeSellerCount },
          { label: "Products", value: data.products.length },
          { label: "Brands", value: data.brands.length },
        ]}
      />

      <SetupSection
        description="Canonical identities defined at this point in the taxonomy."
        title="Core Identity structure"
      >
        {data.coreProducts.length === 0 ? (
          <SetupEmptySection
            description="Core Identities will appear here when assigned to this Sub Category."
            title="No Core Identities"
          />
        ) : (
          <SetupRelatedTable>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Core Identity</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.coreProducts.map((identity) => (
                <TableRow key={identity.id}>
                  <TableCell className="font-mono text-xs">
                    {identity.sku}
                  </TableCell>
                  <TableCell className="font-medium">{identity.name}</TableCell>
                  <TableCell>
                    <ActiveStatusBadge isActive={identity.isActive} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </SetupRelatedTable>
        )}
      </SetupSection>

      <SetupSection
        description="Secondary product, brand, and generated-variant usage."
        title="Product usage"
      >
        {data.products.length === 0 ? (
          <SetupEmptySection
            description="No product records currently reference this Sub Category."
            title="No product usage"
          />
        ) : (
          <SetupRelatedTable>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.brand?.name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {product.size}
                  </TableCell>
                  <TableCell className="capitalize">{product.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </SetupRelatedTable>
        )}
      </SetupSection>

      <div className="grid gap-5 lg:grid-cols-2">
        <SetupSection title={`Brands (${data.brands.length})`}>
          <div className="flex min-h-24 flex-wrap content-start gap-2 p-4">
            {data.brands.length > 0 ? (
              data.brands.map((brand) => (
                <Badge key={brand.id} variant="outline">
                  {brand.name}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">
                No brand usage
              </span>
            )}
          </div>
        </SetupSection>
        <SetupSection title={`Generated variants (${data.variants.length})`}>
          <div className="flex min-h-24 flex-wrap content-start gap-2 p-4">
            {data.variants.length > 0 ? (
              data.variants.map((variant) => (
                <Badge key={variant.id} variant="outline">
                  {variant.unitLabel}
                  {variant.packType ? ` · ${variant.packType}` : ""}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">
                No generated variant usage
              </span>
            )}
          </div>
        </SetupSection>
      </div>
    </div>
  );
}
