"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Power, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  ActiveStatusBadge,
  SetupDetailHeader,
  SetupEmptySection,
  SetupErrorState,
  SetupRelatedTable,
  SetupSection,
} from "@/components/features/product-setup";
import DeleteSubcategoryDialog from "@/components/features/subcategory/components/delete-subcategory-dialog";
import EditSubcategoryDialog from "@/components/features/subcategory/components/edit-subcategory-dialog";
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = Number(params.subcategoryId);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const { data, isError, isLoading, refetch } = useQuery(
    orpc.adminSubcategory.getById.queryOptions({ input: { id } }),
  );
  const toggleMutation = useMutation({
    mutationFn: () => orpc.adminSubcategory.toggleActive.call({ id }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: orpc.adminSubcategory.getAllGlobal.key(),
      });
      toast.success(result.message);
      void refetch();
    },
    onError: (error) =>
      toast.error(error.message || "Failed to update Sub Category status."),
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
  const subcategory = data?.subcategory;
  if (!subcategory) return null;

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
              {subcategory.isActive ? "Disable" : "Enable"}
            </Button>
            <Button onClick={() => setShowDelete(true)} variant="destructive">
              <Trash2 aria-hidden="true" className="size-4" />
              Delete
            </Button>
          </>
        }
        backHref={`${ADMIN_BASE}/subcategories`}
        backLabel="Back to Sub Categories"
        hierarchy={`Type: ${subcategory.category.type?.name ?? "Legacy unassigned"} / Category: ${subcategory.category.name}`}
        name={subcategory.name}
        status={<ActiveStatusBadge isActive={subcategory.isActive} />}
      />
      <EditSubcategoryDialog
        onOpenChange={setShowEdit}
        open={showEdit}
        subcategory={subcategory}
      />
      <DeleteSubcategoryDialog
        onDeleted={() => router.push(`${ADMIN_BASE}/subcategories`)}
        onOpenChange={setShowDelete}
        open={showDelete}
        subcategory={subcategory}
      />

      <SetupSection title="Core Products structure">
        {data.coreProducts.length === 0 ? (
          <SetupEmptySection
            description="Core Products will appear here when assigned to this Sub Category."
            title="No Core Products"
          />
        ) : (
          <SetupRelatedTable>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Core Product Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.coreProducts.map((identity) => (
                <TableRow key={identity.id}>
                  <TableCell>
                    <Link
                      className="font-medium hover:text-primary hover:underline"
                      href={`${ADMIN_BASE}/core-products/${identity.id}`}
                    >
                      {identity.name}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </SetupRelatedTable>
        )}
      </SetupSection>

      <SetupSection title="Used by sellers">
        <dl className="px-4 py-4">
          <div className="flex min-h-11 items-center justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Total Sellers</dt>
            <dd className="font-mono text-sm font-semibold tabular-nums">
              {data.sellerCount.toLocaleString()}
            </dd>
          </div>
        </dl>
      </SetupSection>
    </div>
  );
}
