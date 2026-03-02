import { Archive } from "lucide-react";

export default function ArchivedOrdersPage() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-8">
      <div className="flex items-center gap-3 mb-4">
        <Archive className="h-6 w-6 text-gray-400" />
        <h2 className="text-xl font-semibold text-gray-900">Archived Orders</h2>
      </div>
      <p className="text-gray-500">
        View your archived orders here. This feature is coming soon.
      </p>
    </div>
  );
}
