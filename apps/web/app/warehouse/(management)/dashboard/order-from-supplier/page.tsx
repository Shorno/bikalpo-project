"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WarehouseOrderFromSupplierPage() {
  const router = useRouter();

  useEffect(() => {
    router.push("/warehouse/dashboard/suppliers");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 space-y-4">
      <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      <h1 className="text-xl font-bold text-zinc-900">Ordering page has moved</h1>
      <p className="text-sm text-zinc-500 max-w-md">
        Warehouse-to-Warehouse orders are now placed directly from the supplier's storefront.
        We are redirecting you to your suppliers list...
      </p>
      <Button
        onClick={() => router.push("/warehouse/dashboard/suppliers")}
        className="gap-1.5"
      >
        Go to Suppliers
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
