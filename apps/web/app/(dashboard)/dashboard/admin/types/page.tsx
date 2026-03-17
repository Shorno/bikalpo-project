"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  Package,
  Pencil,
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { orpc } from "@/utils/orpc";

type TypeForm = {
  name: string;
  slug: string;
  description: string;
  enableBrand: boolean;
  enableColor: boolean;
  enableSize: boolean;
  enableDesign: boolean;
  enableVariant: boolean;
  inventoryBehaviour: "auto_break" | "loose_convert" | "fixed_pack";
  displayOrder: number;
};

const emptyForm: TypeForm = {
  name: "",
  slug: "",
  description: "",
  enableBrand: true,
  enableColor: false,
  enableSize: true,
  enableDesign: false,
  enableVariant: true,
  inventoryBehaviour: "fixed_pack",
  displayOrder: 0,
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const behaviourLabels: Record<
  string,
  { label: string; emoji: string; desc: string }
> = {
  auto_break: {
    label: "Auto Break",
    emoji: "📦→📦📦",
    desc: "Carton breaks into packs",
  },
  loose_convert: {
    label: "Loose Convert",
    emoji: "🏷→⚖️",
    desc: "Sack converts to weight",
  },
  fixed_pack: {
    label: "Fixed Pack",
    emoji: "📦→📦",
    desc: "Same pack from warehouse to shop",
  },
};

export default function TypesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TypeForm>({ ...emptyForm });

  const { data, isLoading } = useQuery({
    queryKey: ["adminProductType", "getAll", search],
    queryFn: () =>
      orpc.adminProductType.getAll.call({ search: search || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (data: TypeForm) => orpc.adminProductType.create.call(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminProductType"] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: TypeForm & { id: number }) =>
      orpc.adminProductType.update.call(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminProductType"] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => orpc.adminProductType.delete.call({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminProductType"] });
    },
  });

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (t: any) => {
    setForm({
      name: t.name,
      slug: t.slug,
      description: t.description || "",
      enableBrand: t.enableBrand,
      enableColor: t.enableColor,
      enableSize: t.enableSize,
      enableDesign: t.enableDesign,
      enableVariant: t.enableVariant,
      inventoryBehaviour: t.inventoryBehaviour,
      displayOrder: t.displayOrder,
    });
    setEditingId(t.id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...form,
      slug: form.slug || slugify(form.name),
    };
    if (editingId) {
      updateMutation.mutate({ ...data, id: editingId });
    } else {
      createMutation.mutate(data);
    }
  };

  const types = data?.types ?? [];

  const Toggle = ({
    label,
    checked,
    onChange,
  }: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
        checked
          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
          : "bg-gray-50 border-gray-200 text-gray-400"
      }`}
    >
      {checked ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
      {label}
    </button>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Boxes className="text-emerald-600" size={24} />
            Product Types
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Define product types with attribute rules and inventory behaviour
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
        >
          <Plus size={16} />
          Add Type
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            {editingId ? "Edit Type" : "New Product Type"}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <span className="block text-xs font-medium text-gray-500 mb-1">
                Type Name *
              </span>
              <input
                required
                placeholder="e.g. Grocery"
                value={form.name}
                onChange={(e) => {
                  setForm({
                    ...form,
                    name: e.target.value,
                    slug: editingId ? form.slug : slugify(e.target.value),
                  });
                }}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <span className="block text-xs font-medium text-gray-500 mb-1">
                Slug
              </span>
              <input
                placeholder="auto-generated"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="md:col-span-2">
              <span className="block text-xs font-medium text-gray-500 mb-1">
                Description
              </span>
              <input
                placeholder="Brief description of this product type"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Attribute Toggles */}
          <div className="mb-4">
            <span className="block text-xs font-medium text-gray-500 mb-2">
              🔧 Attribute Toggles — which attributes apply to this type?
            </span>
            <div className="flex flex-wrap gap-2">
              <Toggle
                label="Brand"
                checked={form.enableBrand}
                onChange={(v) => setForm({ ...form, enableBrand: v })}
              />
              <Toggle
                label="Color"
                checked={form.enableColor}
                onChange={(v) => setForm({ ...form, enableColor: v })}
              />
              <Toggle
                label="Size"
                checked={form.enableSize}
                onChange={(v) => setForm({ ...form, enableSize: v })}
              />
              <Toggle
                label="Design"
                checked={form.enableDesign}
                onChange={(v) => setForm({ ...form, enableDesign: v })}
              />
              <Toggle
                label="Variant"
                checked={form.enableVariant}
                onChange={(v) => setForm({ ...form, enableVariant: v })}
              />
            </div>
          </div>

          {/* Inventory Behaviour */}
          <div className="mb-4">
            <span className="block text-xs font-medium text-gray-500 mb-2">
              📦 Inventory Behaviour — how stock flows from warehouse to shop
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(["auto_break", "loose_convert", "fixed_pack"] as const).map(
                (behaviour) => {
                  const b = behaviourLabels[behaviour]!;
                  return (
                    <button
                      key={behaviour}
                      type="button"
                      onClick={() =>
                        setForm({ ...form, inventoryBehaviour: behaviour })
                      }
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        form.inventoryBehaviour === behaviour
                          ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200"
                          : "bg-gray-50 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-800">
                        {b.emoji} {b.label}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {b.desc}
                      </div>
                    </button>
                  );
                },
              )}
            </div>
          </div>

          {/* Display Order */}
          <div className="mb-4 w-32">
            <span className="block text-xs font-medium text-gray-500 mb-1">
              Display Order
            </span>
            <input
              type="number"
              value={form.displayOrder}
              onChange={(e) =>
                setForm({
                  ...form,
                  displayOrder: parseInt(e.target.value, 10) || 0,
                })
              }
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-50"
            >
              {editingId ? "Update" : "Create"} Type
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          placeholder="Search types..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Types List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : types.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Boxes className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 font-medium">No product types yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Create your first type (e.g. Grocery, Fashion) to organize products
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {types.map((t: any) => {
            const b =
              behaviourLabels[t.inventoryBehaviour] ||
              behaviourLabels.fixed_pack!;
            return (
              <div
                key={t.id}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:border-emerald-200 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Package size={16} className="text-emerald-600" />
                      <h3 className="font-semibold text-gray-900">{t.name}</h3>
                      <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-mono">
                        {t.slug}
                      </span>
                      {!t.isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium">
                          INACTIVE
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-xs text-gray-500 mt-1">
                        {t.description}
                      </p>
                    )}

                    {/* Attribute badges */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {t.enableBrand && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                          Brand
                        </span>
                      )}
                      {t.enableColor && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded">
                          Color
                        </span>
                      )}
                      {t.enableSize && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded">
                          Size
                        </span>
                      )}
                      {t.enableDesign && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-pink-50 text-pink-600 rounded">
                          Design
                        </span>
                      )}
                      {t.enableVariant && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-teal-50 text-teal-600 rounded">
                          Variant
                        </span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded font-medium">
                        {b.emoji} {b.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ml-4">
                    <button
                      type="button"
                      onClick={() => handleEdit(t)}
                      className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Delete this type?"))
                          deleteMutation.mutate(t.id);
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
