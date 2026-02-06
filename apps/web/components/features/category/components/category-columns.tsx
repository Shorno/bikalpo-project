"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  FolderTree,
  MoreHorizontal,
} from "lucide-react";
import Image from "next/image";
import DeleteCategoryDialog from "@/components/features/category/components/delete-category-dialog";
import EditCategoryDialog from "@/components/features/category/components/edit-category-dialog";
import NewSubcategoryDialog from "@/components/features/subcategory/components/new-subcategory-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Category, SubCategory } from "@/db/schema/category";
import { cn } from "@/lib/utils";

export interface CategoryWithSubcategories extends Category {
  subCategory: SubCategory[];
}

export function useCategoryColumns() {
  const columns: ColumnDef<CategoryWithSubcategories>[] = [
    {
      id: "expand",
      header: () => null,
      cell: ({ row }) => {
        const hasSubcategories = row.original.subCategory.length > 0;

        return (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0 transition-all duration-200",
              hasSubcategories
                ? "hover:bg-primary/10"
                : "text-muted-foreground/50 hover:text-muted-foreground",
            )}
            onClick={() => row.toggleExpanded()}
          >
            {row.getIsExpanded() ? (
              <ChevronDown className="h-4 w-4 transition-transform duration-200" />
            ) : (
              <ChevronRight className="h-4 w-4 transition-transform duration-200" />
            )}
          </Button>
        );
      },
      size: 40,
    },
    {
      accessorKey: "image",
      header: "Image",
      cell: ({ row }) => (
        <div className="w-14 h-14 relative rounded-lg overflow-hidden border shadow-sm">
          <Image
            src={row.getValue("image")}
            alt={row.getValue("name")}
            fill
            className="object-cover"
          />
        </div>
      ),
      enableSorting: false,
      size: 80,
    },
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              Name
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        );
      },
      cell: ({ row }) => (
        <div className="text-center font-medium">{row.getValue("name")}</div>
      ),
    },
    {
      accessorKey: "slug",
      header: () => <div className="text-center">Slug</div>,
      cell: ({ row }) => (
        <div className="text-center text-muted-foreground font-mono text-sm">
          {row.getValue("slug")}
        </div>
      ),
    },
    {
      accessorKey: "isActive",
      header: () => <div className="text-center">Status</div>,
      cell: ({ row }) => {
        const isActive = row.getValue("isActive") as boolean;
        return (
          <div className="flex justify-center">
            <Badge
              variant={isActive ? "default" : "secondary"}
              className={cn(
                "transition-colors",
                isActive && "bg-green-600 hover:bg-green-700",
              )}
            >
              {isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        );
      },
      size: 100,
    },
    {
      accessorKey: "displayOrder",
      header: ({ column }) => {
        return (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              Display Order
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        );
      },
      cell: ({ row }) => (
        <div className="text-center">
          <Badge variant="outline" className="font-mono">
            {row.getValue("displayOrder")}
          </Badge>
        </div>
      ),
      size: 150,
    },
    {
      id: "subcategories",
      header: () => <div className="text-center">Subcategories</div>,
      cell: ({ row }) => {
        const category = row.original;
        const count = category.subCategory.length;
        const hasSubcategories = count > 0;

        return (
          <div className="flex justify-center items-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-auto py-1 px-2 gap-1.5",
                      hasSubcategories
                        ? "text-primary hover:text-primary"
                        : "text-muted-foreground",
                    )}
                    onClick={() => row.toggleExpanded()}
                  >
                    <FolderTree className="h-4 w-4" />
                    <Badge
                      variant={hasSubcategories ? "default" : "secondary"}
                      className={cn(
                        "font-normal min-w-[1.5rem] justify-center",
                        hasSubcategories && "bg-primary/90",
                      )}
                    >
                      {count}
                    </Badge>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {hasSubcategories
                    ? `Click to ${row.getIsExpanded() ? "collapse" : "expand"} ${count} subcategories`
                    : "No subcategories yet - click to add one"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      },
      size: 150,
    },
    {
      id: "actions",
      header: () => <div className="text-center">Actions</div>,
      enableHiding: false,
      cell: ({ row }) => {
        const category = row.original;

        return (
          <div className="flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <NewSubcategoryDialog
                  categoryId={category.id}
                  categoryName={category.name}
                  variant="menu"
                />
                <DropdownMenuSeparator />
                <EditCategoryDialog category={category} />
                <DropdownMenuSeparator />
                <DeleteCategoryDialog category={category} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return columns;
}

// Subcategory row component for the expanded view
export function SubcategoryRow({
  subcategory,
  colSpan,
  isLast = false,
}: {
  subcategory: SubCategory;
  colSpan: number;
  isLast?: boolean;
}) {
  return (
    <tr
      className={cn(
        "bg-muted/20 transition-colors hover:bg-muted/40 group",
        isLast ? "border-b" : "border-b border-muted/30",
      )}
    >
      <td className="p-2 pl-4" colSpan={colSpan}>
        <div className="flex items-center gap-4">
          {/* Tree connector */}
          <div className="flex items-center gap-2 text-muted-foreground/50">
            <div className="w-6 h-px bg-border" />
            <div className="text-xs">└</div>
          </div>

          {/* Subcategory Image */}
          <div className="w-10 h-10 relative flex-shrink-0 rounded-md overflow-hidden border shadow-sm">
            <Image
              src={subcategory.image}
              alt={subcategory.name}
              fill
              className="object-cover"
            />
          </div>

          {/* Subcategory Info */}
          <div className="flex-1 flex items-center gap-4">
            <div className="min-w-[120px]">
              <span className="font-medium">{subcategory.name}</span>
            </div>
            <div className="text-muted-foreground text-sm font-mono min-w-[100px]">
              {subcategory.slug}
            </div>
            <Badge
              variant={subcategory.isActive ? "default" : "secondary"}
              className={cn(
                "text-xs",
                subcategory.isActive && "bg-green-600 hover:bg-green-700",
              )}
            >
              {subcategory.isActive ? "Active" : "Inactive"}
            </Badge>
            <Badge variant="outline" className="text-xs font-mono">
              Order: {subcategory.displayOrder}
            </Badge>
          </div>

          {/* Subcategory Actions - visible on hover */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <EditSubcategoryButton subcategory={subcategory} />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Edit subcategory</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <DeleteSubcategoryButton subcategory={subcategory} />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Delete subcategory</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </td>
    </tr>
  );
}

// Empty state row for categories without subcategories
export function EmptySubcategoryRow({
  categoryId,
  categoryName,
  colSpan,
}: {
  categoryId: number;
  categoryName: string;
  colSpan: number;
}) {
  return (
    <tr className="bg-muted/10 border-b">
      <td className="p-6" colSpan={colSpan}>
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <FolderTree className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              No subcategories yet
            </p>
            <p className="text-xs text-muted-foreground/70">
              Add the first subcategory to {categoryName}
            </p>
          </div>
          <NewSubcategoryDialog
            categoryId={categoryId}
            categoryName={categoryName}
            variant="default"
          />
        </div>
      </td>
    </tr>
  );
}

// Add subcategory row component - shown at the bottom of expanded section
export function AddSubcategoryRow({
  categoryId,
  categoryName,
  colSpan,
}: {
  categoryId: number;
  categoryName: string;
  colSpan: number;
}) {
  return (
    <tr className="bg-muted/10 border-b border-dashed">
      <td className="p-3 pl-4" colSpan={colSpan}>
        <div className="flex items-center gap-2 text-muted-foreground/50">
          <div className="w-6 h-px bg-border" />
          <div className="text-xs">└</div>
          <NewSubcategoryDialog
            categoryId={categoryId}
            categoryName={categoryName}
            variant="expanded"
          />
        </div>
      </td>
    </tr>
  );
}

import DeleteSubcategoryDialog from "@/components/features/subcategory/components/delete-subcategory-dialog";
// Separate components for subcategory actions to avoid circular imports
import EditSubcategoryDialog from "@/components/features/subcategory/components/edit-subcategory-dialog";

function EditSubcategoryButton({ subcategory }: { subcategory: SubCategory }) {
  return <EditSubcategoryDialog subcategory={subcategory} variant="icon" />;
}

function DeleteSubcategoryButton({
  subcategory,
}: {
  subcategory: SubCategory;
}) {
  return <DeleteSubcategoryDialog subcategory={subcategory} variant="icon" />;
}
