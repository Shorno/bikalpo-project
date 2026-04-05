"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  Layers,
  Plus,
  Store,
  Tag,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { orpc } from "@/utils/orpc";

export default function ShopCategoryAssignmentsPage() {
  const queryClient = useQueryClient();
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [expandedTypes, setExpandedTypes] = useState<Set<number>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(
    new Set(),
  );

  // Fetch shops
  const { data: shopData, isLoading: loadingShops } = useQuery({
    queryKey: ["adminShopCategoryAssignment", "getShops"],
    queryFn: () => orpc.adminShopCategoryAssignment.getShops.call({}),
  });

  // Fetch assignments for selected shop
  const { data: assignmentData, isLoading: loadingAssignments } = useQuery({
    queryKey: [
      "adminShopCategoryAssignment",
      "getShopAssignments",
      selectedShopId,
    ],
    queryFn: () =>
      orpc.adminShopCategoryAssignment.getShopAssignments.call({
        shopId: selectedShopId!,
      }),
    enabled: !!selectedShopId,
  });

  // Fetch categories with types and subcategories
  const { data: categoryData } = useQuery({
    queryKey: ["adminWarehouseAssignment", "getCategoriesWithSubs"],
    queryFn: () => orpc.adminWarehouseAssignment.getCategoriesWithSubs.call({}),
    enabled: showPicker,
  });

  // Fetch product types
  const { data: typeData } = useQuery({
    queryKey: ["adminProductType", "getAll"],
    queryFn: () => orpc.adminProductType.getAll.call({}),
    enabled: showPicker,
  });

  const assignMutation = useMutation({
    mutationFn: (data: {
      shopId: string;
      categoryId: number;
      subcategoryId?: number;
    }) => orpc.adminShopCategoryAssignment.assignShopCategory.call(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["adminShopCategoryAssignment", "getShopAssignments"],
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) =>
      orpc.adminShopCategoryAssignment.removeShopCategory.call({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["adminShopCategoryAssignment", "getShopAssignments"],
      });
    },
  });

  const shops = shopData?.shops ?? [];
  const assignments = assignmentData?.assignments ?? [];
  const categories = categoryData?.categories ?? [];
  const types = typeData?.types ?? [];

  // Group categories by type
  const categoriesByType = new Map<number | null, any[]>();
  for (const cat of categories) {
    const key = cat.typeId ?? null;
    if (!categoriesByType.has(key)) categoriesByType.set(key, []);
    categoriesByType.get(key)!.push(cat);
  }

  const isAssigned = (categoryId: number, subcategoryId?: number) => {
    return assignments.some(
      (a: any) =>
        a.categoryId === categoryId &&
        (subcategoryId ? a.subcategoryId === subcategoryId : !a.subcategoryId),
    );
  };

  const handleAssign = (categoryId: number, subcategoryId?: number) => {
    if (!selectedShopId) return;
    assignMutation.mutate({
      shopId: selectedShopId,
      categoryId,
      subcategoryId,
    });
  };

  const toggleType = (typeId: number) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      next.has(typeId) ? next.delete(typeId) : next.add(typeId);
      return next;
    });
  };

  const toggleCategory = (catId: number) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(catId) ? next.delete(catId) : next.add(catId);
      return next;
    });
  };

  const selectedShop = shops.find((s: any) => s.id === selectedShopId);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FolderTree className="text-blue-600" size={24} />
          Shop Category Assignments
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Assign product categories to shops — controls which warehouse products
          they can order from
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Shop list (left) */}
        <div className="col-span-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase mb-2">
            Shops ({shops.length})
          </h2>
          {loadingShops ? (
            <div className="text-gray-400 text-sm py-4">Loading...</div>
          ) : shops.length === 0 ? (
            <div className="text-gray-400 text-sm py-4">
              No shops registered yet
            </div>
          ) : (
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {shops.map((s: any) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => {
                    setSelectedShopId(s.id);
                    setShowPicker(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors ${
                    selectedShopId === s.id
                      ? "bg-blue-50 border border-blue-200 text-blue-800"
                      : "bg-white border border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Store size={14} className="shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {s.shopName || s.name}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">
                        {s.businessType || "retail"} • {s.email}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-gray-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Assignments (right) */}
        <div className="col-span-8">
          {!selectedShopId ? (
            <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
              <Store className="mx-auto text-gray-300 mb-3" size={48} />
              <p className="text-gray-500 font-medium">Select a shop</p>
              <p className="text-sm text-gray-400 mt-1">
                Choose a shop from the left to manage its allowed categories
              </p>
            </div>
          ) : (
            <div>
              {/* Shop info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-3 text-sm text-blue-700">
                <span className="font-medium">
                  {selectedShop?.shopName || selectedShop?.name}
                </span>
                <span className="text-blue-500 ml-2">
                  ({selectedShop?.businessType || "retail"})
                </span>
              </div>

              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">
                  Allowed Categories ({assignments.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setShowPicker(!showPicker)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                >
                  <Plus size={14} />
                  Assign Category
                </button>
              </div>

              {/* Category Picker */}
              {showPicker && (
                <div className="mb-4 bg-white border border-blue-200 rounded-xl p-4 shadow-sm max-h-96 overflow-y-auto">
                  <h3 className="text-xs font-semibold text-gray-500 mb-3">
                    Browse by Type → Category → Subcategory:
                  </h3>

                  {types.map((type: any) => {
                    const typeCats = categoriesByType.get(type.id) ?? [];
                    if (typeCats.length === 0) return null;
                    const isExpanded = expandedTypes.has(type.id);
                    return (
                      <div key={type.id} className="mb-2">
                        <button
                          type="button"
                          onClick={() => toggleType(type.id)}
                          className="w-full text-left px-3 py-2 bg-gray-50 rounded-lg flex items-center gap-2 hover:bg-gray-100 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                          <Layers size={14} className="text-blue-600" />
                          <span className="text-sm font-semibold text-gray-800">
                            {type.name}
                          </span>
                          <span className="text-[10px] text-gray-400 ml-auto">
                            {typeCats.length} categories
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="ml-6 mt-1 space-y-1">
                            {typeCats.map((cat: any) => {
                              const catAssigned = isAssigned(cat.id);
                              const subs = cat.subCategory ?? [];
                              const catExpanded = expandedCategories.has(
                                cat.id,
                              );

                              return (
                                <div key={cat.id}>
                                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50">
                                    {subs.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => toggleCategory(cat.id)}
                                        className="p-0.5 hover:bg-gray-200 rounded"
                                      >
                                        {catExpanded ? (
                                          <ChevronDown size={12} />
                                        ) : (
                                          <ChevronRight size={12} />
                                        )}
                                      </button>
                                    )}
                                    <Tag size={12} className="text-gray-500" />
                                    <span className="text-sm text-gray-700 flex-1">
                                      {cat.name}
                                    </span>

                                    {catAssigned ? (
                                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">
                                        ASSIGNED
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleAssign(cat.id)}
                                        disabled={assignMutation.isPending}
                                        className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50"
                                      >
                                        + Assign All
                                      </button>
                                    )}
                                  </div>

                                  {catExpanded && subs.length > 0 && (
                                    <div className="ml-8 space-y-0.5">
                                      {subs.map((sub: any) => {
                                        const subAssigned = isAssigned(
                                          cat.id,
                                          sub.id,
                                        );
                                        return (
                                          <div
                                            key={sub.id}
                                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50"
                                          >
                                            <span className="w-3 h-px bg-gray-300" />
                                            <span className="text-xs text-gray-600 flex-1">
                                              {sub.name}
                                            </span>
                                            {subAssigned ? (
                                              <span className="text-[9px] px-1 py-0.5 bg-blue-100 text-blue-600 rounded">
                                                ASSIGNED
                                              </span>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleAssign(cat.id, sub.id)
                                                }
                                                disabled={
                                                  assignMutation.isPending
                                                }
                                                className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-100 disabled:opacity-50"
                                              >
                                                + Assign
                                              </button>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Untyped categories */}
                  {(categoriesByType.get(null) ?? []).length > 0 && (
                    <div className="mb-2">
                      <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-semibold text-gray-500">
                        Uncategorized
                      </div>
                      <div className="ml-6 mt-1 space-y-1">
                        {(categoriesByType.get(null) ?? []).map((cat: any) => {
                          const catAssigned = isAssigned(cat.id);
                          return (
                            <div
                              key={cat.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50"
                            >
                              <Tag size={12} className="text-gray-500" />
                              <span className="text-sm text-gray-700 flex-1">
                                {cat.name}
                              </span>
                              {catAssigned ? (
                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">
                                  ASSIGNED
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAssign(cat.id)}
                                  disabled={assignMutation.isPending}
                                  className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50"
                                >
                                  + Assign
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Assigned list */}
              {loadingAssignments ? (
                <div className="text-gray-400 text-sm py-4">Loading...</div>
              ) : assignments.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                  <Tag className="mx-auto text-gray-300 mb-3" size={36} />
                  <p className="text-gray-500 text-sm font-medium">
                    No categories assigned
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    This shop can currently order ALL categories. Click
                    &quot;Assign Category&quot; to restrict access.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {assignments.map((a: any) => (
                    <div
                      key={a.id}
                      className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            a.subcategory ? "bg-indigo-100" : "bg-blue-100"
                          }`}
                        >
                          <Tag
                            size={14}
                            className={
                              a.subcategory
                                ? "text-indigo-600"
                                : "text-blue-600"
                            }
                          />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {a.category?.name || `Category #${a.categoryId}`}
                          </div>
                          {a.subcategory && (
                            <div className="text-xs text-indigo-600">
                              ↳ {a.subcategory.name}
                            </div>
                          )}
                        </div>
                        {!a.subcategory && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">
                            ALL SUBS
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("Remove this assignment?"))
                            removeMutation.mutate(a.id);
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
