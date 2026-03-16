"use client";

import { orpc } from "@/utils/orpc";
import { useQuery } from "@tanstack/react-query";
import {
    Warehouse,
    MapPin,
    ShoppingBag,
    User,
    CheckCircle2,
    Package,
    TrendingUp,
    Clock,
    InboxIcon,
    AlertTriangle,
    BoxIcon,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

export default function WarehouseDashboardPage() {
    const { data: session, isPending: sessionLoading } = authClient.useSession();
    const user = session?.user as any;

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ["warehouse", "getDashboardStats"],
        queryFn: () => orpc.warehouse.getDashboardStats.call({}),
    });

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Warehouse Dashboard</h1>

            {/* Warehouse Info Card */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                        <Warehouse className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="flex-1">
                        {sessionLoading ? (
                            <Skeleton className="h-6 w-48" />
                        ) : (
                            <>
                                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                    {user?.warehouseName || user?.name || "My Warehouse"}
                                    <CheckCircle2 className="w-5 h-5 text-amber-500" />
                                </h2>
                                <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                                    <div className="flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5 text-gray-400" />
                                        <span>{user?.name || "—"}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                        <span>{user?.warehouseAddress || "Not set"}</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={<InboxIcon className="w-5 h-5 text-blue-600" />}
                    label="Incoming Orders"
                    value={statsLoading ? null : String(stats?.totalOrders ?? 0)}
                    bg="bg-blue-50"
                    href="/warehouse/dashboard/incoming-orders"
                />
                <StatCard
                    icon={<Clock className="w-5 h-5 text-amber-600" />}
                    label="Pending"
                    value={statsLoading ? null : String(stats?.pendingOrders ?? 0)}
                    bg="bg-amber-50"
                    href="/warehouse/dashboard/incoming-orders"
                />
                <StatCard
                    icon={<ShoppingBag className="w-5 h-5 text-emerald-600" />}
                    label="Fulfilled"
                    value={statsLoading ? null : String(stats?.deliveredOrders ?? 0)}
                    bg="bg-emerald-50"
                />
                <StatCard
                    icon={<Package className="w-5 h-5 text-purple-600" />}
                    label="Products"
                    value={statsLoading ? null : String(stats?.totalProducts ?? 0)}
                    bg="bg-purple-50"
                    href="/warehouse/dashboard/products"
                />
            </div>

            {/* Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-500">Total Revenue</span>
                    </div>
                    {statsLoading ? (
                        <Skeleton className="h-8 w-32 mt-1" />
                    ) : (
                        <p className="text-2xl font-bold text-gray-900">
                            ৳{(stats?.totalRevenue ?? 0).toLocaleString()}
                        </p>
                    )}
                </div>

                <div className="bg-white rounded-lg border shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-1">
                        <BoxIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-500">Total Stock</span>
                    </div>
                    {statsLoading ? (
                        <Skeleton className="h-8 w-32 mt-1" />
                    ) : (
                        <p className="text-2xl font-bold text-gray-900">
                            {Math.round(stats?.totalStock ?? 0).toLocaleString()} units
                        </p>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            {stats && stats.pendingOrders > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-amber-800">
                            You have {stats.pendingOrders} pending order{stats.pendingOrders !== 1 ? "s" : ""} to review
                        </p>
                    </div>
                    <Link
                        href="/warehouse/dashboard/incoming-orders"
                        className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700"
                    >
                        Review Orders
                    </Link>
                </div>
            )}
        </div>
    );
}

function StatCard({
    icon,
    label,
    value,
    bg,
    href,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | null;
    bg: string;
    href?: string;
}) {
    const content = (
        <div className={`bg-white rounded-lg border shadow-sm p-4 ${href ? "hover:border-gray-300 transition-colors cursor-pointer" : ""}`}>
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center`}>
                    {icon}
                </div>
                <div>
                    <p className="text-xs text-gray-500">{label}</p>
                    {value === null ? (
                        <Skeleton className="h-6 w-12 mt-0.5" />
                    ) : (
                        <p className="text-xl font-bold text-gray-900">{value}</p>
                    )}
                </div>
            </div>
        </div>
    );

    if (href) {
        return <Link href={href}>{content}</Link>;
    }
    return content;
}
