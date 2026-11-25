"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SearchCreateCombobox,
  type SearchCreateOption,
} from "./search-create-combobox";

export type StoreIdentityOptions = {
  types: Array<{ id: number; name: string }>;
  categories: Array<{ id: number; name: string; typeId: number | null }>;
  subCategories: Array<{ id: number; name: string; categoryId: number }>;
  coreProducts: Array<{
    id: number;
    name: string;
    categoryId: number;
    subCategoryId: number | null;
  }>;
};

export type StoreIdentitySelection = {
  typeId?: number | null;
  categoryId?: number | null;
  subCategoryId?: number | null;
  coreProductId?: number | null;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * The seller's Type / Category / Sub category / Core identity pickers, laid
 * out like admin Create Product. Sub category and Core identity are
 * search-or-add: a name that is not listed is added on the spot. Picking or
 * adding a core identity hands its id to `onCoreProductChosen`, which opens
 * that core product's Add page.
 */
export function StoreIdentityPicker({
  options,
  initial,
  onCoreProductChosen,
  createSubCategory,
  createCoreProduct,
}: {
  options?: StoreIdentityOptions;
  initial?: StoreIdentitySelection;
  onCoreProductChosen: (coreProductId: number) => void;
  createSubCategory: (input: {
    categoryId: number;
    name: string;
  }) => Promise<{ id: number; name: string; categoryId: number }>;
  createCoreProduct: (input: {
    categoryId: number;
    subCategoryId: number | null;
    name: string;
  }) => Promise<{ id: number; name: string }>;
}) {
  const [typeId, setTypeId] = useState<number | null>(initial?.typeId ?? null);
  const [categoryId, setCategoryId] = useState<number | null>(
    initial?.categoryId ?? null,
  );
  const [subCategoryId, setSubCategoryId] = useState<number | null>(
    initial?.subCategoryId ?? null,
  );
  const [coreProductId, setCoreProductId] = useState<number | null>(
    initial?.coreProductId ?? null,
  );
  const [addedSubCategories, setAddedSubCategories] = useState<
    StoreIdentityOptions["subCategories"]
  >([]);
  const [addedCore, setAddedCore] = useState<SearchCreateOption | null>(null);
  const [creatingSubCategory, setCreatingSubCategory] = useState(false);
  const [creatingCore, setCreatingCore] = useState(false);

  const types = options?.types ?? [];
  const categories = (options?.categories ?? []).filter(
    (category) => !typeId || category.typeId === typeId,
  );
  const subCategories = [
    ...(options?.subCategories ?? []),
    ...addedSubCategories.filter(
      (added) => !options?.subCategories.some((sub) => sub.id === added.id),
    ),
  ].filter((sub) => sub.categoryId === categoryId);
  const coreProducts = (options?.coreProducts ?? []).filter(
    (core) =>
      core.categoryId === categoryId &&
      (!subCategoryId || core.subCategoryId === subCategoryId),
  );
  const selectedCore =
    coreProducts.find((core) => core.id === coreProductId) ??
    (addedCore?.id === coreProductId ? addedCore : undefined);

  const chooseCore = (id: number) => {
    setCoreProductId(id);
    onCoreProductChosen(id);
  };

  const chooseSubCategory = (id: number | null) => {
    setSubCategoryId(id);
    setCoreProductId(null);
  };

  const addSubCategory = async (rawName: string) => {
    const name = rawName.trim();
    if (!categoryId || name.length < 2 || creatingSubCategory) return false;
    setCreatingSubCategory(true);
    try {
      const created = await createSubCategory({ categoryId, name });
      setAddedSubCategories((current) => [...current, created]);
      chooseSubCategory(created.id);
      toast.success(`${created.name} added`);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "The sub category could not be added"));
      return false;
    } finally {
      setCreatingSubCategory(false);
    }
  };

  const addCoreProduct = async (rawName: string) => {
    const name = rawName.trim();
    if (!categoryId || name.length < 2 || creatingCore) return false;
    setCreatingCore(true);
    try {
      const created = await createCoreProduct({
        categoryId,
        subCategoryId,
        name,
      });
      setAddedCore({ id: created.id, name: created.name });
      toast.success(`${created.name} added. Only your store sees it.`);
      chooseCore(created.id);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "The core identity could not be added"));
      return false;
    } finally {
      setCreatingCore(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field>
        <FieldLabel>Type</FieldLabel>
        <Select
          value={typeId ? String(typeId) : "all"}
          onValueChange={(value) => {
            setTypeId(value === "all" ? null : Number(value));
            setCategoryId(null);
            setSubCategoryId(null);
            setCoreProductId(null);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {types.map((type) => (
              <SelectItem key={type.id} value={String(type.id)}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel>Category *</FieldLabel>
        <Select
          value={categoryId ? String(categoryId) : "0"}
          onValueChange={(value) => {
            setCategoryId(Number(value) || null);
            setSubCategoryId(null);
            setCoreProductId(null);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0" disabled>
              Select category
            </SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel>Sub category</FieldLabel>
        <SearchCreateCombobox
          key={`sub-${categoryId ?? "none"}`}
          noun="sub category"
          options={subCategories}
          selected={subCategories.find((sub) => sub.id === subCategoryId)}
          disabled={!categoryId}
          disabledLabel="Select a category first"
          creating={creatingSubCategory}
          clearLabel="No sub category"
          onSelect={chooseSubCategory}
          onClear={() => chooseSubCategory(null)}
          onCreate={addSubCategory}
        />
      </Field>

      <Field>
        <FieldLabel>Core identity *</FieldLabel>
        <SearchCreateCombobox
          key={`core-${categoryId ?? "none"}-${subCategoryId ?? "all"}`}
          noun="core identity"
          options={coreProducts}
          selected={selectedCore}
          disabled={!categoryId}
          disabledLabel="Select a category first"
          creating={creatingCore}
          onSelect={chooseCore}
          onCreate={addCoreProduct}
        />
      </Field>
    </div>
  );
}
