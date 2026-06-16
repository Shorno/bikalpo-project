import { Check, Package, Search, Trash2 } from "lucide-react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionHeader } from "./section-header";
import type { CartonItem } from "./types";

type CartonProductPickerProps = {
  items: CartonItem[];
  searchQuery: string;
  categoryFilter: string;
  subCategoryFilter: string;
  productFilter: string;
  hasActiveFilters: boolean;
  allCategories: Array<{ id: number; name: string }>;
  allSubCategories: Array<{ id: number; name: string }>;
  allProductNames: Array<{ id: number; name: string }>;
  products: any[];
  totalWeightKg: string;
  hasLooseItems: boolean;
  hasPackItems: boolean;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSubCategoryChange: (value: string) => void;
  onProductFilterChange: (value: string) => void;
  onAddItem: (variant: any, product: any) => void;
  onUpdatePackCount: (variantId: number, count: number) => void;
  onRemoveItem: (variantId: number) => void;
};

export function CartonProductPicker({
  items,
  searchQuery,
  categoryFilter,
  subCategoryFilter,
  productFilter,
  hasActiveFilters,
  allCategories,
  allSubCategories,
  allProductNames,
  products,
  totalWeightKg,
  hasLooseItems,
  hasPackItems,
  onSearchChange,
  onCategoryChange,
  onSubCategoryChange,
  onProductFilterChange,
  onAddItem,
  onUpdatePackCount,
  onRemoveItem,
}: CartonProductPickerProps) {
  const hideFilters = items.length > 0;

  return (
    <div>
      <SectionHeader
        title="Select product"
        description="Search inventory and choose one variant for this carton."
      />

      <div className="space-y-4">
        {!hideFilters && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium text-foreground/80 mb-2 block">Category</Label>
                <Select
                  value={categoryFilter}
                  onValueChange={(val) => {
                    onCategoryChange(val);
                    onSubCategoryChange("all");
                    onProductFilterChange("all");
                  }}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {allCategories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-foreground/80 mb-2 block">Sub-category</Label>
                <Select
                  value={subCategoryFilter}
                  onValueChange={(val) => {
                    onSubCategoryChange(val);
                    onProductFilterChange("all");
                  }}
                  disabled={categoryFilter === "all"}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue
                      placeholder={
                        categoryFilter === "all" ? "Select category first" : "All sub-categories"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sub-categories</SelectItem>
                    {allSubCategories.map((sc) => (
                      <SelectItem key={sc.id} value={String(sc.id)}>
                        {sc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-foreground/80 mb-2 block">Product</Label>
                <Select
                  value={productFilter}
                  onValueChange={onProductFilterChange}
                  disabled={allProductNames.length === 0}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="All products" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All products</SelectItem>
                    {allProductNames.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
              <Input
                placeholder="Search by SKU or product name..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 h-10 text-sm"
              />
            </div>
          </div>
        )}

        {hasActiveFilters && !hideFilters && (
          <div className="max-h-72 overflow-y-auto rounded-lg border divide-y">
            {products.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Search size={24} className="text-foreground/25 mb-3" />
                <p className="text-sm font-medium text-foreground/70">No products found</p>
                <p className="text-sm text-foreground/45 mt-1">Try different filters or search terms</p>
              </div>
            ) : (
              products.map((p: any) =>
                (p.variants || []).map((v: any) => {
                  const vid = v.variantId || v.id;
                  const alreadyAdded = items.find((i) => i.variantId === vid);
                  const looseStock = Math.max(0, Math.floor(v.stock?.looseStock ?? 0));
                  const outOfStock = looseStock <= 0;
                  const productImage = p.coreProduct?.image || p.image;
                  return (
                    <div
                      key={vid}
                      className={`flex items-center gap-4 px-4 py-3.5 transition-colors ${
                        alreadyAdded
                          ? "bg-emerald-50/50 dark:bg-emerald-950/15 cursor-default"
                          : outOfStock
                            ? "opacity-50 cursor-not-allowed"
                            : "cursor-pointer hover:bg-muted/40"
                      }`}
                      onClick={() => !alreadyAdded && !outOfStock && onAddItem(v, p)}
                    >
                      <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {productImage ? (
                          <Image
                            src={productImage}
                            alt={p.name || ""}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package size={18} className="text-foreground/35" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-foreground truncate">
                            {p.name || p.productName}
                          </p>
                          {(v.brand?.name || p.brand?.name) && (
                            <span className="text-xs text-foreground/55 bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                              {v.brand?.name || p.brand?.name}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-foreground/50 mt-0.5 truncate">
                          {v.unitLabel || v.label} · {v.weightKg || v.weight}KG
                          {v.sku ? ` · ${v.sku}` : ""}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-medium tabular-nums px-2 py-1 rounded-md flex-shrink-0 ${
                          outOfStock
                            ? "bg-red-50 text-red-600 dark:bg-red-950/30"
                            : "text-foreground/60"
                        }`}
                      >
                        {outOfStock ? "No stock" : `${looseStock} avail.`}
                      </span>
                      {alreadyAdded ? (
                        <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1 flex-shrink-0">
                          <Check size={14} /> Added
                        </span>
                      ) : !outOfStock ? (
                        <span className="text-xs font-medium text-foreground/55 flex-shrink-0">
                          Add →
                        </span>
                      ) : null}
                    </div>
                  );
                }),
              )
            )}
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-3 pt-1">
            <p className="text-sm font-medium text-foreground/80">Selected item</p>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2.5 px-3 text-sm font-medium text-foreground/55">
                      SKU
                    </th>
                    <th className="text-left py-2.5 px-3 text-sm font-medium text-foreground/55">
                      Product
                    </th>
                    <th className="text-left py-2.5 px-3 text-sm font-medium text-foreground/55">
                      Variant
                    </th>
                    <th className="text-center py-2.5 px-3 text-sm font-medium text-foreground/55">
                      Available
                    </th>
                    <th className="text-center py-2.5 px-3 text-sm font-medium text-foreground/55">
                      Qty {hasLooseItems && hasPackItems ? "" : hasLooseItems ? "(KG)" : "(pack)"}
                    </th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const overLimit = item.packCount > item.availableStock;
                    return (
                      <tr key={item.variantId} className="border-b last:border-0">
                        <td className="py-3.5 px-3 font-mono text-sm text-foreground/60">{item.sku}</td>
                        <td className="py-3.5 px-3">
                          <span className="font-medium text-foreground">{item.productName}</span>
                          {item.brandName && (
                            <span className="ml-2 text-xs text-foreground/50">{item.brandName}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-foreground/65">{item.variantLabel}</td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="text-sm font-medium tabular-nums text-foreground/70">
                            {item.isLoose ? `${item.availableStock.toFixed(1)} KG` : item.availableStock}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1.5 justify-center">
                              <Input
                                type="number"
                                min={item.isLoose ? 0.1 : 1}
                                max={item.availableStock}
                                step={item.isLoose ? 0.1 : 1}
                                value={item.packCount || ""}
                                onChange={(e) =>
                                  onUpdatePackCount(item.variantId, Number(e.target.value) || 0)
                                }
                                placeholder="0"
                                className={`w-20 h-9 text-center text-sm font-medium ${
                                  overLimit ? "border-red-400 text-red-600" : ""
                                }`}
                              />
                              {item.isLoose && (
                                <span className="text-sm text-foreground/50">KG</span>
                              )}
                            </div>
                            {overLimit && (
                              <span className="text-xs text-red-600 font-medium">
                                Max{" "}
                                {item.isLoose
                                  ? `${item.availableStock.toFixed(1)} KG`
                                  : item.availableStock}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.variantId)}
                            className="p-1.5 rounded-md text-foreground/40 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            aria-label="Remove item"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-sm">
              <div className="flex items-center gap-2 text-foreground/60">
                <Package size={15} />
                <span>Total</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 font-medium text-foreground">
                {hasPackItems && (
                  <span>
                    {items.filter((i) => !i.isLoose).reduce((s, i) => s + i.packCount, 0)} pack
                    {items.filter((i) => !i.isLoose).reduce((s, i) => s + i.packCount, 0) !== 1
                      ? "s"
                      : ""}
                  </span>
                )}
                {hasLooseItems && (
                  <>
                    {hasPackItems && <span className="text-foreground/25">·</span>}
                    <span>
                      {items
                        .filter((i) => i.isLoose)
                        .reduce((s, i) => s + i.packCount, 0)
                        .toFixed(1)}{" "}
                      KG loose
                    </span>
                  </>
                )}
                <span className="text-foreground/25">·</span>
                <span className="tabular-nums">{totalWeightKg} KG</span>
              </div>
            </div>
          </div>
        )}

        {items.length === 0 && !hasActiveFilters && (
          <div className="flex flex-col items-center py-14 text-center rounded-lg border border-dashed">
            <Package size={28} className="text-foreground/20 mb-3" />
            <p className="text-sm font-medium text-foreground/70">No product selected</p>
            <p className="text-sm text-foreground/45 mt-1">
              Use the filters or search above to find a product
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
