"use client";

import { useState } from "react";
import { Package, Search, AlertCircle } from "lucide-react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useMyRetailProducts } from "@/hooks/use-shop-owner-api";

export default function ShopProductsPage() {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const { data, isLoading, isError } = useMyRetailProducts({
        search: search || undefined,
        page,
        limit: 20,
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Products</h1>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search products..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        className="pl-9"
                    />
                </div>
            </div>

            {isLoading ? (
                <ProductsTableSkeleton />
            ) : isError ? (
                <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
                    <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">
                        Failed to load products
                    </p>
                </div>
            ) : !data?.items || data.items.length === 0 ? (
                <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">
                        No products in your catalog yet
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                        Products appear here after B2B orders are delivered and
                        stock is converted to retail.
                    </p>
                </div>
            ) : (
                <>
                    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[60px]">
                                        Image
                                    </TableHead>
                                    <TableHead>Product</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="text-right">
                                        Stock
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Cost Price
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Status
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.items.map((item: any) => {
                                    const prod = item.variant?.product;
                                    const variant = item.variant;
                                    const img =
                                        prod?.images?.[0]?.url || prod?.image;

                                    return (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                {img ? (
                                                    <Image
                                                        src={img}
                                                        alt={
                                                            prod?.name ||
                                                            "Product"
                                                        }
                                                        width={40}
                                                        height={40}
                                                        className="rounded object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                                                        <Package className="w-5 h-5 text-gray-300" />
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium text-sm">
                                                        {prod?.name || "—"}
                                                    </p>
                                                    {variant?.quantitySelectorLabel && (
                                                        <p className="text-xs text-gray-500">
                                                            {
                                                                variant.quantitySelectorLabel
                                                            }
                                                        </p>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-500">
                                                {variant?.sku || "—"}
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-500">
                                                {prod?.category?.name || "—"}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                {item.quantity ?? 0}
                                            </TableCell>
                                            <TableCell className="text-right text-sm">
                                                ৳
                                                {Number(
                                                    variant?.price ||
                                                    prod?.price ||
                                                    0,
                                                ).toLocaleString("en-BD")}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {(item.quantity ?? 0) > 0 ? (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-emerald-600 border-emerald-200 bg-emerald-50"
                                                    >
                                                        In Stock
                                                    </Badge>
                                                ) : (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-red-600 border-red-200 bg-red-50"
                                                    >
                                                        Out of Stock
                                                    </Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {data.pagination && data.pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between px-2">
                            <p className="text-sm text-gray-500">
                                Showing {data.items.length} of{" "}
                                {data.pagination.totalCount} products
                            </p>
                            <div className="flex gap-1">
                                {Array.from(
                                    {
                                        length: data.pagination.totalPages,
                                    },
                                    (_, i) => i + 1,
                                ).map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${p === page
                                                ? "bg-primary text-white border-primary"
                                                : "bg-white text-gray-700 hover:bg-gray-50"
                                            }`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function ProductsTableSkeleton() {
    return (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[60px]">Image</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right">
                            Cost Price
                        </TableHead>
                        <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell>
                                <Skeleton className="w-10 h-10 rounded" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-32" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-20" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-24" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-12 ml-auto" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-16 ml-auto" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-5 w-16 ml-auto" />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
