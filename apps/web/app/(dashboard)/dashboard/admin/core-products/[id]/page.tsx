"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BoxesIcon,
  Check,
  Package,
  Pencil,
  Plus,
  Tag,
  Trash2,
  Weight,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ADMIN_BASE } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

const PACK_TYPES = [
  "sack",
  "carton",
  "packet",
  "loose",
  "bottle",
  "can",
  "jar",
  "pouch",
  "box",
];

interface PackVariantRow {
  label: string;
  weightKg: string;
  packType: string;
  sellUnit: string;
  sortOrder: number;
  isActive: boolean;
}

const emptyVariant: PackVariantRow = {
  label: "",
  weightKg: "",
  packType: "packet",
  sellUnit: "Pack",
  sortOrder: 0,
  isActive: true,
};

export default function CoreProductDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(
    orpc.adminCoreProduct.getById.queryOptions({
      input: { id },
    }),
  );

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-40 bg-muted rounded-lg" />
          <div className="h-40 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  const cp = data?.coreProduct;
  if (!cp) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-20">
          <h2 className="text-xl font-semibold mb-2">
            Core Product Not Found
          </h2>
          <Button asChild variant="outline">
            <Link href={`${ADMIN_BASE}/core-products`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to list
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href={`${ADMIN_BASE}/core-products`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{cp.name}</h1>
          <p className="text-muted-foreground text-sm">
            SKU: <span className="font-mono">{cp.sku}</span> · Slug:{" "}
            <span className="font-mono">{cp.slug}</span>
          </p>
        </div>
        <Badge
          variant={cp.status === "active" ? "default" : "secondary"}
          className={cn(
            "text-sm",
            cp.status === "active" && "bg-green-600",
            cp.status === "draft" && "bg-yellow-600",
          )}
        >
          {cp.status.charAt(0).toUpperCase() + cp.status.slice(1)}
        </Badge>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Product Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image + Basic Info */}
          <div className="border rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-6">
              <div className="w-32 h-32 relative rounded-lg overflow-hidden border shadow-sm shrink-0">
                <Image
                  src={cp.image}
                  alt={cp.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Category</span>
                    <p className="font-medium">{cp.category.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sub Category</span>
                    <p className="font-medium">
                      {cp.subCategory?.name ?? "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Brand Support</span>
                    <p className="font-medium">
                      {cp.brandSupport === "multi_brand"
                        ? "Multi Brand"
                        : "Single Brand"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status</span>
                    <p className="font-medium capitalize">{cp.status}</p>
                  </div>
                </div>
                {cp.description && (
                  <p className="text-sm text-muted-foreground">
                    {cp.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Pack Variant Templates — Interactive */}
          <PackVariantSection coreProduct={cp} />
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Linked Brands */}
          <div className="border rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Linked Brands</h3>
            </div>
            {cp.brands.length > 0 ? (
              <div className="space-y-2">
                {cp.brands.map((b: any) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 p-2 rounded-lg border"
                  >
                    {b.brand.logo && (
                      <div className="w-8 h-8 relative rounded overflow-hidden shrink-0">
                        <Image
                          src={b.brand.logo}
                          alt={b.brand.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <span className="text-sm font-medium flex-1">
                      {b.brand.name}
                    </span>
                    {b.isDefault && (
                      <Badge variant="secondary" className="text-[10px]">
                        Default
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No brands linked.
              </p>
            )}
          </div>

          {/* Usage Insights */}
          <div className="border rounded-lg p-6 space-y-4">
            <h3 className="font-semibold">Usage Insights</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Used By Brands</span>
                <span className="font-medium">{cp.brands.length}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pack Templates</span>
                <span className="font-medium">{cp.packVariants.length}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Top Variant</span>
                <span className="font-medium">
                  {cp.packVariants.length > 0
                    ? cp.packVariants[0].label
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Pack Variant Section — inline add / edit / delete
// ============================================================

function PackVariantSection({ coreProduct }: { coreProduct: any }) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = React.useState(false);
  const [newVariant, setNewVariant] = React.useState<PackVariantRow>({
    ...emptyVariant,
  });
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editData, setEditData] = React.useState<PackVariantRow>({
    ...emptyVariant,
  });

  // Save mutation — replaces ALL pack variants (same pattern as create/update)
  const saveMutation = useMutation(
    orpc.adminCoreProduct.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.adminCoreProduct.getById.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.adminCoreProduct.getAll.key(),
        });
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to save variant");
      },
    }),
  );

  const buildUpdatePayload = (packVariants: PackVariantRow[]) => ({
    id: coreProduct.id,
    sku: coreProduct.sku,
    name: coreProduct.name,
    slug: coreProduct.slug,
    description: coreProduct.description || undefined,
    image: coreProduct.image,
    categoryId: coreProduct.categoryId,
    subCategoryId: coreProduct.subCategoryId,
    brandSupport: coreProduct.brandSupport,
    variantSupportPack: coreProduct.variantSupportPack,
    variantSupportLoose: coreProduct.variantSupportLoose,
    defaultLooseUnit: coreProduct.defaultLooseUnit || undefined,
    status: coreProduct.status,
    displayOrder: coreProduct.displayOrder,
    brandIds: coreProduct.brands.map((b: any) => b.brandId),
    defaultBrandId: coreProduct.brands.find((b: any) => b.isDefault)?.brandId,
    packVariants: packVariants.map((pv, idx) => ({ ...pv, sortOrder: idx })),
  });

  // ADD variant
  const handleAdd = () => {
    if (!newVariant.label.trim() || !newVariant.weightKg.trim()) {
      toast.error("Label and weight are required");
      return;
    }
    const existing = coreProduct.packVariants.map((pv: any) => ({
      label: pv.label,
      weightKg: pv.weightKg,
      packType: pv.packType,
      sellUnit: pv.sellUnit || "",
      sortOrder: pv.sortOrder,
      isActive: pv.isActive,
    }));
    saveMutation.mutate(buildUpdatePayload([...existing, newVariant]), {
      onSuccess: () => {
        toast.success("Variant added");
        setNewVariant({ ...emptyVariant });
        setIsAdding(false);
      },
    });
  };

  // EDIT variant (start)
  const startEdit = (pv: any) => {
    setEditingId(pv.id);
    setEditData({
      label: pv.label,
      weightKg: pv.weightKg,
      packType: pv.packType,
      sellUnit: pv.sellUnit || "",
      sortOrder: pv.sortOrder,
      isActive: pv.isActive,
    });
  };

  // EDIT variant (save)
  const handleEditSave = () => {
    if (!editData.label.trim() || !editData.weightKg.trim()) {
      toast.error("Label and weight are required");
      return;
    }
    const updated = coreProduct.packVariants.map((pv: any) =>
      pv.id === editingId
        ? editData
        : {
            label: pv.label,
            weightKg: pv.weightKg,
            packType: pv.packType,
            sellUnit: pv.sellUnit || "",
            sortOrder: pv.sortOrder,
            isActive: pv.isActive,
          },
    );
    saveMutation.mutate(buildUpdatePayload(updated), {
      onSuccess: () => {
        toast.success("Variant updated");
        setEditingId(null);
      },
    });
  };

  // DELETE variant
  const handleDelete = (pvId: number) => {
    const remaining = coreProduct.packVariants
      .filter((pv: any) => pv.id !== pvId)
      .map((pv: any) => ({
        label: pv.label,
        weightKg: pv.weightKg,
        packType: pv.packType,
        sellUnit: pv.sellUnit || "",
        sortOrder: pv.sortOrder,
        isActive: pv.isActive,
      }));
    saveMutation.mutate(buildUpdatePayload(remaining), {
      onSuccess: () => {
        toast.success("Variant deleted");
      },
    });
  };

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Variant Structure</h3>
        </div>
        {!isAdding && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Variant
          </Button>
        )}
      </div>

      {/* Variant support info */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <BoxesIcon className="h-4 w-4 text-muted-foreground" />
          <span>
            Pack Based:{" "}
            <strong>
              {coreProduct.variantSupportPack ? "Enabled" : "Disabled"}
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Weight className="h-4 w-4 text-muted-foreground" />
          <span>
            Loose:{" "}
            <strong>
              {coreProduct.variantSupportLoose
                ? `Enabled (${coreProduct.defaultLooseUnit || "KG"})`
                : "Disabled"}
            </strong>
          </span>
        </div>
      </div>

      <Separator />

      {/* Variants table */}
      {coreProduct.packVariants.length > 0 || isAdding ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead className="w-[90px]">Weight</TableHead>
              <TableHead>Pack Type</TableHead>
              <TableHead className="w-[90px]">Sell Unit</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead className="w-[100px] text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coreProduct.packVariants.map((pv: any) =>
              editingId === pv.id ? (
                <TableRow key={pv.id} className="bg-muted/30">
                  <TableCell>
                    <Input
                      value={editData.label}
                      onChange={(e) =>
                        setEditData({ ...editData, label: e.target.value })
                      }
                      className="h-8"
                      placeholder="Label"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={editData.weightKg}
                      onChange={(e) =>
                        setEditData({ ...editData, weightKg: e.target.value })
                      }
                      className="h-8"
                      type="number"
                      step="0.01"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={editData.packType}
                      onValueChange={(v) =>
                        setEditData({ ...editData, packType: v })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PACK_TYPES.map((pt) => (
                          <SelectItem key={pt} value={pt}>
                            {pt.charAt(0).toUpperCase() + pt.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={editData.sellUnit}
                      onChange={(e) =>
                        setEditData({ ...editData, sellUnit: e.target.value })
                      }
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={editData.isActive ? "default" : "secondary"}
                      className={cn(
                        "text-xs cursor-pointer",
                        editData.isActive && "bg-green-600",
                      )}
                      onClick={() =>
                        setEditData({
                          ...editData,
                          isActive: !editData.isActive,
                        })
                      }
                    >
                      {editData.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-green-600 hover:text-green-700"
                        onClick={handleEditSave}
                        disabled={saveMutation.isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={pv.id}>
                  <TableCell className="font-medium">{pv.label}</TableCell>
                  <TableCell>{pv.weightKg} kg</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {pv.packType}
                    </Badge>
                  </TableCell>
                  <TableCell>{pv.sellUnit || "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={pv.isActive ? "default" : "secondary"}
                      className={cn(
                        "text-xs",
                        pv.isActive && "bg-green-600",
                      )}
                    >
                      {pv.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => startEdit(pv)}
                        disabled={saveMutation.isPending}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(pv.id)}
                        disabled={saveMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ),
            )}

            {/* Add new row */}
            {isAdding && (
              <TableRow className="bg-muted/30">
                <TableCell>
                  <Input
                    value={newVariant.label}
                    onChange={(e) =>
                      setNewVariant({ ...newVariant, label: e.target.value })
                    }
                    className="h-8"
                    placeholder="e.g. 5KG Pack"
                    autoFocus
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={newVariant.weightKg}
                    onChange={(e) =>
                      setNewVariant({ ...newVariant, weightKg: e.target.value })
                    }
                    className="h-8"
                    placeholder="5"
                    type="number"
                    step="0.01"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={newVariant.packType}
                    onValueChange={(v) =>
                      setNewVariant({ ...newVariant, packType: v })
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PACK_TYPES.map((pt) => (
                        <SelectItem key={pt} value={pt}>
                          {pt.charAt(0).toUpperCase() + pt.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    value={newVariant.sellUnit}
                    onChange={(e) =>
                      setNewVariant({ ...newVariant, sellUnit: e.target.value })
                    }
                    className="h-8"
                    placeholder="Pack"
                  />
                </TableCell>
                <TableCell>
                  <Badge
                    variant="default"
                    className="text-xs bg-green-600 cursor-pointer"
                    onClick={() =>
                      setNewVariant({
                        ...newVariant,
                        isActive: !newVariant.isActive,
                      })
                    }
                  >
                    {newVariant.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-green-600 hover:text-green-700"
                      onClick={handleAdd}
                      disabled={saveMutation.isPending}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setIsAdding(false);
                        setNewVariant({ ...emptyVariant });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-3">
            No pack variants defined yet.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add First Variant
          </Button>
        </div>
      )}
    </div>
  );
}
