"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  Layers,
  PackageIcon,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Tag,
  X,
  XCircle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { orpc } from "@/utils/orpc";

// ─── Types ─────────────────────────────────────────────────────

type CatalogVariant = {
  id: number;
  sku: string;
  unitLabel: string;
  weightKg: string;
  price: string;
  brandId: number | null;
  brand: { id: number; name: string } | null;
  inInventory: boolean;
};

type CatalogProduct = {
  id: number;
  name: string;
  unitSize: string | null;
  variants: CatalogVariant[];
};

type CoreProduct = {
  id: number;
  name: string;
  slug: string;
  image: string;
  brandSupport: string;
  brands: { brand: { id: number; name: string; logo: string; slug: string } }[];
  variantLinks: { variantOption: { id: number; name: string; unit: string; size: string | null } }[];
  products: CatalogProduct[];
};

type SubCategory = {
  id: number;
  name: string;
  slug: string;
  coreProducts: CoreProduct[];
};

type CatalogCategory = {
  id: number;
  name: string;
  slug: string;
  subCategories: SubCategory[];
  directCoreProducts: CoreProduct[];
};

type CatalogType = {
  id: number;
  name: string;
  slug: string;
  categories: CatalogCategory[];
};

// ─── Main Page Component ───────────────────────────────────────

export default function WarehouseProductCatalogPage() {
  const queryClient = useQueryClient();

  // Filters
  const [selectedTypeId, setSelectedTypeId] = useState<number | undefined>();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>();
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<number | undefined>();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Expand/collapse state
  const [expandedCoreProducts, setExpandedCoreProducts] = useState<Set<number>>(new Set());

  // Add to inventory state
  const [addingVariant, setAddingVariant] = useState<number | null>(null);
  const [retailPrice, setRetailPrice] = useState("");
  const [initialStock, setInitialStock] = useState("0");

  // Request modal
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showRequests, setShowRequests] = useState(false);

  // Search debounce
  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((window as any).__catalogSearchTimer);
    (window as any).__catalogSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
    }, 400);
  };

  // ─── Queries ─────────────────────────────────────────────────

  const { data: catalogData, isLoading: loadingCatalog } = useQuery({
    queryKey: [
      "warehouse",
      "getCatalogHierarchy",
      { typeId: selectedTypeId, categoryId: selectedCategoryId, subCategoryId: selectedSubCategoryId, search: debouncedSearch },
    ],
    queryFn: () =>
      orpc.warehouse.getCatalogHierarchy.call({
        typeId: selectedTypeId,
        categoryId: selectedCategoryId,
        subCategoryId: selectedSubCategoryId,
        search: debouncedSearch || undefined,
      }),
  });

  const { data: inventoryData, isLoading: loadingInventory } = useQuery({
    queryKey: ["warehouse", "getMyInventory", { search: "", page: 1, limit: 100 }],
    queryFn: () => orpc.warehouse.getMyInventory.call({ search: "", page: 1, limit: 100 }),
  });

  const { data: requestsData } = useQuery({
    queryKey: ["warehouse", "getMyProductRequests", {}],
    queryFn: () => orpc.warehouse.getMyProductRequests.call({}),
    enabled: showRequests,
  });

  // ─── Mutations ───────────────────────────────────────────────

  const addMutation = useMutation({
    mutationFn: (data: { variantId: number; retailPrice: string; initialStock: string }) =>
      orpc.warehouse.addToInventory.call(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      setAddingVariant(null);
      setRetailPrice("");
      setInitialStock("0");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (inventoryId: number) =>
      orpc.warehouse.removeFromInventory.call({ inventoryId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
    },
  });

  const requestMutation = useMutation({
    mutationFn: (data: { typeName?: string; categoryName?: string; subCategoryName?: string; productName: string; description?: string }) =>
      orpc.warehouse.submitProductRequest.call(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse", "getMyProductRequests"] });
      setShowRequestModal(false);
    },
  });

  // ─── Derived Data ────────────────────────────────────────────

  const types: CatalogType[] = catalogData?.types ?? [];
  const inventoryItems = inventoryData?.items ?? [];
  const requests = requestsData?.requests ?? [];

  // Extract unique types and categories for filter dropdowns
  const allTypes = types.map((t) => ({ id: t.id, name: t.name }));
  const allCategories = selectedTypeId
    ? types.find((t) => t.id === selectedTypeId)?.categories ?? []
    : types.flatMap((t) => t.categories);
  const allSubCategories = selectedCategoryId
    ? allCategories.find((c) => c.id === selectedCategoryId)?.subCategories ?? []
    : [];

  // Toggle core product expansion
  const toggleCoreProduct = (id: number) => {
    setExpandedCoreProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Render Helpers ──────────────────────────────────────────

  const renderVariantRow = (variant: CatalogVariant, unitSize?: string | null) => {
    const packsPerUnit = unitSize && Number(unitSize) > 0 && Number(variant.weightKg) > 0
      ? Math.floor(Number(unitSize) / Number(variant.weightKg))
      : null;

    return (
    <div
      key={variant.id}
      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
        variant.inInventory
          ? "bg-emerald-50 border border-emerald-100"
          : "bg-gray-50 border border-gray-100 hover:border-gray-200"
      }`}
    >
      <div className="flex items-center gap-2 flex-1 flex-wrap">
        {variant.brand && (
          <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
            {variant.brand.name}
          </span>
        )}
        <span className="font-medium text-gray-700">
          {variant.unitLabel} — {variant.weightKg}kg
        </span>
        {packsPerUnit && packsPerUnit > 1 && (
          <span className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
            {packsPerUnit} pcs/carton
          </span>
        )}
        {variant.sku && (
          <span className="text-gray-400 text-[10px]">
            {variant.sku}
          </span>
        )}
        <span className="text-gray-500">
          Base: ৳{Number(variant.price).toLocaleString()}
        </span>
      </div>

      {variant.inInventory ? (
        <span className="flex items-center gap-1 text-emerald-600 font-medium text-[10px]">
          <Check size={12} />
          In Stock
        </span>
      ) : addingVariant === variant.id ? (
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Retail ৳"
            value={retailPrice}
            onChange={(e) => setRetailPrice(e.target.value)}
            className="w-24 px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-emerald-500 outline-none"
          />
          <input
            type="number"
            placeholder="Qty"
            value={initialStock}
            onChange={(e) => setInitialStock(e.target.value)}
            className="w-16 px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-emerald-500 outline-none"
          />
          <button
            onClick={() => {
              if (!retailPrice) return;
              addMutation.mutate({
                variantId: variant.id,
                retailPrice,
                initialStock: initialStock || "0",
              });
            }}
            disabled={addMutation.isPending || !retailPrice}
            className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {addMutation.isPending ? "..." : "Add"}
          </button>
          <button
            onClick={() => { setAddingVariant(null); setRetailPrice(""); setInitialStock("0"); }}
            className="px-1 py-1 text-gray-400 hover:text-gray-600"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setAddingVariant(variant.id);
            setRetailPrice(variant.price);
            setInitialStock("0");
          }}
          className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-medium hover:bg-emerald-100 transition-colors"
        >
          + Add
        </button>
      )}
    </div>
    );
  };

  const renderCoreProduct = (cp: CoreProduct) => {
    const isExpanded = expandedCoreProducts.has(cp.id);
    const allVariants = cp.products.flatMap((p) => p.variants);
    const inStockCount = allVariants.filter((v) => v.inInventory).length;
    const unitSize = cp.products[0]?.unitSize;

    return (
      <div key={cp.id} className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Core Product Header */}
        <button
          onClick={() => toggleCoreProduct(cp.id)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
        >
          {cp.image && (
            <Image
              src={cp.image}
              alt={cp.name}
              width={40}
              height={40}
              className="w-10 h-10 rounded-lg object-cover border border-gray-100"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              {cp.name}
              {unitSize && Number(unitSize) > 0 && (
                <span className="text-[10px] font-medium text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                  📦 {Number(unitSize)}KG Carton/Sack
                </span>
              )}
            </div>
            <div className="flex gap-1.5 mt-1 flex-wrap">
              {cp.brands.map((b) => (
                <span key={b.brand.id} className="text-[9px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                  {b.brand.name}
                </span>
              ))}
              {cp.variantLinks.map((vl) => (
                <span key={vl.variantOption.id} className="text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                  {vl.variantOption.name}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {allVariants.length > 0 && (
              <span className="text-[10px] text-gray-400">
                {inStockCount}/{allVariants.length} added
              </span>
            )}
            {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
          </div>
        </button>

        {/* Expanded: Variants */}
        {isExpanded && (
          <div className="border-t border-gray-100 px-4 py-3 space-y-1.5 bg-gray-50/50">
            {unitSize && Number(unitSize) > 0 && (
              <div className="text-[10px] text-orange-600 bg-orange-50 border border-orange-100 rounded px-2.5 py-1.5 mb-2">
                📦 Total Unit Size: <strong>{Number(unitSize)}KG</strong> per carton/sack
              </div>
            )}
            {allVariants.length === 0 ? (
              <div className="text-xs text-gray-400 py-2 text-center">
                No sellable variants yet. Admin needs to create a product for this Core Identity.
              </div>
            ) : (
              allVariants.map((v) => renderVariantRow(v, unitSize))
            )}
          </div>
        )}
      </div>
    );
  };

  // ─── Page Layout ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="text-emerald-600" size={24} />
            Product Catalog
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Browse products by Type → Category → Sub Category → Core Identity
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRequests(!showRequests)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Clock size={14} />
            My Requests
          </button>
          <button
            onClick={() => setShowRequestModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
          >
            <Plus size={14} />
            Request Product
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-gray-400" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filter By</span>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search product name..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
          <select
            value={selectedTypeId ?? ""}
            onChange={(e) => {
              setSelectedTypeId(e.target.value ? Number(e.target.value) : undefined);
              setSelectedCategoryId(undefined);
              setSelectedSubCategoryId(undefined);
            }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none min-w-[140px]"
          >
            <option value="">All Types</option>
            {allTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select
            value={selectedCategoryId ?? ""}
            onChange={(e) => {
              setSelectedCategoryId(e.target.value ? Number(e.target.value) : undefined);
              setSelectedSubCategoryId(undefined);
            }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none min-w-[160px]"
          >
            <option value="">All Categories</option>
            {allCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={selectedSubCategoryId ?? ""}
            onChange={(e) =>
              setSelectedSubCategoryId(e.target.value ? Number(e.target.value) : undefined)
            }
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none min-w-[180px]"
            disabled={!selectedCategoryId}
          >
            <option value="">All Sub Categories</option>
            {allSubCategories.map((sc) => (
              <option key={sc.id} value={sc.id}>{sc.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Catalog Content */}
      {loadingCatalog ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading catalog...</div>
      ) : types.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border rounded-xl bg-gray-50/50">
          <Tag className="text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 text-lg font-medium">No products available</p>
          <p className="text-sm text-gray-400 mt-1 max-w-sm">
            Ask admin to assign categories to your warehouse, then products from those categories will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {types.map((type) => (
            <div key={type.id} className="space-y-4">
              {/* Type Header */}
              <div className="flex items-center gap-2">
                <div className="h-6 w-1 bg-emerald-500 rounded-full" />
                <h2 className="text-lg font-bold text-gray-800">{type.name}</h2>
                <span className="text-xs text-gray-400 ml-1">
                  {type.categories.length} categories
                </span>
              </div>

              {type.categories.map((cat) => (
                <div key={cat.id} className="ml-3 space-y-3">
                  {/* Category Header */}
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-0.5 bg-blue-400 rounded-full" />
                    <h3 className="text-sm font-semibold text-gray-700">{cat.name}</h3>
                    <span className="text-[10px] text-gray-400">
                      {cat.subCategories.length} sub-categories
                    </span>
                  </div>

                  {/* Sub Categories */}
                  {cat.subCategories.map((sc) => (
                    <div key={sc.id} className="ml-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-0.5 bg-purple-300 rounded-full" />
                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          {sc.name}
                        </h4>
                        <span className="text-[10px] text-gray-300">
                          {sc.coreProducts.length} products
                        </span>
                      </div>

                      <div className="ml-3 space-y-2">
                        {sc.coreProducts.map(renderCoreProduct)}
                      </div>
                    </div>
                  ))}

                  {/* Direct core products (no subcategory) */}
                  {cat.directCoreProducts?.length > 0 && (
                    <div className="ml-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-0.5 bg-gray-300 rounded-full" />
                        <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                          General
                        </h4>
                      </div>
                      <div className="ml-3 space-y-2">
                        {cat.directCoreProducts.map(renderCoreProduct)}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Can't find product? */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
        <AlertCircle className="mx-auto text-amber-500 mb-2" size={24} />
        <p className="text-sm font-medium text-amber-800">Can&apos;t find your product?</p>
        <p className="text-xs text-amber-600 mt-1">
          If your product or design is not listed, request a new product identity.
        </p>
        <button
          onClick={() => setShowRequestModal(true)}
          className="mt-3 px-4 py-2 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 transition-colors"
        >
          + Request New Product Identity
        </button>
      </div>

      {/* My Requests */}
      {showRequests && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Clock size={14} />
              My Product Requests
            </h3>
            <button onClick={() => setShowRequests(false)} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
          {requests.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No requests yet.</p>
          ) : (
            <div className="space-y-2">
              {requests.map((req: any) => (
                <div
                  key={req.id}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${
                    req.status === "pending"
                      ? "bg-yellow-50 border-yellow-200"
                      : req.status === "approved"
                      ? "bg-emerald-50 border-emerald-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium text-gray-800">{req.productName}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {[req.typeName, req.categoryName, req.subCategoryName].filter(Boolean).join(" → ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {req.status === "pending" && <Clock size={12} className="text-yellow-600" />}
                    {req.status === "approved" && <CheckCircle2 size={12} className="text-emerald-600" />}
                    {req.status === "rejected" && <XCircle size={12} className="text-red-600" />}
                    <span className={`text-[10px] font-medium capitalize ${
                      req.status === "pending" ? "text-yellow-700" : req.status === "approved" ? "text-emerald-700" : "text-red-700"
                    }`}>
                      {req.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Current Inventory */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3">
          <ShoppingBag size={20} className="text-emerald-600" />
          My Inventory
          <span className="text-xs font-normal text-gray-400 ml-1">
            ({inventoryItems.length} items)
          </span>
        </h2>

        {loadingInventory ? (
          <div className="text-center py-8 text-gray-400 text-sm">Loading inventory...</div>
        ) : inventoryItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-gray-50/50">
            <PackageIcon className="text-gray-300 mb-3" size={36} />
            <p className="text-gray-500 font-medium">No products in inventory</p>
            <p className="text-sm text-gray-400 mt-1">
              Browse the catalog above and add products to start selling.
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 text-xs font-semibold text-gray-400 uppercase">
              <div className="col-span-4">Product</div>
              <div className="col-span-2">Base Price</div>
              <div className="col-span-2">Retail Price</div>
              <div className="col-span-2">Stock</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {inventoryItems.map((item: any) => {
              const product = item.variant?.product;
              const variant = item.variant;
              return (
                <div
                  key={item.id}
                  className="grid grid-cols-12 gap-3 items-center bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-gray-300 transition-colors"
                >
                  <div className="col-span-4 flex items-center gap-3">
                    {product?.images?.[0] && (
                      <Image
                        src={product.images[0].imageUrl}
                        alt={product.name}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900 line-clamp-1 flex items-center gap-1.5">
                        {product?.name || "Unknown"}
                        {variant?.brand && (
                          <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                            {variant.brand.name}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {variant?.unitLabel} — {variant?.weightKg}kg
                        {variant?.sku && ` • ${variant.sku}`}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 text-sm text-gray-500">
                    ৳{Number(variant?.price || 0).toLocaleString()}
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm font-semibold text-emerald-700">
                      ৳{Number(item.retailPrice || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className={`text-sm font-medium ${Number(item.availableQty) > 0 ? "text-gray-900" : "text-red-500"}`}>
                      {Number(item.availableQty).toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-400 ml-1">qty</span>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button
                      onClick={() => {
                        if (confirm("Remove this product from your inventory?")) {
                          removeMutation.mutate(item.id);
                        }
                      }}
                      className="text-[10px] px-2 py-1 text-red-500 hover:bg-red-50 border border-red-200 rounded"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Request Modal */}
      {showRequestModal && <RequestModal onClose={() => setShowRequestModal(false)} onSubmit={requestMutation} />}
    </div>
  );
}

// ─── Request Modal Component ───────────────────────────────────

function RequestModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: { mutate: (data: any) => void; isPending: boolean };
}) {
  const [form, setForm] = useState({
    typeName: "",
    categoryName: "",
    subCategoryName: "",
    productName: "",
    description: "",
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Send size={18} className="text-amber-500" />
            Request New Product
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Type (optional)</label>
            <input
              type="text"
              placeholder="e.g. Grocery, Fashion, Electronics"
              value={form.typeName}
              onChange={(e) => setForm({ ...form, typeName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Category (optional)</label>
            <input
              type="text"
              placeholder="e.g. Rice, Oil, T-Shirt"
              value={form.categoryName}
              onChange={(e) => setForm({ ...form, categoryName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Sub Category (optional)</label>
            <input
              type="text"
              placeholder="e.g. Miniket, Basmati, Round Neck"
              value={form.subCategoryName}
              onChange={(e) => setForm({ ...form, subCategoryName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Product Name *</label>
            <input
              type="text"
              placeholder="e.g. Miniket Rice, Soybean Oil"
              value={form.productName}
              onChange={(e) => setForm({ ...form, productName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-amber-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Description (optional)</label>
            <textarea
              placeholder="Any additional details or notes..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-amber-500 outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!form.productName.trim()) return;
              onSubmit.mutate({
                typeName: form.typeName || undefined,
                categoryName: form.categoryName || undefined,
                subCategoryName: form.subCategoryName || undefined,
                productName: form.productName,
                description: form.description || undefined,
              });
            }}
            disabled={onSubmit.isPending || !form.productName.trim()}
            className="flex-1 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {onSubmit.isPending ? "Submitting..." : "Submit Request"}
          </button>
        </div>

        <p className="text-[10px] text-gray-400 mt-3 text-center">
          Your request will be reviewed by admin. Once approved, the product will appear in the catalog.
        </p>
      </div>
    </div>
  );
}
