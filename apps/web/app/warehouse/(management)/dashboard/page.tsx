"use client";

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
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";

export default function WarehouseDashboardPage() {
    const { data: session, isPending: sessionLoading } =
        authClient.useSession();

    const user = session?.user as any;

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
                    value="0"
                    bg="bg-blue-50"
                />
                <StatCard
                    icon={<Clock className="w-5 h-5 text-amber-600" />}
                    label="Pending"
                    value="0"
                    bg="bg-amber-50"
                />
                <StatCard
                    icon={<ShoppingBag className="w-5 h-5 text-emerald-600" />}
                    label="Fulfilled"
                    value="0"
                    bg="bg-emerald-50"
                />
                <StatCard
                    icon={<Package className="w-5 h-5 text-purple-600" />}
                    label="Products"
                    value="0"
                    bg="bg-purple-50"
                />
            </div>

            {/* Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-500">
                            Total Revenue
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        ৳0
                    </p>
                </div>

                <div className="bg-white rounded-lg border shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-1">
                        <Package className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-500">
                            Total Stock
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        0 units
                    </p>
                </div>
            </div>
        </div>
    );
}

function StatCard({
    icon,
    label,
    value,
    bg,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | null;
    bg: string;
}) {
    return (
        <div className="bg-white rounded-lg border shadow-sm p-4">
            <div className="flex items-center gap-3">
                <div
                    className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center`}
                >
                    {icon}
                </div>
                <div>
                    <p className="text-xs text-gray-500">{label}</p>
                    {value === null ? (
                        <Skeleton className="h-6 w-12 mt-0.5" />
                    ) : (
                        <p className="text-xl font-bold text-gray-900">
                            {value}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
