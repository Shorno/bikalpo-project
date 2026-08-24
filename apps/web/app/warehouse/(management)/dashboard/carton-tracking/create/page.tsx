"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, PackagePlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { orpc } from "@/utils/orpc";
import { CartonConfiguration } from "./_components/carton-configuration";
import { isCartonVariantEligible } from "./_components/carton-eligibility";
import { CartonNotes } from "./_components/carton-notes";
import { CartonProductPicker } from "./_components/carton-product-picker";
import { CartonSummaryPanel } from "./_components/carton-summary-panel";
import type { CartonItem } from "./_components/types";

export default function CreateCartonPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [items, setItems] = useState<CartonItem[]>([]);

  const [storageAreaId, setStorageAreaId] = useState<string>("");
  const [note, setNote] = useState("");
  const [cartonPrice, setCartonPrice] = useState("");
  const [deliveryCost, setDeliveryCost] = useState("");

  const { data: allProductsData } = useQuery({
    queryKey: ["w", "all-products-for-filters"],
    queryFn: () =>
      (orpc.warehouse as any).getWarehouseProductsForStock.call({ limit: 200 }),
  });

  const hasActiveFilters =
    searchQuery.length >= 1 ||
    categoryFilter !== "all" ||
    subCategoryFilter !== "all" ||
    productFilter !== "all";

  const { data: searchData } = useQuery({
    queryKey: [
      "w",
      "search",
      searchQuery,
      categoryFilter,
      subCategoryFilter,
      productFilter,
    ],
    queryFn: () =>
      (orpc.warehouse as any).getWarehouseProductsForStock.call({
        search: searchQuery || undefined,
        categoryId:
          categoryFilter !== "all" ? Number(categoryFilter) : undefined,
        subCategoryId:
          subCategoryFilter !== "all" ? Number(subCategoryFilter) : undefined,
        productId: productFilter !== "all" ? Number(productFilter) : undefined,
        limit: 50,
      }),
    enabled: hasActiveFilters,
  });

  const { data: areasData } = useQuery({
    queryKey: ["w", "areas"],
    queryFn: () => (orpc.warehouse as any).getStorageAreas.call({}),
  });
  const { data: nextIdData } = useQuery({
    queryKey: ["w", "next-carton-id"],
    queryFn: () => (orpc.warehouse as any).getNextCartonIdPreview.call({}),
  });

  const allProductsList = allProductsData?.products ?? [];
  const products = searchData?.products ?? [];
  const areas = areasData?.areas ?? [];
  const nextCartonId = nextIdData?.nextCartonId ?? "CTN-...";

  const allCategories = allProductsList.reduce((acc: any[], p: any) => {
    if (p.category && !acc.find((c: any) => c.id === p.category.id))
      acc.push(p.category);
    return acc;
  }, []);

  const allSubCategories = allProductsList.reduce((acc: any[], p: any) => {
    if (!p.subCategory) return acc;
    if (categoryFilter !== "all" && p.categoryId !== Number(categoryFilter))
      return acc;
    if (!acc.find((sc: any) => sc.id === p.subCategory.id))
      acc.push(p.subCategory);
    return acc;
  }, []);

  const allProductNames = allProductsList.reduce((acc: any[], p: any) => {
    if (categoryFilter !== "all" && p.categoryId !== Number(categoryFilter))
      return acc;
    if (
      subCategoryFilter !== "all" &&
      p.subCategoryId !== Number(subCategoryFilter)
    )
      return acc;
    if (!acc.find((item: any) => item.id === p.id))
      acc.push({ id: p.id, name: p.name });
    return acc;
  }, []);

  const totalWeightKg = items
    .reduce((sum, item) => sum + item.packCount * item.weightKg, 0)
    .toFixed(2);
  const hasLooseItems = items.some((i) => i.isLoose);
  const hasPackItems = items.some((i) => !i.isLoose);

  const canSubmit =
    items.length > 0 &&
    items.every((i) => i.packCount > 0 && i.packCount <= i.availableStock) &&
    cartonPrice !== "" &&
    Number(cartonPrice) >= 0 &&
    (deliveryCost === "" || Number(deliveryCost) >= 0);

  const addItem = (variant: any, product: any) => {
    const vid = variant.variantId || variant.id;
    if (items.find((i) => i.variantId === vid)) return;
    const receivingMode = variant.variantOperations?.receivingMode;
    const packType = variant.packType || variant.packagingType || "other";
    const isLoose = packType === "loose";
    if (!isCartonVariantEligible({ receivingMode, packType })) {
      toast.error("Loose inventory cannot be placed directly inside a carton");
      return;
    }
    const totalStock = Math.max(
      0,
      parseFloat(String(variant.stock?.availableQty ?? 0)),
    );
    const stockInCartons = Math.max(
      0,
      parseFloat(String(variant.stock?.inCartonQty ?? 0)),
    );
    const looseStock = variant.stock?.looseStock ?? 0;
    const availableForCarton = Math.max(0, parseFloat(String(looseStock)));
    const newItem: CartonItem = {
      variantId: vid,
      sku: variant.sku || "—",
      productName: product.name || product.productName,
      brandName: variant.brand?.name || product.brand?.name || null,
      variantLabel: isLoose
        ? `Loose · per KG`
        : `${variant.unitLabel || variant.label} · ${variant.weightKg || variant.weight}KG`,
      weightKg: parseFloat(variant.weightKg || variant.weight || "0"),
      packCount: 0,
      availableStock: isLoose
        ? availableForCarton
        : Math.max(0, Math.floor(availableForCarton)),
      totalStock: isLoose ? totalStock : Math.floor(totalStock),
      stockInCartons: isLoose ? stockInCartons : Math.floor(stockInCartons),
      availableForCarton: isLoose
        ? availableForCarton
        : Math.max(0, Math.floor(availableForCarton)),
      image: product.coreProduct?.image || product.image || null,
      isLoose,
      operationalUnit: String(
        variant.variantOperations?.operationalUnit || packType || "unit",
      ).toLowerCase(),
    };
    setItems(() => [newItem]);
    setSearchQuery("");
    setCartonPrice("");
    setDeliveryCost("");
  };

  const removeItem = (variantId: number) => {
    setItems((currentItems) =>
      currentItems.filter((item) => item.variantId !== variantId),
    );
    setCartonPrice("");
    setDeliveryCost("");
  };

  const handlePackCountChange = (packCount: number) => {
    setItems((currentItems) =>
      currentItems.map((item) => ({ ...item, packCount })),
    );
  };

  const createMutation = useMutation({
    mutationFn: () =>
      (orpc.warehouse as any).createCarton.call({
        variantId: items[0]?.variantId,
        packsPerCarton: items[0]?.packCount,
        cartonPrice,
        deliveryCost: deliveryCost || undefined,
        storageAreaId: storageAreaId ? Number(storageAreaId) : undefined,
        note: note || undefined,
      }),
    onSuccess: (res: any) => {
      toast.success(`Carton ${res.cartonId} created!`);
      qc.invalidateQueries({ queryKey: ["warehouse"] });
      router.push("/warehouse/dashboard/carton-tracking");
    },
    onError: (err: any) => toast.error(err.message || "Failed"),
  });

  const summaryPanelProps = {
    items,
    nextCartonId,
    totalWeightKg,
    cartonPrice,
    deliveryCost,
    hasLooseItems,
    hasPackItems,
    canSubmit,
    isPending: createMutation.isPending,
    onCartonPriceChange: setCartonPrice,
    onDeliveryCostChange: setDeliveryCost,
    onCreate: () => createMutation.mutate(),
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="w-full px-6 lg:px-10 xl:px-12">
          <div className="flex items-center justify-between h-[60px]">
            <div className="flex items-center gap-4">
              <Link href="/warehouse/dashboard/carton-tracking">
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <ArrowLeft size={18} />
                </Button>
              </Link>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-foreground">
                  Create carton
                </h1>
                <p className="text-sm text-foreground/50 hidden sm:block">
                  Add product, configure, and submit in one screen
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-foreground/55 bg-muted px-2.5 py-1 rounded-md">
              Single product
            </span>
          </div>
        </div>
      </div>

      <div className="w-full px-6 lg:px-10 xl:px-12 py-8 pb-28 lg:pb-10">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_400px] gap-8 xl:gap-10 items-start">
          {/* Main form — single panel, sections divided by borders */}
          <div className="min-w-0 rounded-xl border bg-card shadow-sm divide-y">
            <div className="px-5 py-5 lg:px-7 lg:py-6">
              <CartonProductPicker
                items={items}
                searchQuery={searchQuery}
                categoryFilter={categoryFilter}
                subCategoryFilter={subCategoryFilter}
                productFilter={productFilter}
                hasActiveFilters={hasActiveFilters}
                allCategories={allCategories}
                allSubCategories={allSubCategories}
                allProductNames={allProductNames}
                products={products}
                totalWeightKg={totalWeightKg}
                hasLooseItems={hasLooseItems}
                hasPackItems={hasPackItems}
                onSearchChange={setSearchQuery}
                onCategoryChange={setCategoryFilter}
                onSubCategoryChange={setSubCategoryFilter}
                onProductFilterChange={setProductFilter}
                onAddItem={addItem}
                onRemoveItem={removeItem}
              />
            </div>

            {items.length > 0 && (
              <>
                <div className="px-5 py-5 lg:px-7 lg:py-6">
                  <CartonConfiguration
                    items={items}
                    areas={areas}
                    storageAreaId={storageAreaId}
                    totalWeightKg={totalWeightKg}
                    onPackCountChange={handlePackCountChange}
                    onStorageAreaChange={setStorageAreaId}
                  />
                </div>

                <div className="px-5 py-5 lg:px-7 lg:py-6">
                  <CartonNotes note={note} onNoteChange={setNote} />
                </div>
              </>
            )}
          </div>

          {/* Summary sidebar */}
          <aside className="hidden xl:block">
            <div className="sticky top-[76px] rounded-xl border bg-card shadow-sm p-6 lg:p-7">
              <p className="text-[15px] font-semibold text-foreground mb-1">
                Summary
              </p>
              <p className="text-sm text-foreground/50 mb-6">
                Live preview of this carton
              </p>
              <CartonSummaryPanel {...summaryPanelProps} showActions />
            </div>
          </aside>
        </div>

        {/* Mobile / tablet summary */}
        <div className="xl:hidden mt-8 rounded-xl border bg-card shadow-sm p-6">
          <p className="text-[15px] font-semibold text-foreground mb-1">
            Summary
          </p>
          <p className="text-sm text-foreground/50 mb-6">
            Live preview of this carton
          </p>
          <CartonSummaryPanel {...summaryPanelProps} showActions={false} />
        </div>
      </div>

      <div className="xl:hidden fixed bottom-0 inset-x-0 z-10 bg-background/95 backdrop-blur-sm border-t px-6 py-4">
        <div className="flex items-center gap-3 max-w-none">
          <Link
            href="/warehouse/dashboard/carton-tracking"
            className="flex-shrink-0"
          >
            <Button variant="outline" className="h-11 text-sm">
              Cancel
            </Button>
          </Link>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
            className="flex-1 gap-2 h-11 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <PackagePlus size={16} />
            {createMutation.isPending ? "Creating..." : "Create carton"}
          </Button>
        </div>
      </div>
    </div>
  );
}
