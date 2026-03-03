"use client";

import { useState } from "react";
import { DollarSign, AlertCircle, Package, Check, X, Pencil } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useMyRetailProducts, useUpdateRetailPrice } from "@/hooks/use-shop-owner-api";
import { toast } from "sonner";

export default function PricingPage() {
    const { data, isLoading, isError } = useMyRetailProducts({ limit: 50 });
    const updatePrice = useUpdateRetailPrice();
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState("");

    const items = data?.items ?? [];

    const startEdit = (inventoryId: number, currentPrice: string) => {
        setEditingId(inventoryId);
        setEditValue(currentPrice);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditValue("");
    };

    const savePrice = (inventoryId: number) => {
        if (!editValue || isNaN(Number(editValue)) || Number(editValue) <= 0) {
            toast.error("Please enter a valid price");
            return;
        }

        updatePrice.mutate(
            { inventoryId, retailPrice: editValue },
            {
                onSuccess: () => {
                    toast.success("Retail price updated");
                    setEditingId(null);
                    setEditValue("");
                },
                onError: (err: any) => {
                    toast.error(err?.message || "Failed to update price");
                },
            },
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Pricing</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Set your retail selling prices. Click the edit icon to
                        update.
                    </p>
                </div>
            </div>

            {isLoading ? (
                <PricingTableSkeleton />
            ) : isError ? (
                <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
                    <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">
                        Failed to load pricing data
                    </p>
                </div>
            ) : items.length === 0 ? (
                <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
                    <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">
                        No products to price yet
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                        Once you have retail inventory, you can set your selling
                        prices here.
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
                                <TableHead className="text-right">
                                    Cost Price
                                </TableHead>
                                <TableHead className="text-right">
                                    Retail Price
                                </TableHead>
                                <TableHead className="text-right">
                                    Margin
                                </TableHead>
                                <TableHead className="text-right">
                                    Stock
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item: any) => {
                                const prod = item.variant?.product;
                                const variant = item.variant;
                                const img =
                                    prod?.images?.[0]?.url || prod?.image;

                                const costPrice = Number(
                                    variant?.price || prod?.price || 0,
                                );
                                const retailPrice = item.retailPrice
                                    ? Number(item.retailPrice)
                                    : null;
                                const margin =
                                    retailPrice && costPrice > 0
                                        ? (
                                            ((retailPrice - costPrice) /
                                                costPrice) *
                                            100
                                        ).toFixed(1)
                                        : null;
                                const isEditing = editingId === item.id;

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
                                        <TableCell className="text-right text-sm">
                                            ৳
                                            {costPrice.toLocaleString("en-BD")}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {isEditing ? (
                                                <div className="flex items-center justify-end gap-1">
                                                    <Input
                                                        type="number"
                                                        value={editValue}
                                                        onChange={(e) =>
                                                            setEditValue(
                                                                e.target.value,
                                                            )
                                                        }
                                                        className="w-24 h-8 text-right text-sm"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (
                                                                e.key ===
                                                                "Enter"
                                                            )
                                                                savePrice(
                                                                    item.id,
                                                                );
                                                            if (
                                                                e.key ===
                                                                "Escape"
                                                            )
                                                                cancelEdit();
                                                        }}
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={() =>
                                                            savePrice(item.id)
                                                        }
                                                        disabled={
                                                            updatePrice.isPending
                                                        }
                                                    >
                                                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={cancelEdit}
                                                    >
                                                        <X className="h-3.5 w-3.5 text-gray-400" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-1">
                                                    <span className="text-sm font-medium">
                                                        {retailPrice
                                                            ? `৳${retailPrice.toLocaleString("en-BD")}`
                                                            : "Not set"}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={() =>
                                                            startEdit(
                                                                item.id,
                                                                retailPrice?.toString() ||
                                                                costPrice.toString(),
                                                            )
                                                        }
                                                    >
                                                        <Pencil className="h-3.5 w-3.5 text-gray-400" />
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {margin !== null ? (
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        Number(margin) > 0
                                                            ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                                                            : "text-red-600 border-red-200 bg-red-50"
                                                    }
                                                >
                                                    {Number(margin) > 0
                                                        ? "+"
                                                        : ""}
                                                    {margin}%
                                                </Badge>
                                            ) : (
                                                <span className="text-xs text-gray-400">
                                                    Set price first
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right text-sm text-gray-500">
                                            {item.quantity ?? 0}
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

function PricingTableSkeleton() {
    return (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[60px]">Image</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Variant</TableHead>
                        <TableHead className="text-right">
                            Cost Price
                        </TableHead>
                        <TableHead className="text-right">
                            Retail Price
                        </TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
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
                                <Skeleton className="h-4 w-16 ml-auto" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-16 ml-auto" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-5 w-14 ml-auto" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-12 ml-auto" />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
