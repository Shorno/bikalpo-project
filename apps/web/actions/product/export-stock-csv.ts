"use server";

import {
  type GetProductsForStockParams,
  getProductsForStock,
} from "@/actions/product/get-products-for-stock";

function escapeCsvCell(val: string | number | null | undefined): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n"))
    return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function exportStockCSV(
  params: Omit<GetProductsForStockParams, "page" | "limit"> = {},
): Promise<{ success: true; csv: string } | { success: false; error: string }> {
  try {
    const { products } = await getProductsForStock({
      ...params,
      page: 1,
      limit: 100_000,
    });

    const headers = [
      "Product ID",
      "Product Name",
      "SKU",
      "Category",
      "Current Stock",
      "Reorder Level",
      "Unit Price",
      "In Stock",
    ];

    const rows = products.map((p) => [
      `PRD-${p.id}`,
      p.name,
      p.sku ?? p.slug,
      p.category?.name ?? "",
      p.stockQuantity,
      p.reorderLevel,
      String(p.price ?? ""),
      p.inStock ? "Yes" : "No",
    ]);

    const lines = [
      headers.join(","),
      ...rows.map((r) => r.map(escapeCsvCell).join(",")),
    ];
    const csv = lines.join("\n");

    return { success: true, csv };
  } catch (e) {
    console.error("exportStockCSV:", e);
    return { success: false, error: "Failed to export CSV" };
  }
}
