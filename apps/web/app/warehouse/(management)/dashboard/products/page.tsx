"use client";
import { PackageIcon } from "lucide-react";

export default function WarehouseProductsPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Products</h1>
                    <p className="text-sm text-muted-foreground">Products available in your warehouse</p>
                </div>
            </div>
            <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg bg-muted/30">
                <PackageIcon className="size-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-lg font-medium">No products yet</p>
                <p className="text-sm text-muted-foreground mt-1">Products will appear here once your inventory is set up.</p>
            </div>
        </div>
    );
}
