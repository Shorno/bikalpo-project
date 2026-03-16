"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  Layers,
  Plus,
  Tag,
  Trash2,
  Warehouse,
} from "lucide-react";
import { useState } from "react";
import { orpc } from "@/utils/orpc";

export default function WarehouseAssignmentsPage() {
  const queryClient = useQueryClient();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(
    null,
  );
  const [showPicker, setShowPicker] = useState(false);
  const [expandedTypes, setExpandedTypes] = useState<Set<number>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(
    new Set(),
  );

  // Fetch warehouses
  const { data: warehouseData, isLoading: loadingWarehouses } = useQuery({
    queryKey: ["adminWarehouseAssignment", "getWarehouses"],
    queryFn: () => orpc.adminWarehouseAssignment.getWarehouses.call({}),
  });

  // Fetch assignments for selected warehouse
  const { data: assignmentData, isLoading: loadingAssignments } = useQuery({
    queryKey: [
      "adminWarehouseAssignment",
      "getAssignments",
      selectedWarehouseId,
    ],
    queryFn: () =>
      orpc.adminWarehouseAssignment.getAssignments.call({
        warehouseId: selectedWarehouseId!,
      }),
    enabled: !!selectedWarehouseId,
  });

  // Fetch all categories with types and subcategories for the picker
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
      warehouseId: string;
      categoryId: number;
      subcategoryId?: number;
    }) => orpc.adminWarehouseAssignment.assign.call(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["adminWarehouseAssignment", "getAssignments"],
      });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (id: number) =>
      orpc.adminWarehouseAssignment.unassign.call({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["adminWarehouseAssignment", "getAssignments"],
      });
    },
  });

  const warehouses = warehouseData?.warehouses ?? [];
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

  // Check if category or subcategory is already assigned
  const isAssigned = (categoryId: number, subcategoryId?: number) => {
    return assignments.some(
      (a: any) =>
        a.categoryId === categoryId &&
        (subcategoryId ? a.subcategoryId === subcategoryId : !a.subcategoryId),
    );
  };

  const handleAssign = (categoryId: number, subcategoryId?: number) => {
    if (!selectedWarehouseId) return;
    assignMutation.mutate({
      warehouseId: selectedWarehouseId,
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FolderTree className="text-emerald-600" size={24} />
          Warehouse Category Assignments
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Assign product categories to warehouses — they can only add products
          from assigned categories
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Warehouse list (left) */}
        <div className="col-span-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase mb-2">
            Warehouses
          </h2>
          {loadingWarehouses ? (
            <div className="text-gray-400 text-sm py-4">Loading...</div>
          ) : warehouses.length === 0 ? (
            <div className="text-gray-400 text-sm py-4">
              No warehouses registered yet
            </div>
          ) : (
            <div className="space-y-1">
              {warehouses.map((w: any) => (
                <button
                  type="button"
                  key={w.id}
                  onClick={() => {
                    setSelectedWarehouseId(w.id);
                    setShowPicker(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors ${
                    selectedWarehouseId === w.id
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                      : "bg-white border border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Warehouse size={14} />
                    <div>
                      <div className="text-sm font-medium">{w.name}</div>
                      <div className="text-[10px] text-gray-400">{w.email}</div>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-gray-400" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Assignments (right) */}
        <div className="col-span-8">
          {!selectedWarehouseId ? (
            <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
              <Warehouse className="mx-auto text-gray-300 mb-3" size={48} />
              <p className="text-gray-500 font-medium">Select a warehouse</p>
              <p className="text-sm text-gray-400 mt-1">
                Choose a warehouse from the left to manage its category
                assignments
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">
                  Assigned Categories ({assignments.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setShowPicker(!showPicker)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50"
                >
                  <Plus size={14} />
                  Assign Category
                </button>
              </div>

              {/* Category Picker — grouped by Type */}
              {showPicker && (
                <div className="mb-4 bg-white border border-emerald-200 rounded-xl p-4 shadow-sm max-h-96 overflow-y-auto">
                  <h3 className="text-xs font-semibold text-gray-500 mb-3">
                    Browse by Type → Category → Subcategory:
                  </h3>

                  {/* Types */}
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
                          <Layers size={14} className="text-emerald-600" />
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
                                      <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded">
                                        ASSIGNED
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleAssign(cat.id)}
                                        disabled={assignMutation.isPending}
                                        className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded hover:bg-emerald-100 disabled:opacity-50"
                                      >
                                        + Assign All
                                      </button>
                                    )}
                                  </div>

                                  {/* Subcategories */}
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
                                              <span className="text-[9px] px-1 py-0.5 bg-emerald-100 text-emerald-600 rounded">
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
                                                className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50"
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
                        Uncategorized (no type assigned)
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
                                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded">
                                  ASSIGNED
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAssign(cat.id)}
                                  disabled={assignMutation.isPending}
                                  className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded hover:bg-emerald-100 disabled:opacity-50"
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
                    Click "Assign Category" to add categories this warehouse can
                    use
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
                            a.subcategory ? "bg-blue-100" : "bg-emerald-100"
                          }`}
                        >
                          <Tag
                            size={14}
                            className={
                              a.subcategory
                                ? "text-blue-600"
                                : "text-emerald-600"
                            }
                          />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {a.category?.name || `Category #${a.categoryId}`}
                          </div>
                          {a.subcategory && (
                            <div className="text-xs text-blue-600">
                              ↳ {a.subcategory.name}
                            </div>
                          )}
                        </div>
                        {!a.subcategory && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-medium">
                            ALL SUBS
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("Remove this assignment?"))
                            unassignMutation.mutate(a.id);
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
