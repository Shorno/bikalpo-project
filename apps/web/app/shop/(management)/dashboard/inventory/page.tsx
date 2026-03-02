import { Boxes } from "lucide-react";

export default function InventoryPage() {
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">Inventory</h1>
            <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
                <Boxes className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Your retail inventory will appear here</p>
                <p className="text-sm text-gray-400 mt-1">Stock is auto-converted from wholesale (TRADE) to retail (RETAIL) when B2B orders are delivered.</p>
            </div>
        </div>
    );
}
