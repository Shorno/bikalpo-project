"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Pencil, Power, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import DeleteCoreProductDialog from "@/components/features/core-product/components/delete-core-product-dialog";
import EditCoreProductDialog from "@/components/features/core-product/components/edit-core-product-dialog";
import {
  ActiveStatusBadge,
  SetupDetailHeader,
  SetupErrorState,
  SetupSection,
} from "@/components/features/product-setup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ADMIN_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";

export default function CoreProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = Number(params.id);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const { data, isError, isLoading, refetch } = useQuery(
    orpc.adminCoreProduct.getById.queryOptions({ input: { id } }),
  );
  const toggleMutation = useMutation({
    mutationFn: () => orpc.adminCoreProduct.toggleActive.call({ id }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: orpc.adminCoreProduct.getAll.key(),
      });
      toast.success(result.message);
      void refetch();
    },
    onError: (error) =>
      toast.error(error.message || "Failed to update Core Identity status."),
  });

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

  const configuredVariantTypes = [
    identity.packVariantCount > 0 ? "Pack Based" : null,
    identity.looseVariantCount > 0 ? "Loose" : null,
  ].filter((type): type is string => type !== null);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <SetupDetailHeader
        backHref={`${ADMIN_BASE}/core-products`}
        backLabel="Back to Core Identities"
        code={`ID ${identity.id}`}
        name="Core Product Details"
      />
      <EditCoreProductDialog
        coreProduct={identity}
        onOpenChange={setShowEdit}
        open={showEdit}
      />
      <DeleteCoreProductDialog
        coreProduct={identity}
        onDeleted={() => router.push(`${ADMIN_BASE}/core-products`)}
        onOpenChange={setShowDelete}
        open={showDelete}
      />

      <section className="rounded-lg border bg-card">
        <dl className="grid gap-x-8 gap-y-5 p-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Product name</dt>
            <dd className="mt-1 font-semibold">{identity.name}</dd>
          </div>
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
            <dt className="text-xs text-muted-foreground">Status</dt>
            <dd className="mt-1">
              <ActiveStatusBadge isActive={identity.isActive} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Default Brand Support
            </dt>
            <dd className="mt-1 font-medium">
              {identity.brandCreationMode === "batch"
                ? "Multi Brand"
                : "Single Brand"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Variant Type Support
            </dt>
            <dd className="mt-1 flex flex-wrap gap-2">
              {configuredVariantTypes.length > 0 ? (
                configuredVariantTypes.map((type) => (
                  <Badge key={type} variant="outline">
                    {type}
                  </Badge>
                ))
              ) : (
                <span className="font-medium">None</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <div className="rounded-lg border bg-card p-5">
        <p className="text-xs text-muted-foreground">Used In Products</p>
        <p className="mt-1 text-lg font-semibold tabular-nums">
          {identity.configuredProducts.length.toLocaleString()}{" "}
          {identity.configuredProducts.length === 1 ? "product" : "products"}
        </p>
      </div>

      <SetupSection title="Action">
        <div className="flex flex-wrap gap-2 p-5">
          <Button onClick={() => setShowEdit(true)} variant="outline">
            <Pencil aria-hidden="true" className="size-4" />
            Edit Identity
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
            {identity.isActive ? "Disable" : "Enable"}
          </Button>
          <Button onClick={() => setShowDelete(true)} variant="destructive">
            <Trash2 aria-hidden="true" className="size-4" />
            Delete
          </Button>
        </div>
      </SetupSection>
    </div>
  );
}
