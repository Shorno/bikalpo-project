"use client";

import { Store, MapPin, ShoppingBag, User, CheckCircle2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";

export default function ShopOwnerDashboardPage() {
    const { data: session, isPending } = authClient.useSession();

    if (isPending) {
        return (
            <div className="container mx-auto px-4 py-8">
                <Skeleton className="h-8 w-64 mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-40 w-full rounded-lg" />
                    <Skeleton className="h-40 w-full rounded-lg" />
                </div>
            </div>
        );
    }

    const user = session?.user;

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">
                Shop Owner Dashboard
            </h1>

            {/* Shop Info Card */}
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <Store className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            {user?.shopName || user?.name || "My Shop"}
                            {user?.sellerStatus === "approved" && (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            )}
                        </h2>
                        <div className="mt-3 space-y-2 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-400" />
                                <span>Owner: {user?.ownerName || user?.name || "—"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <ShoppingBag className="w-4 h-4 text-gray-400" />
                                <span className="capitalize">Type: {user?.businessType || "—"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <span>Address: {user?.shopAddress || "Not set"}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Session Debug Info */}
            <div className="bg-gray-50 rounded-lg border p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-3">Session Info</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <span className="text-gray-500">Role:</span>{" "}
                        <span className="font-medium">{user?.role || "—"}</span>
                    </div>
                    <div>
                        <span className="text-gray-500">Email:</span>{" "}
                        <span className="font-medium">{user?.email || "—"}</span>
                    </div>
                    <div>
                        <span className="text-gray-500">Seller Status:</span>{" "}
                        <span className="font-medium capitalize">{user?.sellerStatus || "—"}</span>
                    </div>
                    <div>
                        <span className="text-gray-500">Shop Slug:</span>{" "}
                        <span className="font-medium">{user?.shopSlug || "—"}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
