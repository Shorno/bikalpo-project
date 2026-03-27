"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Root page for the warehouse subdomain (warehouse.bikalpo.localhost)
 * Redirects to the warehouse dashboard.
 */
export default function WarehouseRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/warehouse/dashboard");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading warehouse dashboard...</p>
      </div>
    </div>
  );
}
