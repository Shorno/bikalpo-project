"use client";

import {
    Boxes,
    AlertCircle,
    TrendingUp,
    TrendingDown,
    Package,
} from "lucide-react";
import Image from "next/image";
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
import { useMyInventory } from "@/hooks/use-shop-owner-api";

export default function InventoryPage() {
    const { data, isLoading, isError } = useMyInventory();

    // Calculate summary stats
    const items = data?.items ?? [];
    const totalItems = items.length;
    const inStockItems = items.filter((i: any) => (i.quantity ?? 0) > 0).length;
    const lowStockItems = items.filter(
        (i: any) => (i.quantity ?? 0) > 0 && (i.quantity ?? 0) <= 5,
    ).length;
    const outOfStockItems = items.filter(
        (i: any) => (i.quantity ?? 0) === 0,
    ).length;

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">Inventory</h1>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard
                    title="Total Products"
                    value={totalItems}
                    icon={<Package className="w-5 h-5 text-blue-500" />}
                    loading={isLoading}
                />
                <SummaryCard
                    title="In Stock"
                    value={inStockItems}
                    icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
                    loading={isLoading}
                />
                <SummaryCard
                    title="Low Stock"
                    value={lowStockItems}
                    icon={
                        <TrendingDown className="w-5 h-5 text-amber-500" />
                    }
                    loading={isLoading}
                />
                <SummaryCard
                    title="Out of Stock"
                    value={outOfStockItems}
                    icon={<AlertCircle className="w-5 h-5 text-red-500" />}
                    loading={isLoading}
                />
            </div>

            {isLoading ? (
                <InventoryTableSkeleton />
            ) : isError ? (
                <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
                    <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">
                        Failed to load inventory
                    </p>
                </div>
            ) : items.length === 0 ? (
                <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
                    <Boxes className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">
                        No inventory data yet
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                        Stock is auto-converted from wholesale (TRADE) to retail
                        (RETAIL) when B2B orders are delivered.
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60px]">
                                    Image
                                </TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead>Variant</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right">
                                    Quantity
                                </TableHead>
                                <TableHead className="text-right">
                                    Status
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item: any) => {
                                const prod = item.variant?.product;
                                const variant = item.variant;
                                const img =
                                    prod?.images?.[0]?.url || prod?.image;
                                const qty = item.quantity ?? 0;

                                const stockStatus =
                                    qty === 0
                                        ? "out"
                                        : qty <= 5
                                            ? "low"
                                            : "ok";

                                return (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            {img ? (
                                                <Image
                                                    src={img}
                                                    alt={
                                                        prod?.name || "Product"
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
                                        <TableCell className="font-medium text-sm">
                                            {prod?.name || "—"}
                                        </TableCell>
                                        <TableCell className="text-sm text-gray-500">
                                            {variant?.quantitySelectorLabel ||
                                                variant?.sku ||
                                                "—"}
                                        </TableCell>
                                        <TableCell className="text-sm text-gray-500">
                                            {prod?.category?.name || "—"}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {qty}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {stockStatus === "out" ? (
                                                <Badge
                                                    variant="outline"
                                                    className="text-red-600 border-red-200 bg-red-50"
                                                >
                                                    Out of Stock
                                                </Badge>
                                            ) : stockStatus === "low" ? (
                                                <Badge
                                                    variant="outline"
                                                    className="text-amber-600 border-amber-200 bg-amber-50"
                                                >
                                                    Low Stock
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant="outline"
                                                    className="text-emerald-600 border-emerald-200 bg-emerald-50"
                                                >
                                                    In Stock
                                                </Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}

function SummaryCard({
    title,
    value,
    icon,
    loading,
}: {
    title: string;
    value: number;
    icon: React.ReactNode;
    loading: boolean;
}) {
    return (
        <div className="bg-white rounded-lg border shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-500">{title}</p>
                {icon}
            </div>
            {loading ? (
                <Skeleton className="h-8 w-16" />
            ) : (
                <p className="text-2xl font-bold">{value}</p>
            )}
        </div>
    );
}

function InventoryTableSkeleton() {
    return (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[60px]">Image</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Variant</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
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
                                <Skeleton className="h-4 w-24" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-24" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-12 ml-auto" />
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
