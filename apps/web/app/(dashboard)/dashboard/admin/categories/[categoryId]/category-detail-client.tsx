"use client";

import type { SubCategory } from "@bikalpo-project/db/schema";
import { useState } from "react";
import type { CategoryWithSubcategories } from "@/components/features/category/components/category-columns";
import EditCategoryDialog from "@/components/features/category/components/edit-category-dialog";
import {
  ActiveStatusBadge,
  SetupDetailHeader,
  SetupEmptySection,
  SetupMetricStrip,
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

interface CategoryProduct {
  id: number;
  name: string;
  slug: string;
  size: string;
  status: string;
  subCategory?: { id: number; name: string } | null;
}

interface CategoryDetail extends CategoryWithSubcategories {
  products: CategoryProduct[];
  activeSellerCount: number;
}

export default function CategoryDetailClient({
  category,
}: {
  category: CategoryDetail;
}) {
  const [showEdit, setShowEdit] = useState(false);
  const activeProducts = category.products.filter(
    (product) => product.status === "active",
  ).length;

  return (
    <div className="space-y-5">
      <SetupDetailHeader
        actions={
          <Button onClick={() => setShowEdit(true)}>Edit Category</Button>
        }
        backHref={`${ADMIN_BASE}/categories`}
        backLabel="Back to categories"
        code={category.skuCode ?? category.slug}
        hierarchy={category.type?.name ?? "Legacy unassigned Type"}
        name={category.name}
        status={<ActiveStatusBadge isActive={category.isActive} />}
      />
      <EditCategoryDialog
        category={category}
        onOpenChange={setShowEdit}
        open={showEdit}
      />

      <SetupMetricStrip
        metrics={[
          { label: "Sub Categories", value: category.subCategory.length },
          { label: "Active sellers", value: category.activeSellerCount },
          { label: "Products", value: category.products.length },
          { label: "Active products", value: activeProducts },
        ]}
      />

      <SetupSection
        description="The next level of the taxonomy under this category."
        title="Sub Category structure"
      >
        {category.subCategory.length === 0 ? (
          <SetupEmptySection
            description="Create a Sub Category to continue this taxonomy path."
            title="No Sub Categories"
          />
        ) : (
          <SetupRelatedTable>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Sub Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Display order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {category.subCategory.map((sub: SubCategory) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-mono text-xs">
                    {sub.skuCode ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">{sub.name}</TableCell>
                  <TableCell>
                    <ActiveStatusBadge isActive={sub.isActive} />
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">
                    {sub.displayOrder}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </SetupRelatedTable>
        )}
      </SetupSection>

      <SetupSection
        description={`Products currently assigned to ${category.name}.`}
        title="Product usage"
      >
        {category.products.length === 0 ? (
          <SetupEmptySection
            description="Products will appear here when they reference this category."
            title="No product usage"
          />
        ) : (
          <SetupRelatedTable>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Sub Category</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {category.products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.subCategory?.name ?? "—"}</TableCell>
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
    </div>
  );
}
