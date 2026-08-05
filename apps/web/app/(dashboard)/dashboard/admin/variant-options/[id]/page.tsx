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
import VariantOptionDialog from "@/components/features/variant-option/components/variant-option-dialog";
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

export default function VariantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [showEdit, setShowEdit] = useState(false);
  const { data, isError, isLoading, refetch } = useQuery(
    orpc.adminVariantOption.getById.queryOptions({ input: { id } }),
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
  const option = data?.variantOption;
  if (!option) return null;

  return (
    <div className="space-y-5">
      <SetupDetailHeader
        actions={
          <Button onClick={() => setShowEdit(true)}>Edit Variant</Button>
        }
        backHref={`${ADMIN_BASE}/variant-options`}
        backLabel="Back to variants"
        code={option.skuCode ?? option.canonicalSignature ?? undefined}
        hierarchy={[option.type?.name, option.category?.name]
          .filter(Boolean)
          .join(" / ")}
        name={option.name}
        status={<ActiveStatusBadge isActive={option.isActive} />}
      />
      <VariantOptionDialog
        mode="edit"
        onOpenChange={setShowEdit}
        open={showEdit}
        variantOption={option}
      />

      <SetupMetricStrip
        metrics={[
          { label: "Core Identities", value: option.coreIdentityUsageCount },
          { label: "Products", value: option.productUsageCount },
          {
            label: "Delivered orders",
            value: option.salesUsage.deliveredOrders,
          },
          { label: "Delivered units", value: option.salesUsage.deliveredUnits },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <SetupSection
          description="Structured source of truth used for validation and generated variants."
          title="Canonical definition"
        >
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Definition kind</dt>
              <dd className="mt-1 capitalize">
                {option.definitionKind ?? "Legacy"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Pack / Loose</dt>
              <dd className="mt-1 capitalize">{option.variantType}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Unit</dt>
              <dd className="mt-1 font-mono">{option.unit}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Size</dt>
              <dd className="mt-1 font-mono">{option.size ?? "—"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">
                Canonical signature
              </dt>
              <dd className="mt-1 break-all font-mono text-xs">
                {option.canonicalSignature ??
                  "Legacy definition awaiting review"}
              </dd>
            </div>
          </dl>
        </SetupSection>

        <SetupSection
          description="Availability is limited to this taxonomy scope."
          title="Type and Category scope"
        >
          <dl className="grid grid-cols-2 gap-6 p-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Type</dt>
              <dd className="mt-1 font-medium">
                {option.type?.name ?? "Global"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Category</dt>
              <dd className="mt-1 font-medium">
                {option.category?.name ?? "All categories in Type"}
              </dd>
            </div>
          </dl>
        </SetupSection>
      </div>

      <SetupSection
        description="Core Identities and product records that currently use this option."
        title="Usage"
      >
        {option.configuredProducts.length === 0 ? (
          <SetupEmptySection
            description="The option is available for configuration but is not currently used."
            title="No usage yet"
          />
        ) : (
          <SetupRelatedTable>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Core Identity</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {option.configuredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.coreProduct?.name ?? "—"}</TableCell>
                  <TableCell>{product.category.name}</TableCell>
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
