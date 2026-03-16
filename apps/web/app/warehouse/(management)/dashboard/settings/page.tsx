"use client";
import { SettingsIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";

export default function WarehouseSettingsPage() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user as any;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Warehouse Settings</h1>

      <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <SettingsIcon className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-semibold">Warehouse Profile</h2>
        </div>

        {isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-5 w-40" />
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Warehouse Name</span>
              <span className="font-medium">{user?.warehouseName || "—"}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Owner</span>
              <span className="font-medium">{user?.name || "—"}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Email</span>
              <span className="font-medium">{user?.email || "—"}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Address</span>
              <span className="font-medium">
                {user?.warehouseAddress || "—"}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Slug</span>
              <span className="font-medium font-mono text-amber-600">
                {user?.warehouseSlug || "—"}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Storefront URL</span>
              <span className="font-medium text-amber-600">
                {user?.warehouseSlug ? `/warehouse/${user.warehouseSlug}` : "—"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
