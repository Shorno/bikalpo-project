"use client";

import { format } from "date-fns";
import {
    ArrowDownCircle,
    ArrowUpCircle,
    ChevronLeft,
    ChevronRight,
    Filter,
    RefreshCw,
    Repeat,
    AlertTriangle,
    Undo2,
    Wrench,
    Package,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { orpc } from "@/utils/orpc";
import { useQuery } from "@tanstack/react-query";

const LIMIT = 25;

const changeTypeConfig: Record<
    string,
    { label: string; color: string; bg: string; icon: typeof ArrowDownCircle }
> = {
    in: {
        label: "Stock In",
        color: "text-green-700",
        bg: "bg-green-50",
        icon: ArrowDownCircle,
    },
    out: {
        label: "Stock Out",
        color: "text-red-700",
        bg: "bg-red-50",
        icon: ArrowUpCircle,
    },
    convert_in: {
        label: "Convert In",
        color: "text-blue-700",
        bg: "bg-blue-50",
        icon: Repeat,
    },
    convert_out: {
        label: "Convert Out",
        color: "text-indigo-700",
        bg: "bg-indigo-50",
        icon: Repeat,
    },
    damage: {
        label: "Damage",
        color: "text-orange-700",
        bg: "bg-orange-50",
        icon: AlertTriangle,
    },
    return: {
        label: "Return",
        color: "text-purple-700",
        bg: "bg-purple-50",
        icon: Undo2,
    },
    adjust: {
        label: "Adjustment",
        color: "text-yellow-700",
        bg: "bg-yellow-50",
        icon: Wrench,
    },
};

const refTypeLabels: Record<string, string> = {
    order: "Order",
    return: "Return",
    damage: "Damage",
    manual: "Manual",
    conversion: "Conversion",
    invoice: "Invoice",
};

export function StockLedgerClient() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [ownerType, setOwnerType] = useState(
        searchParams.get("ownerType") || "all"
    );
    const [changeType, setChangeType] = useState(
        searchParams.get("changeType") || "all"
    );
    const [page, setPage] = useState(
        Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    );

    const updateUrl = useCallback(
        (params: Record<string, string>) => {
            const sp = new URLSearchParams();
            const merged = { ownerType, changeType, page: String(page), ...params };
            for (const [k, v] of Object.entries(merged)) {
                if (v && v !== "all" && v !== "1") sp.set(k, v);
            }
            router.push(`/dashboard/admin/stock/ledger?${sp.toString()}`, {
                scroll: false,
            });
        },
        [ownerType, changeType, page, router]
    );

    // Filter by changeType client-side since the API doesn't support it natively
    const { data, isLoading, refetch } = useQuery(
        orpc.inventory.getLedger.queryOptions({
            input: {
                ownerType:
                    ownerType !== "all"
                        ? (ownerType as "super_seller" | "shop")
                        : undefined,
                page,
                limit: LIMIT,
            },
        })
    );

    const entries = data?.entries ?? [];
    const filteredEntries =
        changeType !== "all"
            ? entries.filter((e) => e.changeType === changeType)
            : entries;
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / LIMIT));

    // Sync URL when filters change
    useEffect(() => {
        updateUrl({ ownerType, changeType, page: String(page) });
    }, [ownerType, changeType, page, updateUrl]);

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Filters:</span>
                </div>

                <Select
                    value={ownerType}
                    onValueChange={(v) => {
                        setOwnerType(v);
                        setPage(1);
                    }}
                >
                    <SelectTrigger className="w-[160px] h-9 text-sm">
                        <SelectValue placeholder="Owner Type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Owners</SelectItem>
                        <SelectItem value="super_seller">Super Seller</SelectItem>
                        <SelectItem value="shop">Shop Owner</SelectItem>
                    </SelectContent>
                </Select>

                <Select
                    value={changeType}
                    onValueChange={(v) => {
                        setChangeType(v);
                        setPage(1);
                    }}
                >
                    <SelectTrigger className="w-[160px] h-9 text-sm">
                        <SelectValue placeholder="Change Type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="in">Stock In</SelectItem>
                        <SelectItem value="out">Stock Out</SelectItem>
                        <SelectItem value="convert_in">Convert In</SelectItem>
                        <SelectItem value="convert_out">Convert Out</SelectItem>
                        <SelectItem value="damage">Damage</SelectItem>
                        <SelectItem value="return">Return</SelectItem>
                        <SelectItem value="adjust">Adjustment</SelectItem>
                    </SelectContent>
                </Select>

                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-gray-500"
                    onClick={() => refetch()}
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                </Button>

                <span className="ml-auto text-sm text-gray-500">
                    {total} {total === 1 ? "entry" : "entries"}
                </span>
            </div>

            {/* Table */}
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50">
                            <TableHead className="w-[140px]">Date</TableHead>
                            <TableHead className="w-[130px]">Type</TableHead>
                            <TableHead>Variant</TableHead>
                            <TableHead className="text-right w-[80px]">Qty</TableHead>
                            <TableHead className="text-right w-[100px]">Balance</TableHead>
                            <TableHead className="w-[100px]">Owner</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead className="w-[90px]">Ref</TableHead>
                            <TableHead className="w-[100px]">By</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <TableRow key={i}>
                                    {Array.from({ length: 9 }).map((_, j) => (
                                        <TableCell key={j}>
                                            <Skeleton className="h-4 w-full" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : filteredEntries.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={9}
                                    className="h-32 text-center text-gray-500"
                                >
                                    <div className="flex flex-col items-center gap-2">
                                        <Package className="h-8 w-8 text-gray-300" />
                                        <p>No ledger entries found</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredEntries.map((entry) => {
                                const config =
                                    changeTypeConfig[entry.changeType] || changeTypeConfig.adjust;
                                const Icon = config.icon;

                                return (
                                    <TableRow key={entry.id} className="text-sm">
                                        <TableCell className="text-gray-500 tabular-nums">
                                            {format(new Date(entry.createdAt), "MMM d, HH:mm")}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                className={`${config.bg} ${config.color} border-0 gap-1 text-xs font-medium`}
                                            >
                                                <Icon className="h-3 w-3" />
                                                {config.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-medium text-gray-900">
                                            {entry.variant?.sku || `V#${entry.variantId}`}
                                            {entry.variant?.unitLabel && (
                                                <span className="text-xs text-gray-400 ml-1">
                                                    ({entry.variant.unitLabel})
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-mono tabular-nums">
                                            {["out", "convert_out", "damage"].includes(
                                                entry.changeType
                                            ) ? (
                                                <span className="text-red-600">
                                                    -{Number(entry.qty).toLocaleString()}
                                                </span>
                                            ) : (
                                                <span className="text-green-600">
                                                    +{Number(entry.qty).toLocaleString()}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-mono tabular-nums text-gray-700">
                                            {Number(entry.balanceAfter).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className="text-xs capitalize"
                                            >
                                                {entry.ownerType === "super_seller"
                                                    ? "Admin"
                                                    : "Shop"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell
                                            className="text-gray-500 max-w-[200px] truncate"
                                            title={entry.reason || ""}
                                        >
                                            {entry.reason || "—"}
                                        </TableCell>
                                        <TableCell className="text-xs text-gray-400">
                                            {entry.referenceType ? (
                                                <span>
                                                    {refTypeLabels[entry.referenceType] ||
                                                        entry.referenceType}
                                                    {entry.referenceId && ` #${entry.referenceId}`}
                                                </span>
                                            ) : (
                                                "—"
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs text-gray-500">
                                            {entry.createdBy?.name || "System"}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                        Page {page} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
