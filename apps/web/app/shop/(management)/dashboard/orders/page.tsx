import { ShoppingCart } from "lucide-react";

export default function IncomingOrdersPage() {
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">Incoming Orders</h1>
            <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
                <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No incoming orders yet</p>
                <p className="text-sm text-gray-400 mt-1">Consumer orders will appear here once the B2C flow is active.</p>
            </div>
        </div>
    );
}
