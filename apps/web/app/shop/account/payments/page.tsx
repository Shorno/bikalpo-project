import { CreditCard } from "lucide-react";

export default function PaymentsPage() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-8">
      <div className="flex items-center gap-3 mb-4">
        <CreditCard className="h-6 w-6 text-gray-400" />
        <h2 className="text-xl font-semibold text-gray-900">Payments</h2>
      </div>
      <p className="text-gray-500">
        Manage your payment methods here. This feature is coming soon.
      </p>
    </div>
  );
}
