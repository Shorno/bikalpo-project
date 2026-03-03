"use client";

import { useState } from "react";
import { Store, Search, MapPin, ShoppingBag, AlertCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { orpc } from "@/utils/orpc";
import { useQuery } from "@tanstack/react-query";

export default function StoresPage() {
    const [search, setSearch] = useState("");
    const [areaId, setAreaId] = useState<number | undefined>();
    const [page, setPage] = useState(1);

    const { data: areasData } = useQuery(
        orpc.customer.getAreas.queryOptions({
            input: undefined,
            staleTime: 1000 * 60 * 10,
        }),
    );

    const { data, isLoading, isError } = useQuery(
        orpc.customer.getShops.queryOptions({
            input: {
                search: search || undefined,
                areaId,
                page,
                limit: 12,
            },
            staleTime: 1000 * 60 * 2,
        }),
    );

    const shops = data?.shops ?? [];
    const pagination = data?.pagination;
    const areas = areasData?.areas ?? [];

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">
                    Browse Shops
                </h1>
                <p className="text-gray-500 mt-2">
                    Discover local sellers and browse their product catalogs
                </p>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Search by shop name..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        className="pl-10"
                    />
                </div>

                {areas.length > 0 && (
                    <Select
                        value={areaId ? String(areaId) : "all"}
                        onValueChange={(v) => {
                            setAreaId(v === "all" ? undefined : Number(v));
                            setPage(1);
                        }}
                    >
                        <SelectTrigger className="w-48">
                            <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                            <SelectValue placeholder="All areas" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All areas</SelectItem>
                            {areas.map((a: any) => (
                                <SelectItem key={a.id} value={String(a.id)}>
                                    {a.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <ShopCardSkeleton key={i} />
                    ))}
                </div>
            ) : isError ? (
                <div className="text-center py-16">
                    <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">
                        Failed to load shops
                    </p>
                </div>
            ) : shops.length === 0 ? (
                <div className="text-center py-16">
                    <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">
                        No shops found
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                        {search
                            ? "Try a different search term"
                            : "No approved shops available yet"}
                    </p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {shops.map((shop: any) => (
                            <Link
                                key={shop.id}
                                href={`/store/${shop.shopSlug}`}
                                className="group"
                            >
                                <div className="bg-white rounded-xl border shadow-sm overflow-hidden transition-all hover:shadow-md hover:border-emerald-200 group-hover:-translate-y-0.5">
                                    {/* Shop Header */}
                                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 flex items-center gap-4">
                                        {shop.image ? (
                                            <Image
                                                src={shop.image}
                                                alt={
                                                    shop.shopName ||
                                                    shop.name
                                                }
                                                width={56}
                                                height={56}
                                                className="rounded-full object-cover border-2 border-white shadow"
                                            />
                                        ) : (
                                            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center border-2 border-white shadow">
                                                <Store className="w-6 h-6 text-emerald-600" />
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <h3 className="font-semibold text-gray-900 truncate">
                                                {shop.shopName ||
                                                    shop.name}
                                            </h3>
                                            <Badge
                                                variant="outline"
                                                className="text-xs capitalize mt-1"
                                            >
                                                <ShoppingBag className="w-3 h-3 mr-1" />
                                                {shop.businessType ||
                                                    "Retail"}
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Shop Details */}
                                    <div className="p-4">
                                        {shop.shopAddress && (
                                            <div className="flex items-start gap-2 text-sm text-gray-500">
                                                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" />
                                                <span className="line-clamp-2">
                                                    {shop.shopAddress}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* Pagination */}
                    {pagination && pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between mt-8 text-sm">
                            <span className="text-gray-500">
                                Page {pagination.page} of{" "}
                                {pagination.totalPages} (
                                {pagination.totalCount} shops)
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => p - 1)}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={
                                        page >= pagination.totalPages
                                    }
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function ShopCardSkeleton() {
    return (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="bg-gray-50 p-6 flex items-center gap-4">
                <Skeleton className="w-14 h-14 rounded-full" />
                <div>
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-16 mt-2" />
                </div>
            </div>
            <div className="p-4">
                <Skeleton className="h-4 w-40" />
            </div>
        </div>
    );
}
