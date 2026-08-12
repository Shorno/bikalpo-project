"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Power, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";
import {
  ActiveStatusBadge,
  SetupDeleteDialog,
  SetupDetailHeader,
  SetupErrorState,
  SetupSection,
} from "@/components/features/product-setup";
import EditTypeDialog from "@/components/features/product-type/components/edit-type-dialog";
import { TypeSellerRankingTable } from "@/components/features/product-type/components/type-seller-ranking-table";
import {
  normalizeTypeSellerRole,
  TypeSellerTabs,
} from "@/components/features/product-type/components/type-seller-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ADMIN_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";

export default function TypeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = Number(params.id);
  const [showDelete, setShowDelete] = useState(false);
  const [roleParam, setRoleParam] = useQueryState(
    "role",
    parseAsString.withDefault("retailer").withOptions({ clearOnDefault: true }),
  );
  const activeRole = normalizeTypeSellerRole(roleParam);
  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ["adminProductType", "getById", id],
    queryFn: () => orpc.adminProductType.getById.call({ id }),
    enabled: Number.isFinite(id),
  });
  const toggleMutation = useMutation({
    mutationFn: () => orpc.adminProductType.toggleActive.call({ id }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["adminProductType"] });
      toast.success(result.message);
    },
    onError: (error) => toast.error(error.message || "Failed to update status"),
  });
  const deleteMutation = useMutation({
    mutationFn: () => orpc.adminProductType.delete.call({ id }),
    onSuccess: (result) => {
      toast.success(result.message);
      router.push(`${ADMIN_BASE}/types`);
    },
    onError: (error) => toast.error(error.message || "Failed to delete Type"),
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (isError) return <SetupErrorState onRetry={() => void refetch()} />;

  const type = data?.type;
  if (!type) return null;
  const categories = type.categories ?? [];
  const typeForDialog = {
    ...type,
    categoryCount: categories.length,
  };

  return (
    <div className="space-y-5">
      <SetupDetailHeader
        actions={
          <>
            <EditTypeDialog type={typeForDialog} />
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
              {type.isActive ? "Disable" : "Enable"}
            </Button>
            <Button onClick={() => setShowDelete(true)} variant="destructive">
              <Trash2 aria-hidden="true" className="size-4" />
              Delete
            </Button>
          </>
        }
        backHref={`${ADMIN_BASE}/types`}
        backLabel="Back to types"
        name={type.name}
        status={<ActiveStatusBadge isActive={type.isActive} />}
      />

      <SetupDeleteDialog
        dependencyMessage={
          categories.length > 0
            ? `${categories.length} categories still depend on this Type. Reassign or remove them before deletion.`
            : undefined
        }
        description="This permanently removes the Type. Existing dependencies are never cascaded."
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onOpenChange={setShowDelete}
        open={showDelete}
        title={`Delete ${type.name}?`}
      />

      <SetupSection title="Used by sellers">
        <dl className="px-4 py-4">
          <div className="flex min-h-11 items-center justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Total Users</dt>
            <dd className="font-mono text-sm font-semibold tabular-nums">
              {data.sellerCount.toLocaleString()}
            </dd>
          </div>
        </dl>
      </SetupSection>

      <SetupSection title="User ranking">
        <TypeSellerTabs
          onValueChange={(role) => void setRoleParam(role)}
          value={activeRole}
        >
          {(role, label) => (
            <TypeSellerRankingTable
              footer={
                <div className="flex justify-end border-t px-4 py-3">
                  <Button asChild className="h-11 sm:h-9" variant="outline">
                    <Link
                      href={`${ADMIN_BASE}/types/${id}/sellers?role=${role}`}
                    >
                      View All Sellers
                    </Link>
                  </Button>
                </div>
              }
              roleLabel={label}
              rows={data.rankings[role]}
            />
          )}
        </TypeSellerTabs>
      </SetupSection>
    </div>
  );
}
