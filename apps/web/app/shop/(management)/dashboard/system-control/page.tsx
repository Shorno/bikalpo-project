import { SlidersHorizontalIcon } from "lucide-react";

export default function SystemControlPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">System Control</h1>
      <div className="flex flex-col items-center justify-center rounded-lg border bg-white p-12 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-gray-100">
          <SlidersHorizontalIcon className="size-8 text-gray-400" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-gray-700">
          System Control
        </h2>
        <p className="max-w-md text-sm text-gray-500">
          Configure system-level controls for your retail portal.
        </p>
        <span className="mt-4 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          Coming Soon
        </span>
      </div>
    </div>
  );
}
