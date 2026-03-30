import { PercentIcon } from "lucide-react";

export default function DiscountOffersPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Discount Offers</h1>
      <div className="bg-white rounded-lg border shadow-sm p-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
          <PercentIcon className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Discount Offers</h2>
        <p className="text-sm text-gray-500 max-w-md">
          Set up discount offers and bulk pricing for stores.
        </p>
        <span className="mt-4 inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
          Coming Soon
        </span>
      </div>
    </div>
  );
}
