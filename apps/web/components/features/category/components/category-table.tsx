"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  MoreHorizontal,
} from "lucide-react";
import Image from "next/image";
import * as React from "react";
import DeleteCategoryDialog from "@/components/features/category/components/delete-category-dialog";
import EditCategoryDialog from "@/components/features/category/components/edit-category-dialog";
import NewCategoryDialog from "@/components/features/category/components/new-category-dialog";
import DeleteSubcategoryDialog from "@/components/features/subcategory/components/delete-subcategory-dialog";
import EditSubcategoryDialog from "@/components/features/subcategory/components/edit-subcategory-dialog";
import NewSubcategoryDialog from "@/components/features/subcategory/components/new-subcategory-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  AddSubcategoryRow,
  type CategoryWithSubcategories,
  EmptySubcategoryRow,
  SubcategoryRow,
} from "./category-columns";

interface DataTableProps {
  columns: ColumnDef<CategoryWithSubcategories, unknown>[];
  data: CategoryWithSubcategories[];
}

// Mobile Category Card Component
function MobileCategoryCard({
  category,
  isExpanded,
  onToggleExpand,
}: {
  category: CategoryWithSubcategories;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const hasSubcategories = category.subCategory.length > 0;

  return (
    <Card
      className={cn(
        "overflow-hidden p-0",
        isExpanded && "ring-2 ring-primary/20",
      )}
    >
      <CardContent className="p-0">
        {/* Main Category Row */}
        <div className="flex items-center gap-3 p-4">
          {/* Expand Button */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0 shrink-0",
              hasSubcategories
                ? "hover:bg-primary/10"
                : "text-muted-foreground/50",
            )}
            onClick={onToggleExpand}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>

          {/* Image */}
          <div className="w-12 h-12 relative rounded-lg overflow-hidden border shadow-sm shrink-0">
            <Image
              src={category.image}
              alt={category.name}
              fill
              className="object-cover"
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{category.name}</h3>
            <p className="text-xs text-muted-foreground font-mono truncate">
              {category.slug}
            </p>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant={category.isActive ? "default" : "secondary"}
              className={cn("text-xs", category.isActive && "bg-green-600")}
            >
              {category.isActive ? "Active" : "Inactive"}
            </Badge>

            {/* Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
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
        </div>

        {/* Subcategory Count Bar */}
        <div
          className={cn(
            "flex items-center justify-between px-4 py-2 bg-muted/30 border-t cursor-pointer",
            "hover:bg-muted/50 transition-colors",
          )}
          onClick={onToggleExpand}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FolderTree className="h-4 w-4" />
            <span>
              {hasSubcategories
                ? `${category.subCategory.length} subcategories`
                : "No subcategories"}
            </span>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            Order: {category.displayOrder}
          </Badge>
        </div>

        {/* Expanded Subcategories */}
        {isExpanded && (
          <div className="border-t bg-muted/10">
            {hasSubcategories ? (
              <>
                {category.subCategory.map((sub) => (
                  <MobileSubcategoryRow key={sub.id} subcategory={sub} />
                ))}
                <div className="p-3 border-t border-dashed">
                  <NewSubcategoryDialog
                    categoryId={category.id}
                    categoryName={category.name}
                    variant="expanded"
                  />
                </div>
              </>
            ) : (
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <FolderTree className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  No subcategories yet
                </p>
                <NewSubcategoryDialog
                  categoryId={category.id}
                  categoryName={category.name}
                  variant="default"
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Mobile Subcategory Row
function MobileSubcategoryRow({
  subcategory,
}: {
  subcategory: CategoryWithSubcategories["subCategory"][0];
}) {
  return (
    <div className="flex items-center gap-3 p-3 border-t hover:bg-muted/20 transition-colors">
      {/* Tree connector */}
      <div className="text-muted-foreground/40 text-xs pl-2">└</div>

      {/* Image */}
      <div className="w-10 h-10 relative rounded-md overflow-hidden border shrink-0">
        <Image
          src={subcategory.image}
          alt={subcategory.name}
          fill
          className="object-cover"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{subcategory.name}</p>
        <p className="text-xs text-muted-foreground font-mono truncate">
          {subcategory.slug}
        </p>
      </div>

      {/* Status & Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Badge
          variant={subcategory.isActive ? "default" : "secondary"}
          className={cn("text-xs", subcategory.isActive && "bg-green-600")}
        >
          {subcategory.isActive ? "Active" : "Inactive"}
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <EditSubcategoryDialog subcategory={subcategory} />
            <DropdownMenuSeparator />
            <DeleteSubcategoryDialog subcategory={subcategory} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function CategoryTable({ columns, data }: DataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [expanded, setExpanded] = React.useState<ExpandedState>({});
  const [mobileExpanded, setMobileExpanded] = React.useState<Set<number>>(
    new Set(),
  );
  const [filterValue, setFilterValue] = React.useState("");

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onExpandedChange: setExpanded,
    getRowCanExpand: () => true,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      expanded,
    },
  });

  // Filter categories for mobile view
  const filteredData = React.useMemo(() => {
    if (!filterValue) return data;
    return data.filter((cat) =>
      cat.name.toLowerCase().includes(filterValue.toLowerCase()),
    );
  }, [data, filterValue]);

  const toggleMobileExpand = (categoryId: number) => {
    setMobileExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  return (
    <div className="w-full">
      {/* Header with filter and add button */}
      <div className="flex items-center justify-between py-4 gap-2">
        <Input
          placeholder="Filter by name..."
          value={filterValue}
          onChange={(event) => {
            setFilterValue(event.target.value);
            table.getColumn("name")?.setFilterValue(event.target.value);
          }}
          className="max-w-sm"
        />
        <NewCategoryDialog />
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/50">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="font-semibold">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <React.Fragment key={row.id}>
                  <TableRow
                    data-state={row.getIsSelected() && "selected"}
                    className={
                      row.getIsExpanded()
                        ? "border-b-0 bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-muted/50 transition-colors"
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-3">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>

                  {row.getIsExpanded() && (
                    // biome-ignore lint/complexity/noUselessFragments: no issue
                    <>
                      {row.original.subCategory.length > 0 ? (
                        <>
                          {row.original.subCategory.map(
                            (subcategory, index) => (
                              <SubcategoryRow
                                key={subcategory.id}
                                subcategory={subcategory}
                                colSpan={columns.length}
                                isLast={
                                  index === row.original.subCategory.length - 1
                                }
                              />
                            ),
                          )}
                          <AddSubcategoryRow
                            categoryId={row.original.id}
                            categoryName={row.original.name}
                            colSpan={columns.length}
                          />
                        </>
                      ) : (
                        <EmptySubcategoryRow
                          categoryId={row.original.id}
                          categoryName={row.original.name}
                          colSpan={columns.length}
                        />
                      )}
                    </>
                  )}
                </React.Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {filteredData.length > 0 ? (
          filteredData.map((category) => (
            <MobileCategoryCard
              key={category.id}
              category={category}
              isExpanded={mobileExpanded.has(category.id)}
              onToggleExpand={() => toggleMobileExpand(category.id)}
            />
          ))
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No categories found.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pagination (Desktop only for now) */}
      <div className="hidden md:flex items-center justify-end space-x-2 py-4">
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
