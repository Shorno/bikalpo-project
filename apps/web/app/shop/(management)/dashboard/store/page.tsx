import { Store } from "lucide-react";

export default function StorePageSettings() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Store Page</h1>
      <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
        <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">
          Your public store page settings
        </p>
        <p className="text-sm text-gray-400 mt-1">
          Customize your store's public page, hours, and policies.
        </p>
      </div>
    </div>
  );
}
