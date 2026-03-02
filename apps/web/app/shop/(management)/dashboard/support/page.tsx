import { Headphones } from "lucide-react";

export default function ShopSupportPage() {
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">Support</h1>
            <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
                <Headphones className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Need help?</p>
                <p className="text-sm text-gray-400 mt-1">Contact support or view your existing tickets.</p>
            </div>
        </div>
    );
}
