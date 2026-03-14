"use client";
import { InboxIcon } from "lucide-react";

export default function WarehouseIncomingOrdersPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Incoming Orders</h1>
                    <p className="text-sm text-muted-foreground">Orders from shop owners and other warehouses</p>
                </div>
            </div>
            <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg bg-muted/30">
                <InboxIcon className="size-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-lg font-medium">No incoming orders yet</p>
                <p className="text-sm text-muted-foreground mt-1">Orders placed by shop owners or other warehouses will appear here.</p>
            </div>
        </div>
    );
}
