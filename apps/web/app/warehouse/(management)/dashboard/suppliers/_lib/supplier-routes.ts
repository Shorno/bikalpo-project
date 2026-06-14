export type SupplierKind = "external" | "warehouse";

export function supplierDetailHref(
  kind: SupplierKind,
  id: number,
): string {
  return kind === "warehouse"
    ? `/warehouse/dashboard/suppliers/wh-${id}`
    : `/warehouse/dashboard/suppliers/${id}`;
}

export function parseSupplierRouteId(raw: string) {
  if (raw.startsWith("wh-")) {
    const connectionId = Number(raw.slice(3));
    if (!Number.isFinite(connectionId) || connectionId <= 0) return null;
    return { kind: "warehouse" as const, connectionId };
  }

  const supplierId = Number(raw);
  if (!Number.isFinite(supplierId) || supplierId <= 0) return null;
  return { kind: "external" as const, supplierId };
}
