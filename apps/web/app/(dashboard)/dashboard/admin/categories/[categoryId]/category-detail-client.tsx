"use client";

import type { SubCategory } from "@bikalpo-project/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Power, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { CategoryWithSubcategories } from "@/components/features/category/components/category-columns";
import DeleteCategoryDialog from "@/components/features/category/components/delete-category-dialog";
import EditCategoryDialog from "@/components/features/category/components/edit-category-dialog";
import {
  ActiveStatusBadge,
  SetupDetailHeader,
  SetupEmptySection,
  SetupRelatedTable,
  SetupSection,
} from "@/components/features/product-setup";
import { Button } from "@/components/ui/button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ADMIN_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";

interface CategoryDetail extends CategoryWithSubcategories {
  sellerCount: number;
}

export default function CategoryDetailClient({
  category,
}: {
  category: CategoryDetail;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const subCategories = [...category.subCategory].sort(
    (left, right) =>
      left.displayOrder - right.displayOrder ||
      left.name.localeCompare(right.name) ||
      left.id - right.id,
  );
  const toggleMutation = useMutation({
    mutationFn: () => orpc.category.toggleActive.call({ id: category.id }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: orpc.category.getAll.key(),
      });
      toast.success(result.message);
      router.refresh();
    },
    onError: (error) =>
      toast.error(error.message || "Failed to update Category status."),
  });

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
              {category.isActive ? "Disable" : "Enable"}
            </Button>
            <Button onClick={() => setShowDelete(true)} variant="destructive">
              <Trash2 aria-hidden="true" className="size-4" />
              Delete
            </Button>
          </>
        }
        backHref={`${ADMIN_BASE}/categories`}
        backLabel="Back to categories"
        hierarchy={
          <span>Type: {category.type?.name ?? "Legacy unassigned"}</span>
        }
        name={category.name}
        status={<ActiveStatusBadge isActive={category.isActive} />}
      />

      <EditCategoryDialog
        category={category}
        onOpenChange={setShowEdit}
        open={showEdit}
      />
      <DeleteCategoryDialog
        category={category}
        onDeleted={() => router.push(`${ADMIN_BASE}/categories`)}
        onOpenChange={setShowDelete}
        open={showDelete}
      />

      <SetupSection title="Sub Category structure">
        {subCategories.length === 0 ? (
          <SetupEmptySection
            description="Sub Categories will appear here when they are assigned to this Category."
            title="No Sub Categories"
          />
        ) : (
          <SetupRelatedTable>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Sub Category Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subCategories.map((subCategory: SubCategory) => (
                <TableRow key={subCategory.id}>
                  <TableCell>
                    <Link
                      className="font-medium hover:text-primary hover:underline"
                      href={`${ADMIN_BASE}/subcategories/${subCategory.id}`}
                    >
                      {subCategory.name}
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
              {category.sellerCount.toLocaleString()}
            </dd>
          </div>
        </dl>
      </SetupSection>
    </div>
  );
}
