"use client";
import { ShoppingCartIcon } from "lucide-react";

export default function WarehouseOrdersPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
                    <p className="text-sm text-muted-foreground">Orders you&apos;ve placed with other warehouses</p>
                </div>
            </div>
            <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg bg-muted/30">
                <ShoppingCartIcon className="size-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-lg font-medium">No orders yet</p>
                <p className="text-sm text-muted-foreground mt-1">Orders you place from other warehouses will appear here.</p>
            </div>
        </div>
    );
}
