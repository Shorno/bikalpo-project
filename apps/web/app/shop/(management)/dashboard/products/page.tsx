import { Package } from "lucide-react";

export default function ShopProductsPage() {
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">Products</h1>
            <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Your assigned products will appear here</p>
                <p className="text-sm text-gray-400 mt-1">Products are assigned by the admin based on your sales model.</p>
            </div>
        </div>
    );
}
