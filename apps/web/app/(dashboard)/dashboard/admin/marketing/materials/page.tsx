"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Edit,
  Image as ImageIcon,
  Loader2,
  Package,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { client, orpc } from "@/utils/orpc";

const MATERIAL_TYPES = [
  { value: "banner", label: "Banner" },
  { value: "sticker", label: "Sticker" },
  { value: "leaflet", label: "Leaflet" },
  { value: "poster", label: "Poster" },
  { value: "standee", label: "Standee" },
  { value: "qr_sticker", label: "QR Sticker" },
];

const CATEGORIES = [
  { value: "shop_branding", label: "Shop Branding" },
  { value: "warehouse_branding", label: "Warehouse Branding" },
  { value: "product_promotion", label: "Product Promotion" },
  { value: "campaign", label: "Campaign" },
];

type FormData = {
  title: string;
  type: string;
  category: string;
  designFileUrl: string;
  sizeFormat: string;
  description: string;
  stockQuantity: number;
  status: string;
};

const emptyForm: FormData = {
  title: "",
  type: "banner",
  category: "shop_branding",
  designFileUrl: "",
  sizeFormat: "",
  description: "",
  stockQuantity: 0,
  status: "active",
};

export default function MaterialsManagementPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    ...orpc.adminMarketing.listMaterials.queryOptions({ input: undefined }),
  });

  const materials = data?.materials ?? [];

  // ── Mutations ──────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (input: any) => client.adminMarketing.createMaterial(input),
    onSuccess: () => {
      toast.success("Material created");
      queryClient.invalidateQueries();
      closeDialog();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (input: any) => client.adminMarketing.updateMaterial(input),
    onSuccess: () => {
      toast.success("Material updated");
      queryClient.invalidateQueries();
      closeDialog();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => client.adminMarketing.deleteMaterial({ id }),
    onSuccess: () => {
      toast.success("Material disabled");
      queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(e.message),
  });

  // ── File upload ────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUri = reader.result as string;
        const result = await client.cloudinary.upload({
          file: dataUri,
          folder: "marketing-materials",
        });
        if (result.success) {
          setForm((prev) => ({ ...prev, designFileUrl: result.url }));
          toast.success("Design uploaded");
        } else {
          toast.error(result.error || "Upload failed");
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Upload failed");
      setUploading(false);
    }
  };

  // ── Dialog ─────────────────────────────────────────────────────
  const openCreateDialog = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setIsDialogOpen(true);
  };

  const openEditDialog = (material: any) => {
    setEditingId(material.id);
    setForm({
      title: material.title,
      type: material.type,
      category: material.category || "shop_branding",
      designFileUrl: material.designFileUrl || "",
      sizeFormat: material.sizeFormat || "",
      description: material.description || "",
      stockQuantity: material.stockQuantity,
      status: material.status,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSubmit = () => {
    if (!form.title) {
      toast.error("Title is required");
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        ...form,
        designFileUrl: form.designFileUrl || undefined,
        sizeFormat: form.sizeFormat || undefined,
        description: form.description || undefined,
      });
    } else {
      createMutation.mutate({
        ...form,
        type: form.type as any,
        category: form.category as any,
        status: form.status as any,
        designFileUrl: form.designFileUrl || undefined,
        sizeFormat: form.sizeFormat || undefined,
        description: form.description || undefined,
      });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/dashboard/admin/marketing">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Materials & Designs
            </h1>
            <p className="text-muted-foreground">
              Create and manage marketing material designs
            </p>
          </div>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 size-4" />
          Create Material
        </Button>
      </div>

      {/* Materials Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : materials.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-muted/30">
          <Package className="size-12 text-muted-foreground mb-3" />
          <p className="text-lg font-medium">No materials created yet</p>
          <p className="text-muted-foreground mb-4">
            Create your first marketing material design
          </p>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 size-4" />
            Create Material
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Preview</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((mat: any) => (
                <TableRow key={mat.id}>
                  <TableCell>
                    {mat.designFileUrl ? (
                      <div className="relative size-10 rounded overflow-hidden border bg-muted">
                        <Image
                          src={mat.designFileUrl}
                          alt={mat.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="size-10 rounded border bg-muted flex items-center justify-center">
                        <ImageIcon className="size-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{mat.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize text-xs">
                      {mat.type.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm capitalize">
                    {(mat.category || "").replace("_", " ")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {mat.sizeFormat || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={mat.stockQuantity > 0 ? "secondary" : "destructive"}
                      className="text-xs"
                    >
                      {mat.stockQuantity} pcs
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={mat.status === "active" ? "default" : "outline"}
                      className={`text-xs ${
                        mat.status === "active"
                          ? "bg-emerald-500"
                          : "text-muted-foreground"
                      }`}
                    >
                      {mat.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(mat)}
                      >
                        <Edit className="size-3.5" />
                      </Button>
                      {mat.status === "active" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => deleteMutation.mutate(mat.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={() => closeDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Material" : "Create Marketing Material"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Type */}
            <div className="space-y-1.5">
              <Label>Material Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                placeholder="e.g. Shop Banner Large"
                value={form.title}
                onChange={(e) =>
                  setForm((p) => ({ ...p, title: e.target.value }))
                }
              />
            </div>

            {/* Design File */}
            <div className="space-y-1.5">
              <Label>Design File</Label>
              {form.designFileUrl ? (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border bg-muted">
                  <Image
                    src={form.designFileUrl}
                    alt="Preview"
                    fill
                    className="object-contain"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute top-2 right-2"
                    onClick={() =>
                      setForm((p) => ({ ...p, designFileUrl: "" }))
                    }
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  {uploading ? (
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="size-6 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">
                        Click to upload design
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>

            {/* Size / Format */}
            <div className="space-y-1.5">
              <Label>Size / Format</Label>
              <Input
                placeholder="e.g. 10x3 ft, A4, Round Sticker"
                value={form.sizeFormat}
                onChange={(e) =>
                  setForm((p) => ({ ...p, sizeFormat: e.target.value }))
                }
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Campaign / usage details..."
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                rows={2}
              />
            </div>

            {/* Stock Quantity */}
            <div className="space-y-1.5">
              <Label>Stock Quantity</Label>
              <Input
                type="number"
                min={0}
                value={form.stockQuantity}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    stockQuantity: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editingId ? "Update" : "Create"} Material
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
