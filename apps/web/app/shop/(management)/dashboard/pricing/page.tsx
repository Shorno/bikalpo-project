import { DollarSign } from "lucide-react";

export default function PricingPage() {
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">Pricing</h1>
            <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
                <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Set your retail selling prices</p>
                <p className="text-sm text-gray-400 mt-1">Prices must be updated at least once every 24 hours. Minimum: base price + margin.</p>
            </div>
        </div>
    );
}
