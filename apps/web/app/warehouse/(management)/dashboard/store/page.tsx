"use client";
import { StoreIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export default function WarehouseStorePage() {
    const { data: session } = authClient.useSession();
    const user = session?.user as any;
    const slug = user?.warehouseSlug;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Storefront</h1>

            <div className="bg-white rounded-lg border shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                    <StoreIcon className="w-5 h-5 text-amber-600" />
                    <h2 className="text-lg font-semibold">Your Warehouse Storefront</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                    Your warehouse storefront is accessible via direct URL only. It is not listed publicly on the platform.
                    Share this link or QR code with shop owners and other warehouses.
                </p>

                {slug ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                            <span className="text-sm font-medium text-amber-800">Storefront URL:</span>
                            <code className="text-sm font-mono text-amber-700 bg-white rounded px-2 py-1">
                                /warehouse/{slug}
                            </code>
                        </div>
                    </div>
                ) : (
                    <div className="text-sm text-gray-500">
                        Your warehouse slug has not been configured yet.
                    </div>
                )}
            </div>
        </div>
    );
}
