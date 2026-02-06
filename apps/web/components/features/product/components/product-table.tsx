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
import { MoreHorizontal, Package, Pencil } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import DeleteProductDialog from "@/components/features/product/components/delete-product-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import type { ProductWithRelations } from "./product-columns";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

// Mobile Product Card Component
function MobileProductCard({ product }: { product: ProductWithRelations }) {
  const [imageError, setImageError] = React.useState(false);
  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(price));
  };

  const hasValidImage =
    product.image && !imageError && product.image.trim() !== "";

  return (
    <Card className="overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-0">
      <CardContent className="p-0">
        <div className="flex gap-3 p-3">
          {/* Product Image */}
          <div className="w-16 h-16 relative rounded-lg overflow-hidden border shadow-sm shrink-0 bg-gray-100">
            {hasValidImage ? (
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-cover"
                onError={() => setImageError(true)}
                unoptimized={product.image.startsWith("http")}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-6 h-6 text-gray-400" />
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-medium text-sm truncate">{product.name}</h3>
                <p className="text-xs text-muted-foreground truncate">
                  {product.category.name}
                  {product.subCategory && ` / ${product.subCategory.name}`}
                </p>
              </div>

              {/* Actions Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/admin/products/${product.id}/edit`}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                  <DeleteProductDialog
                    productId={product.id}
                    productName={product.name}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Details Row */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {product.brand && (
                <Badge variant="outline" className="text-xs">
                  {product.brand.name}
                </Badge>
              )}
              {product.size && (
                <span className="text-xs text-muted-foreground">
                  {product.size}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer with Price and Status */}
        <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-t">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">
              {formatPrice(product.price)}
            </span>
            <span className="text-xs text-muted-foreground">
              Stock: {product.stockQuantity}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge
              variant={product.inStock ? "default" : "secondary"}
              className={cn("text-xs", product.inStock && "bg-green-600")}
            >
              {product.inStock ? "In Stock" : "Out"}
            </Badge>
            {product.isFeatured && (
              <Badge variant="outline" className="text-xs bg-yellow-50">
                ⭐
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProductTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
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
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  // Get paginated data for mobile view (uses table's pagination state)
  const paginatedMobileData = React.useMemo(() => {
    return table
      .getRowModel()
      .rows.map((row) => row.original as ProductWithRelations);
  }, [table.getRowModel]);

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
                    <TableCell key={cell.id}>
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
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Package className="h-8 w-8" />
                    <span>No products found</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {paginatedMobileData.length > 0 ? (
          paginatedMobileData.map((product) => (
            <MobileProductCard key={product.id} product={product} />
          ))
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2" />
              <span>No products found</span>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between py-4">
        <div className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()} ({data.length} products)
        </div>
        <div className="flex gap-2 ml-auto">
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
