import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import getCategories from "@/actions/category/get-categories";
import { getProductsForStock } from "@/actions/product/get-products-for-stock";
import { StockFilterBar } from "@/components/features/stock/stock-filter-bar";
import { StockInventoryTable } from "@/components/features/stock/stock-inventory-table";
import { StockPagination } from "@/components/features/stock/stock-pagination";
import { Button } from "@/components/ui/button";

const LIMIT = 10;

export default async function StockInventoryPage({
  searchParams = {},
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const resolved =
    typeof (searchParams as any)?.then === "function"
      ? await (searchParams as Promise<
          Record<string, string | string[] | undefined>
        >)
      : (searchParams ?? {});
  const sp = resolved as Record<string, string | string[] | undefined>;
  const search = (typeof sp.search === "string" ? sp.search : undefined) ?? "";
  const categoryId = typeof sp.category === "string" ? sp.category : undefined;
  const stockStatus = (typeof sp.status === "string" ? sp.status : undefined) as
    | "all"
    | "in"
    | "out"
    | "low"
    | undefined;
  const sort = (typeof sp.sort === "string" ? sp.sort : undefined) as
    | "newest"
    | "oldest"
    | "popular"
    | undefined;
  const page = Math.max(
    1,
    parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1,
  );

  const [categories, { products, total }] = await Promise.all([
    getCategories(),
    getProductsForStock({
      search: search || undefined,
      categoryId: categoryId || undefined,
      stockStatus: stockStatus || "all",
      sort: sort || "newest",
      page,
      limit: LIMIT,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const q = new URLSearchParams(sp as Record<string, string>);
  q.delete("page");
  const queryWithoutPage = q.toString();

  const categoryList = categories.map((c) => ({ id: c.id, name: c.name }));

  const rows = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    price: p.price,
    stockQuantity: p.stockQuantity,
    inStock: p.inStock,
    reorderLevel: p.reorderLevel,
    supplier: p.supplier,
    lastRestockedAt: p.lastRestockedAt,
    category: p.category,
    subCategory: p.subCategory,
  }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Stock / Inventory
          </h1>
          <p className="text-muted-foreground">
            View and adjust product stock. When you approve an item request and
            add it to a product, stock updates here automatically.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/admin/item-requests">
            <ClipboardList className="mr-2 size-4" />
            Item Requests
          </Link>
        </Button>
      </div>

      <Suspense fallback={<div className="h-10" />}>
        <StockFilterBar categories={categoryList} />
      </Suspense>

      <StockInventoryTable products={rows} />

      <StockPagination
        queryWithoutPage={queryWithoutPage}
        currentPage={page}
        totalPages={totalPages}
      />
    </div>
  );
}
