"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { LoaderCircle, Power, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import DeleteBrandDialog from "@/components/features/brand/components/delete-brand-dialog";
import EditBrandDialog from "@/components/features/brand/components/edit-brand-dialog";
import {
  ActiveStatusBadge,
  SetupDetailHeader,
  SetupEmptySection,
  SetupEntityTable,
  SetupErrorState,
  SetupSection,
} from "@/components/features/product-setup";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ADMIN_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";

interface BrandCoreIdentityRow {
  id: number;
  name: string;
  category: {
    id: number;
    name: string;
    type: { id: number; name: string } | null;
  };
  subCategory: { id: number; name: string } | null;
}

const coreIdentityColumns: ColumnDef<BrandCoreIdentityRow, unknown>[] = [
  {
    id: "rowNumber",
    header: "#",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums">{row.index + 1}</span>
    ),
  },
  {
    id: "type",
    header: "Type",
    enableSorting: false,
    cell: ({ row }) => row.original.category.type?.name ?? "Legacy unassigned",
  },
  {
    id: "category",
    header: "Category",
    enableSorting: false,
    cell: ({ row }) => row.original.category.name,
  },
  {
    id: "subCategory",
    header: "Sub Category",
    enableSorting: false,
    cell: ({ row }) => row.original.subCategory?.name ?? "—",
  },
  {
    accessorKey: "name",
    header: "Core Product Name",
    enableSorting: false,
    cell: ({ row }) => (
      <Link
        className="font-medium hover:text-primary hover:underline"
        href={`${ADMIN_BASE}/core-products/${row.original.id}`}
      >
        {row.original.name}
      </Link>
    ),
  },
];

export default function BrandDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = Number(params.id);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const {
    data: brand,
    isError,
    isLoading,
    refetch,
  } = useQuery(orpc.brand.getAdminById.queryOptions({ input: { id } }));
  const toggleMutation = useMutation({
    mutationFn: () => orpc.brand.toggleActive.call({ id }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: orpc.brand.getAdminAll.key(),
      });
      void queryClient.invalidateQueries({
        queryKey: orpc.brand.getAdminById.key(),
      });
      toast.success(result.message);
      void refetch();
    },
    onError: (error) =>
      toast.error(error.message || "Failed to update Brand status."),
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (isError) return <SetupErrorState onRetry={() => void refetch()} />;
  if (!brand) return null;

  const packVariants = brand.variants
    .filter((variant) => variant.variantType === "pack")
    .map((variant) => variant.name)
    .sort((a, b) => a.localeCompare(b));
  const looseVariants = brand.variants.filter(
    (variant) => variant.variantType === "loose",
  );
  const looseUnits = [
    ...new Set(looseVariants.map((variant) => variant.unit).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  const categoryCoverage =
    brand.categories.length > 0
      ? brand.categories.map((item) => item.name).join(", ")
      : "No category usage";

  return (
    <div className="space-y-5">
      <SetupDetailHeader
        actions={
          <>
            <Button onClick={() => setShowEdit(true)} variant="outline">
              Edit
            </Button>
            <Button
              disabled={toggleMutation.isPending}
              onClick={() => toggleMutation.mutate()}
              variant="outline"
            >
              {toggleMutation.isPending ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              ) : (
                <Power aria-hidden="true" className="size-4" />
              )}
              {brand.isActive ? "Disable" : "Enable"}
            </Button>
            <Button onClick={() => setShowDelete(true)} variant="destructive">
              <Trash2 aria-hidden="true" className="size-4" />
              Delete
            </Button>
          </>
        }
        backHref={`${ADMIN_BASE}/brands`}
        backLabel="Back to Brands"
        code={brand.skuCode ?? brand.slug}
        hierarchy={categoryCoverage}
        name={brand.name}
        status={<ActiveStatusBadge isActive={brand.isActive} />}
      />
      <EditBrandDialog
        brand={brand}
        onOpenChange={setShowEdit}
        open={showEdit}
      />
      <DeleteBrandDialog
        brand={{ ...brand, variantCount: brand.variants.length }}
        onDeleted={() => router.push(`${ADMIN_BASE}/brands`)}
        onOpenChange={setShowDelete}
        open={showDelete}
      />

      <section className="space-y-3" aria-labelledby="core-product-list-title">
        <div className="border-b pb-3">
          <h2 className="text-sm font-semibold" id="core-product-list-title">
            Core Product List
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Core Product Identities currently configured with this Brand.
          </p>
        </div>
        <SetupEntityTable
          columns={coreIdentityColumns}
          data={brand.coreIdentities}
          emptyDescription="Core Products will appear here after this Brand is configured on a product."
          emptyTitle="No Core Products found"
          getRowId={(row) => String(row.id)}
          mobile={{
            href: (row) => `${ADMIN_BASE}/core-products/${row.id}`,
            title: (row) => row.name,
            description: (row) =>
              [
                row.category.type?.name,
                row.category.name,
                row.subCategory?.name,
              ]
                .filter(Boolean)
                .join(" / "),
          }}
          pageSizeOptions={[10, 20, 50]}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <SetupSection title="Variant Structure">
          {brand.variants.length === 0 ? (
            <SetupEmptySection
              description="Pack and Loose variants will appear after products use this Brand."
              title="No variant structure"
            />
          ) : (
            <dl className="divide-y">
              <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-muted-foreground">Pack Variants</dt>
                <dd className="text-right text-sm font-medium">
                  {packVariants.length > 0
                    ? packVariants.join(", ")
                    : "None configured"}
                </dd>
              </div>
              <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-muted-foreground">Loose</dt>
                <dd className="text-right text-sm font-medium">
                  {looseVariants.length > 0
                    ? `Enabled${looseUnits.length > 0 ? ` (${looseUnits.join(", ")})` : ""}`
                    : "Disabled"}
                </dd>
              </div>
            </dl>
          )}
        </SetupSection>

        <SetupSection title="Usage Insight">
          <dl className="divide-y">
            <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3">
              <dt className="text-sm text-muted-foreground">
                Used In Products
              </dt>
              <dd className="font-mono text-sm font-semibold tabular-nums">
                {brand.productCount.toLocaleString()} Product
                {brand.productCount === 1 ? "" : "s"}
              </dd>
            </div>
            <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3">
              <dt className="text-sm text-muted-foreground">Top Variant</dt>
              <dd className="text-right text-sm font-medium">
                {brand.topSellingVariant?.name ?? "No delivered-order data yet"}
              </dd>
            </div>
          </dl>
        </SetupSection>
      </div>
    </div>
  );
}
