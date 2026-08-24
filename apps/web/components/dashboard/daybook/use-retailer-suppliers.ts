"use client";

import { useQuery } from "@tanstack/react-query";
import type { DaybookExpenseScope } from "@/components/dashboard/daybook/daybook-expense-ledger";
import { orpc } from "@/utils/orpc";

export type RetailerSupplierOption = {
  company?: string | null;
  currentPayable: number;
  id: number;
  name: string;
  phone?: string | null;
};

export function useRetailerSuppliers(scope: DaybookExpenseScope) {
  const shopSuppliersQuery = useQuery({
    enabled: scope === "retailer",
    queryKey: ["shopOwner", "suppliers", "daybook-selector"],
    queryFn: () =>
      orpc.shopOwner.getSuppliers.call({
        status: "active",
      }),
    staleTime: 0,
  });
  const warehouseSuppliersQuery = useQuery({
    enabled: scope === "warehouse",
    queryKey: ["warehouse", "suppliers", "daybook-selector"],
    queryFn: () =>
      orpc.warehouse.getSuppliers.call({
        status: "active",
      }),
    staleTime: 0,
  });
  const data =
    scope === "warehouse"
      ? warehouseSuppliersQuery.data
      : shopSuppliersQuery.data;

  return (data?.suppliers ?? []).map((supplier) => ({
    company: supplier.company,
    currentPayable: Number(supplier.currentPayable ?? 0),
    id: supplier.id,
    name: supplier.name,
    phone: supplier.phone,
  })) satisfies RetailerSupplierOption[];
}
