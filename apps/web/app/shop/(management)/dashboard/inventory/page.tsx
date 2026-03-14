"use client";

import {
    Boxes,
    AlertCircle,
    TrendingUp,
    TrendingDown,
    Package,
    Plus,
    Warehouse,
    MapPin,
    Loader2,
    ExternalLink,
} from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useMyInventory } from "@/hooks/use-shop-owner-api";
import { orpc } from "@/utils/orpc";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InventoryPage() {
    const { data, isLoading, isError } = useMyInventory();
    const [modalOpen, setModalOpen] = useState(false);

    // Calculate summary stats
    const items = data?.items ?? [];
    const totalItems = items.length;
    const inStockItems = items.filter((i) => Number(i.availableQty ?? 0) > 0).length;
    const lowStockItems = items.filter(
        (i) => Number(i.availableQty ?? 0) > 0 && Number(i.availableQty ?? 0) <= 5,
    ).length;
    const outOfStockItems = items.filter(
        (i) => Number(i.availableQty ?? 0) === 0,
    ).length;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Inventory</h1>
                <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-amber-600 hover:bg-amber-700">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Product
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Add Product from Warehouse</DialogTitle>
                            <DialogDescription>
                                Paste a warehouse storefront URL to browse and order products.
                            </DialogDescription>
                        </DialogHeader>
                        <WarehouseUrlModal onClose={() => setModalOpen(false)} />
                    </DialogContent>
                </Dialog>
            </div>

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
                    <Button
                        className="mt-4 bg-amber-600 hover:bg-amber-700"
                        onClick={() => setModalOpen(true)}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Product from Warehouse
                    </Button>
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
                            {items.map((item) => {
                                const prod = item.variant?.product;
                                const variant = item.variant;
                                const img =
                                    prod?.images?.[0]?.imageUrl || prod?.image;
                                const qty = Number(item.availableQty ?? 0);

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

// ────────────────────────────────────────────────────────────────
// Warehouse URL Modal
// ────────────────────────────────────────────────────────────────

function WarehouseUrlModal({ onClose }: { onClose: () => void }) {
    const router = useRouter();
    const [url, setUrl] = useState("");
    const [parsedSlug, setParsedSlug] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Parse slug from URL like /warehouse/my-warehouse or full URL
    function parseSlug(input: string): string | null {
        const trimmed = input.trim();
        if (!trimmed) return null;

        // If it's just a slug (no slashes)
        if (!trimmed.includes("/")) return trimmed;

        // Try to extract slug from URL path
        const match = trimmed.match(/\/(?:warehouse|w)\/([^/?#]+)/);
        return match ? match[1] : null;
    }

    function handlePreview() {
        setError(null);
        const slug = parseSlug(url);
        if (!slug) {
            setError("Please enter a valid warehouse URL or slug. Example: /warehouse/my-warehouse");
            return;
        }
        setParsedSlug(slug);
    }

    // Fetch warehouse info when slug is parsed
    const { data: warehouse, isLoading, error: fetchError } = useQuery(
        orpc.warehouse.getStorefrontBySlug.queryOptions({
            input: { slug: parsedSlug! },
            enabled: !!parsedSlug,
        }),
    );

    const warehouseNotFound = fetchError && parsedSlug;

    return (
        <div className="space-y-4 pt-2">
            <div className="space-y-2">
                <label className="text-sm font-medium">Warehouse URL or Slug</label>
                <div className="flex gap-2">
                    <Input
                        placeholder="e.g. /warehouse/zenstore or zenstore"
                        value={url}
                        onChange={(e) => {
                            setUrl(e.target.value);
                            setParsedSlug(null);
                            setError(null);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && handlePreview()}
                    />
                    <Button onClick={handlePreview} disabled={!url.trim()}>
                        Preview
                    </Button>
                </div>
                {error && (
                    <p className="text-sm text-red-500">{error}</p>
                )}
            </div>

            {/* Preview Card */}
            {isLoading && parsedSlug && (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
                </div>
            )}

            {warehouseNotFound && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                    <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <p className="text-sm text-red-600 font-medium">Warehouse not found</p>
                    <p className="text-xs text-red-500 mt-1">Check the URL and try again.</p>
                </div>
            )}

            {warehouse && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                            <Warehouse className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">
                                {warehouse.warehouseName || warehouse.name}
                            </h3>
                            {warehouse.warehouseAddress && (
                                <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                                    <MapPin className="w-3 h-3" />
                                    {warehouse.warehouseAddress}
                                </p>
                            )}
                            <p className="text-sm text-amber-700 font-medium mt-1">
                                {warehouse.productCount} products available
                            </p>
                        </div>
                    </div>

                    <Button
                        className="w-full bg-amber-600 hover:bg-amber-700"
                        onClick={() => {
                            onClose();
                            // Use main domain, not shop subdomain
                            const baseUrl = window.location.origin.replace("shop.", "");
                            window.location.href = `${baseUrl}/w/${parsedSlug}`;
                        }}
                    >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Visit Warehouse Store
                    </Button>
                </div>
            )}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// Helper Components
// ────────────────────────────────────────────────────────────────

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
