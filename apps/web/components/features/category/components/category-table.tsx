"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import DeleteCategoryDialog from "@/components/features/category/components/delete-category-dialog";
import EditCategoryDialog from "@/components/features/category/components/edit-category-dialog";
import NewCategoryDialog from "@/components/features/category/components/new-category-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { type CategoryWithSubcategories } from "./category-columns";

interface DataTableProps {
  columns: ColumnDef<CategoryWithSubcategories, unknown>[];
  data: CategoryWithSubcategories[];
  types?: { id: number; name: string }[];
}

// Mobile Category Card Component
function MobileCategoryCard({
  category,
}: {
  category: CategoryWithSubcategories;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <CardContent className="p-0">
        <div className="flex items-center gap-3 p-4">
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
                <EditCategoryDialog category={category} />
                <DropdownMenuSeparator />
                <DeleteCategoryDialog category={category} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Info Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-t text-sm text-muted-foreground">
          <span>{category.subCategory.length} subcategories</span>
          <Badge variant="outline" className="font-mono text-xs">
            Order: {category.displayOrder}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CategoryTable({ columns, data, types = [] }: DataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [filterValue, setFilterValue] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  // Client-side filtered data
  const filteredTableData = React.useMemo(() => {
    let result = data;
    if (typeFilter !== "all") {
      result = result.filter((cat) => cat.typeId === Number(typeFilter));
    }
    if (statusFilter !== "all") {
      result = result.filter((cat) =>
        statusFilter === "active" ? cat.isActive : !cat.isActive,
      );
    }
    return result;
  }, [data, typeFilter, statusFilter]);

  const table = useReactTable({
    data: filteredTableData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  // Filter categories for mobile view
  const filteredData = React.useMemo(() => {
    let result = filteredTableData;
    if (filterValue) {
      result = result.filter((cat) =>
        cat.name.toLowerCase().includes(filterValue.toLowerCase()),
      );
    }
    return result;
  }, [filteredTableData, filterValue]);

  return (
    <div className="w-full">
      {/* Header with filter and add button */}
      <div className="flex flex-wrap items-center justify-between py-4 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Filter by name..."
            value={filterValue}
            onChange={(event) => {
              setFilterValue(event.target.value);
              table.getColumn("name")?.setFilterValue(event.target.value);
            }}
            className="w-[200px]"
          />
          {types.length > 0 && (
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {types.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-muted/50 transition-colors"
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
            <MobileCategoryCard key={category.id} category={category} />
          ))
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No categories found.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pagination */}
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
