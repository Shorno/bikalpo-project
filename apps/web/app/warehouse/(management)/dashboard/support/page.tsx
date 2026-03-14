"use client";
import { HeadphonesIcon } from "lucide-react";

export default function WarehouseSupportPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Support</h1>
            <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg bg-muted/30">
                <HeadphonesIcon className="size-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-lg font-medium">No support tickets</p>
                <p className="text-sm text-muted-foreground mt-1">Create a support ticket if you need help.</p>
            </div>
        </div>
    );
}
