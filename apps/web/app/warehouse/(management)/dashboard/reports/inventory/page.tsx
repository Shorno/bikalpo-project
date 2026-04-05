import { ClipboardIcon } from "lucide-react";

export default function InventoryReportPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Inventory Report</h1>
      <div className="bg-white rounded-lg border shadow-sm p-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
          <ClipboardIcon className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Inventory Report</h2>
        <p className="text-sm text-gray-500 max-w-md">
          Detailed inventory analysis and stock movement reports.
        </p>
        <span className="mt-4 inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
          Coming Soon
        </span>
      </div>
    </div>
  );
}
