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
import { Pencil, Trash2 } from "lucide-react";
import * as React from "react";
import EditVariantOptionDialog from "@/components/features/variant-option/components/edit-variant-option-dialog";
import DeleteVariantOptionDialog from "@/components/features/variant-option/components/delete-variant-option-dialog";
import NewVariantOptionDialog from "@/components/features/variant-option/components/new-variant-option-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { type VariantOptionRow } from "./variant-option-columns";

interface DataTableProps {
  columns: ColumnDef<VariantOptionRow, unknown>[];
  data: VariantOptionRow[];
  types?: { id: number; name: string }[];
  categories?: { id: number; name: string; typeId: number | null }[];
}

// Mobile card view
function MobileVariantOptionCard({ option }: { option: VariantOptionRow }) {
  const [showEdit, setShowEdit] = React.useState(false);
  const [showDelete, setShowDelete] = React.useState(false);

  return (
    <Card className="overflow-hidden p-0">
      <CardContent className="p-0">
        <div className="flex items-center gap-3 p-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{option.name}</h3>
            <p className="text-xs text-muted-foreground">
              {option.unit}
              {option.size && ` · ${option.size}`}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {option.type ? (
              <Badge variant="secondary" className="text-xs">
                {option.type.name}
              </Badge>
            ) : (
              <Badge className="text-xs bg-purple-600">Global</Badge>
            )}
            <Badge
              variant={option.isActive ? "default" : "secondary"}
              className={cn("text-xs", option.isActive && "bg-green-600")}
            >
              {option.isActive ? "Active" : "Disabled"}
            </Badge>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowEdit(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-t text-sm text-muted-foreground">
          <span>
            {option.variantType === "pack" ? "Pack" : "Loose"}
          </span>
          {option.category && (
            <Badge variant="outline" className="text-xs">
              {option.category.name}
            </Badge>
          )}
        </div>
      </CardContent>

      <EditVariantOptionDialog
        variantOption={option}
        open={showEdit}
        onOpenChange={setShowEdit}
      />
      <DeleteVariantOptionDialog
        variantOption={option}
        open={showDelete}
        onOpenChange={setShowDelete}
      />
    </Card>
  );
}

export default function VariantOptionTable({
  columns,
  data,
  types = [],
  categories = [],
}: DataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [filterValue, setFilterValue] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [unitFilter, setUnitFilter] = React.useState<string>("all");
  const [variantTypeFilter, setVariantTypeFilter] =
    React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  // Cascade: categories filtered by selected type
  const filteredCategories = React.useMemo(() => {
    if (typeFilter === "all" || typeFilter === "global") return categories;
    return categories.filter((c) => c.typeId === Number(typeFilter));
  }, [categories, typeFilter]);

  // Reset category filter when type changes
  React.useEffect(() => {
    setCategoryFilter("all");
  }, [typeFilter]);

  // Extract unique units from data
  const units = React.useMemo(() => {
    const set = new Set(data.map((d) => d.unit));
    return Array.from(set).sort();
  }, [data]);

  // Client-side filtering
  const filteredTableData = React.useMemo(() => {
    let result = data;

    // Type filter
    if (typeFilter === "global") {
      result = result.filter((opt) => opt.typeId === null);
    } else if (typeFilter !== "all") {
      result = result.filter((opt) => opt.typeId === Number(typeFilter));
    }

    // Category filter
    if (categoryFilter !== "all") {
      result = result.filter(
        (opt) => opt.categoryId === Number(categoryFilter),
      );
    }

    // Unit filter
    if (unitFilter !== "all") {
      result = result.filter((opt) => opt.unit === unitFilter);
    }

    // Variant type filter
    if (variantTypeFilter !== "all") {
      result = result.filter((opt) => opt.variantType === variantTypeFilter);
    }

    // Status filter
    if (statusFilter === "active") {
      result = result.filter((opt) => opt.isActive);
    } else if (statusFilter === "disabled") {
      result = result.filter((opt) => !opt.isActive);
    }

    return result;
  }, [data, typeFilter, categoryFilter, unitFilter, variantTypeFilter, statusFilter]);

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

  // Mobile filter
  const filteredData = React.useMemo(() => {
    let result = filteredTableData;
    if (filterValue) {
      result = result.filter((opt) =>
        opt.name.toLowerCase().includes(filterValue.toLowerCase()),
      );
    }
    return result;
  }, [filteredTableData, filterValue]);

  return (
    <div className="w-full">
      {/* Header with filters and add button */}
      <div className="flex flex-wrap items-center justify-between py-4 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Filter by name..."
            value={filterValue}
            onChange={(event) => {
              setFilterValue(event.target.value);
              table.getColumn("name")?.setFilterValue(event.target.value);
            }}
            className="w-[180px]"
          />
          {/* Type filter (Global + types) */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="global">Global</SelectItem>
              {types.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Category filter (cascading) */}
          {typeFilter !== "all" && typeFilter !== "global" && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {filteredCategories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {/* Unit filter */}
          <Select value={unitFilter} onValueChange={setUnitFilter}>
            <SelectTrigger className="w-[110px]">
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Units</SelectItem>
              {units.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Variant type filter */}
          <Select
            value={variantTypeFilter}
            onValueChange={setVariantTypeFilter}
          >
            <SelectTrigger className="w-[110px]">
              <SelectValue placeholder="V. Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pack">Pack</SelectItem>
              <SelectItem value="loose">Loose</SelectItem>
            </SelectContent>
          </Select>
          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[110px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <NewVariantOptionDialog types={types} categories={categories} />
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/50">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="font-semibold">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
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
                  No variant options found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {filteredData.length > 0 ? (
          filteredData.map((option) => (
            <MobileVariantOptionCard key={option.id} option={option} />
          ))
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No variant options found.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pagination */}
      <div className="hidden md:flex items-center justify-end space-x-2 py-4">
        <div className="text-sm text-muted-foreground mr-4">
          {filteredTableData.length} variant(s)
        </div>
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
