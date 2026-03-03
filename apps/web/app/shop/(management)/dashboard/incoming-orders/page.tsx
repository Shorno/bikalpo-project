"use client";

import { useState } from "react";
import {
    ShoppingBag,
    Package,
    Clock,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Truck,
    User,
    Phone,
    MapPin,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
    useIncomingOrders,
    useUpdateIncomingOrderStatus,
} from "@/hooks/use-shop-owner-api";

const statusConfig: Record<
    string,
    { label: string; icon: React.ReactNode; className: string }
> = {
    pending: {
        label: "Pending",
        icon: <Clock className="w-3 h-3" />,
        className: "text-amber-700 bg-amber-50 border-amber-200",
    },
    confirmed: {
        label: "Confirmed",
        icon: <CheckCircle2 className="w-3 h-3" />,
        className: "text-blue-700 bg-blue-50 border-blue-200",
    },
    processing: {
        label: "Processing",
        icon: <Truck className="w-3 h-3" />,
        className: "text-indigo-700 bg-indigo-50 border-indigo-200",
    },
    delivered: {
        label: "Delivered",
        icon: <CheckCircle2 className="w-3 h-3" />,
        className: "text-emerald-700 bg-emerald-50 border-emerald-200",
    },
    cancelled: {
        label: "Cancelled",
        icon: <XCircle className="w-3 h-3" />,
        className: "text-red-700 bg-red-50 border-red-200",
    },
};

type StatusFilter =
    | "all"
    | "pending"
    | "confirmed"
    | "processing"
    | "delivered"
    | "cancelled";

export default function IncomingOrdersPage() {
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [page, setPage] = useState(1);

    const { data, isLoading, isError } = useIncomingOrders({
        status: statusFilter,
        page,
        limit: 15,
    });

    const updateStatus = useUpdateIncomingOrderStatus();

    const orders = data?.orders ?? [];
    const pagination = data?.pagination;

    const handleStatusUpdate = (
        orderId: number,
        status: "confirmed" | "processing" | "delivered" | "cancelled",
    ) => {
        updateStatus.mutate(
            { orderId, status },
            {
                onSuccess: (data) => toast.success(data.message),
                onError: (err) => toast.error(err.message),
            },
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Incoming Orders</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Consumer orders placed to your shop
                    </p>
                </div>

                <Select
                    value={statusFilter}
                    onValueChange={(v) => {
                        setStatusFilter(v as StatusFilter);
                        setPage(1);
                    }}
                >
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {isLoading ? (
                <IncomingOrdersSkeleton />
            ) : isError ? (
                <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
                    <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">
                        Failed to load orders
                    </p>
                </div>
            ) : orders.length === 0 ? (
                <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
                    <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">
                        No incoming orders
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                        {statusFilter !== "all"
                            ? "Try changing the status filter"
                            : "You'll see consumer orders here when they buy from your shop"}
                    </p>
                </div>
            ) : (
                <>
                    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order #</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Items</TableHead>
                                    <TableHead className="text-right">
                                        Total
                                    </TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.map((o: any) => {
                                    const config =
                                        statusConfig[o.status] ||
                                        statusConfig.pending;
                                    return (
                                        <TableRow key={o.id}>
                                            <TableCell className="font-mono text-sm font-medium">
                                                {o.orderNumber}
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-1.5 text-sm font-medium">
                                                        <User className="w-3.5 h-3.5 text-gray-400" />
                                                        {o.customerName ||
                                                            o.shippingName}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                                        <Phone className="w-3 h-3" />
                                                        {o.shippingPhone}
                                                    </div>
                                                    {o.shippingArea && (
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                                            <MapPin className="w-3 h-3" />
                                                            {o.shippingArea}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Package className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm">
                                                        {o.items?.length || 0}{" "}
                                                        item
                                                        {(o.items?.length ||
                                                            0) !== 1
                                                            ? "s"
                                                            : ""}
                                                    </span>
                                                </div>
                                                {o.items
                                                    ?.slice(0, 2)
                                                    .map(
                                                        (
                                                            item: any,
                                                            i: number,
                                                        ) => (
                                                            <p
                                                                key={i}
                                                                className="text-xs text-gray-400 ml-6 truncate max-w-[180px]"
                                                            >
                                                                {
                                                                    item.productName
                                                                }{" "}
                                                                ×{" "}
                                                                {item.quantity}
                                                            </p>
                                                        ),
                                                    )}
                                                {(o.items?.length || 0) >
                                                    2 && (
                                                        <p className="text-xs text-gray-400 ml-6">
                                                            +
                                                            {o.items.length - 2}{" "}
                                                            more
                                                        </p>
                                                    )}
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-sm">
                                                ৳
                                                {Number(
                                                    o.total,
                                                ).toLocaleString("en-BD")}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={`gap-1 ${config.className}`}
                                                >
                                                    {config.icon}
                                                    {config.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-500">
                                                {new Date(
                                                    o.createdAt,
                                                ).toLocaleDateString(
                                                    "en-BD",
                                                    {
                                                        day: "numeric",
                                                        month: "short",
                                                    },
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <OrderActions
                                                    status={o.status}
                                                    orderId={o.id}
                                                    onUpdate={
                                                        handleStatusUpdate
                                                    }
                                                    isPending={
                                                        updateStatus.isPending
                                                    }
                                                />
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {pagination && pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">
                                Page {pagination.page} of{" "}
                                {pagination.totalPages} (
                                {pagination.totalCount} orders)
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

function OrderActions({
    status,
    orderId,
    onUpdate,
    isPending,
}: {
    status: string;
    orderId: number;
    onUpdate: (
        orderId: number,
        status: "confirmed" | "processing" | "delivered" | "cancelled",
    ) => void;
    isPending: boolean;
}) {
    if (status === "delivered" || status === "cancelled") return null;

    return (
        <div className="flex gap-1.5 justify-end">
            {status === "pending" && (
                <>
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 h-7 text-xs"
                        disabled={isPending}
                        onClick={() => onUpdate(orderId, "confirmed")}
                    >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Confirm
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50 h-7 text-xs"
                        disabled={isPending}
                        onClick={() => onUpdate(orderId, "cancelled")}
                    >
                        <XCircle className="w-3 h-3 mr-1" />
                        Cancel
                    </Button>
                </>
            )}
            {status === "confirmed" && (
                <Button
                    size="sm"
                    variant="outline"
                    className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 h-7 text-xs"
                    disabled={isPending}
                    onClick={() => onUpdate(orderId, "processing")}
                >
                    <Truck className="w-3 h-3 mr-1" />
                    Processing
                </Button>
            )}
            {status === "processing" && (
                <Button
                    size="sm"
                    variant="outline"
                    className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 h-7 text-xs"
                    disabled={isPending}
                    onClick={() => onUpdate(orderId, "delivered")}
                >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Delivered
                </Button>
            )}
        </div>
    );
}

function IncomingOrdersSkeleton() {
    return (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell>
                                <Skeleton className="h-4 w-24" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-28 mb-1" />
                                <Skeleton className="h-3 w-20" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-16" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-16 ml-auto" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-5 w-20" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-16" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-7 w-20 ml-auto" />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
