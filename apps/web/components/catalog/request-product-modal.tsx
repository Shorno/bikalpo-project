"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusCircle, Loader2 } from "lucide-react";
import { useFilterOptions, useSubmitProductRequest } from "@/hooks/use-catalog-api";

export function RequestProductModal() {
  const [open, setOpen] = useState(false);
  const [typeName, setTypeName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [subCategoryName, setSubCategoryName] = useState("");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");

  const { data: filterData } = useFilterOptions();
  const submitMutation = useSubmitProductRequest();

  const types = filterData?.types ?? [];
  const categories = filterData?.categories ?? [];

  // Filter categories by selected type
  const selectedType = types.find((t) => t.name === typeName);
  const filteredCategories = selectedType
    ? categories.filter((c) => c.typeId === selectedType.id)
    : categories;

  const handleSubmit = async () => {
    if (!productName.trim()) return;

    submitMutation.mutate(
      {
        typeName: typeName || undefined,
        categoryName: categoryName || undefined,
        subCategoryName: subCategoryName || undefined,
        productName: productName.trim(),
        description: description.trim() || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          resetForm();
        },
      },
    );
  };

  const resetForm = () => {
    setTypeName("");
    setCategoryName("");
    setSubCategoryName("");
    setProductName("");
    setDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800">
          <PlusCircle className="h-4 w-4" />
          Request New Product
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-lg">Request New Product Identity</DialogTitle>
          <DialogDescription>
            Can&apos;t find your product? Submit a request and admin will review it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="req-type">Type</Label>
            <Select value={typeName} onValueChange={(v) => { setTypeName(v); setCategoryName(""); }}>
              <SelectTrigger id="req-type">
                <SelectValue placeholder="Select type (optional)" />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="req-category">Category</Label>
            <Select value={categoryName} onValueChange={setCategoryName}>
              <SelectTrigger id="req-category">
                <SelectValue placeholder="Select category (optional)" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sub Category (free text) */}
          <div className="space-y-2">
            <Label htmlFor="req-subcat">Sub Category</Label>
            <Input
              id="req-subcat"
              placeholder="e.g. Miniket, Basmati, Round Neck..."
              value={subCategoryName}
              onChange={(e) => setSubCategoryName(e.target.value)}
            />
          </div>

          {/* Product Name */}
          <div className="space-y-2">
            <Label htmlFor="req-name">
              Product Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="req-name"
              placeholder="e.g. Miniket Rice, Polo T-Shirt..."
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="req-desc">Description (optional)</Label>
            <Textarea
              id="req-desc"
              placeholder="Any additional details about the product..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!productName.trim() || submitMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {submitMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
