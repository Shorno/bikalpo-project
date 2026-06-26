"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  BoxSelect,
  CalendarIcon,
  Check,
  ChevronRight,
  Loader,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Wallet,
  Weight,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

// ============================================================
// Types
// ============================================================

type ProductResult = {
  id: number;
  name: string;
  image: string;
  trackingType: string;
  expiryEnabled: boolean;
  categoryId: number;
  subCategoryId: number | null;
  category?: {
    id: number;
    name: string;
    typeId?: number | null;
    type?: { id: number; name: string } | null;
  } | null;
  subCategory?: { id: number; name: string } | null;
  brand?: { id: number; name: string } | null;
  coreProduct?: {
    id: number;
    name: string;
    supportsPack: boolean;
    supportsLoose: boolean;
  } | null;
  variants: {
    id: number;
    sku: string | null;
    unitLabel: string;
    weightKg: string;
    piecesPerUnit?: number | null;
    orderUnit?: string | null;
    price: string;
    brandId: number | null;
    color?: string | null;
    size?: string | null;
    packType: string | null;
    brand?: { id: number; name: string } | null;
  }[];
};

const WEIGHT_UNITS = new Set(["KG", "KGS", "KILOGRAM", "KILOGRAMS"]);
const PIECE_UNITS = new Set(["PC", "PCS", "PIECE", "PIECES"]);

function normalizeUnit(unit?: string | null) {
  return String(unit || "")
    .trim()
    .toUpperCase();
}

function formatUnit(unit?: string | null) {
  const normalized = normalizeUnit(unit);
  if (PIECE_UNITS.has(normalized)) return "PCS";
  return normalized || "UNIT";
}

function isFashionTypeName(typeName?: string | null) {
  return (
    String(typeName || "")
      .trim()
      .toLowerCase() === "fashion"
  );
}

function parseUnitLabelMeasure(label?: string | null) {
  const normalizedLabel = String(label || "").trim();
  if (!normalizedLabel) return null;

  const pieceMatch = normalizedLabel.match(
    /(\d+(?:\.\d+)?)\s*(pc|pcs|piece|pieces|pair|unit)\b/i,
  );
  if (pieceMatch) {
    const value = Number(pieceMatch[1]);
    if (value > 0) {
      return {
        quantityPerPack: value,
        quantityUnit: normalizeUnit(pieceMatch[2]) === "PAIR" ? "PAIR" : "PCS",
      };
    }
  }

  const weightMatch = normalizedLabel.match(
    /(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms)\b/i,
  );
  if (weightMatch) {
    const value = Number(weightMatch[1]);
    if (value > 0) {
      return {
        quantityPerPack: value,
        quantityUnit: "KG",
      };
    }
  }

  return null;
}

function getVariantMeasure(variant?: ProductResult["variants"][number] | null) {
  const normalizedUnit = normalizeUnit(variant?.orderUnit);
  const weightKg = parseFloat(variant?.weightKg || "0");
  const piecesPerUnit = Number(variant?.piecesPerUnit || 0);
  const parsedLabelMeasure = parseUnitLabelMeasure(variant?.unitLabel);

  if (WEIGHT_UNITS.has(normalizedUnit) && weightKg > 0) {
    return {
      quantityPerPack: weightKg,
      quantityUnit: "KG",
      displayLabel: `${variant?.unitLabel || "Unit"} (${weightKg} KG)`,
    };
  }

  if (piecesPerUnit > 0) {
    const unitLabel = formatUnit(variant?.orderUnit);
    return {
      quantityPerPack: piecesPerUnit,
      quantityUnit: unitLabel,
      displayLabel:
        piecesPerUnit === 1
          ? variant?.unitLabel || "Unit"
          : `${variant?.unitLabel || "Unit"} (${piecesPerUnit} ${unitLabel})`,
    };
  }

  if (parsedLabelMeasure) {
    return {
      quantityPerPack: parsedLabelMeasure.quantityPerPack,
      quantityUnit: parsedLabelMeasure.quantityUnit,
      displayLabel: variant?.unitLabel || "Unit",
    };
  }

  return {
    quantityPerPack: 0,
    quantityUnit: formatUnit(variant?.orderUnit),
    displayLabel: variant?.unitLabel || "Unit",
  };
}

/** One row in the new table-first stock entry */
type TableRow = {
  id: number;
  product: ProductResult;
  brandId: number | null;
  brandName: string;
  attributeKind: "brand" | "color";
  variantId: number | null;
  looseWeight: string;
  cartonUnitSize: string;
  quantity: string;
  pricePerPack: string;
  totalPrice: string;
};

// ============================================================
// Main Component
// ============================================================

export default function AddStockPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Entry mode
  const [entryType, setEntryType] = useState<"loose" | "pack" | "carton">(
    "pack",
  );
  // === Table rows (new table-first approach) ===
  const rowIdRef = useRef(0);
  const [tableRows, setTableRows] = useState<TableRow[]>([]);

  // === Product selection modal state ===
  const [showProductModal, setShowProductModal] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [modalTypeId, setModalTypeId] = useState<number | undefined>();
  const [modalCategoryId, setModalCategoryId] = useState<number | undefined>();
  const [modalSubCategoryId, setModalSubCategoryId] = useState<
    number | undefined
  >();
  const [modalSelectedProduct, setModalSelectedProduct] =
    useState<ProductResult | null>(null);
  const [modalSelectedBrandId, setModalSelectedBrandId] = useState<
    number | null
  >(null);
  const [modalSelectedColor, setModalSelectedColor] = useState<string | null>(
    null,
  );

  // Payment & Supplier
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [paymentAccount, setPaymentAccount] = useState<"cash" | "bank">("cash");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [reference, setReference] = useState("");
  const [storageAreaId, setStorageAreaId] = useState<number | null>(null);
  const [shelfRack, setShelfRack] = useState("");
  const [showCreateAreaDialog, setShowCreateAreaDialog] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaDescription, setNewAreaDescription] = useState("");

  // Batch/Expiry
  const [batchNo] = useState("");
  const [expiryDate] = useState("");
  const [manufactureDate] = useState("");
  const [note] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // === Queries ===

  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: [
      "warehouse",
      "getWarehouseProductsForStock",
      {
        search: modalSearch,
        categoryId: modalCategoryId,
        subCategoryId: modalSubCategoryId,
      },
    ],
    queryFn: () =>
      (orpc.warehouse as any).getWarehouseProductsForStock.call({
        search: modalSearch || undefined,
        categoryId: modalCategoryId,
        subCategoryId: modalSubCategoryId,
        limit: 50,
      }),
    enabled: showProductModal,
  });

  const products: ProductResult[] = productsData?.products ?? [];

  // Derive filter options from all products (unfiltered fetch for options)
  const { data: allProductsData } = useQuery({
    queryKey: [
      "warehouse",
      "getWarehouseProductsForStock",
      { forFilters: true },
    ],
    queryFn: () =>
      (orpc.warehouse as any).getWarehouseProductsForStock.call({ limit: 500 }),
  });
  const allProducts: ProductResult[] = allProductsData?.products ?? [];

  // Type options (derived from categories' type relation)
  const typeOptions = useMemo(() => {
    const map = new Map<number, string>();
    allProducts.forEach((p) => {
      const t = p.category?.type;
      if (t) map.set(t.id, t.name);
    });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [allProducts]);

  // Category options (filtered by selected type)
  const categoryOptions = useMemo(() => {
    const map = new Map<number, string>();
    allProducts
      .filter((p) => !modalTypeId || p.category?.typeId === modalTypeId)
      .forEach((p) => {
        if (p.category) map.set(p.category.id, p.category.name);
      });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [allProducts, modalTypeId]);

  // Sub-category options (filtered by selected category)
  const subCategoryOptions = useMemo(() => {
    const map = new Map<number, string>();
    allProducts
      .filter((p) => !modalCategoryId || p.categoryId === modalCategoryId)
      .forEach((p) => {
        if (p.subCategory) map.set(p.subCategory.id, p.subCategory.name);
      });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [allProducts, modalCategoryId]);

  const { data: suppliersData } = useQuery({
    queryKey: ["warehouse", "getSuppliers"],
    queryFn: () => (orpc.warehouse as any).getSuppliers.call({}),
  });

  const suppliers: any[] = suppliersData?.suppliers ?? [];

  const { data: storageAreasData } = useQuery({
    queryKey: ["warehouse", "getStorageAreas"],
    queryFn: () => (orpc.warehouse as any).getStorageAreas.call({}),
  });

  const storageAreas: any[] = storageAreasData?.areas ?? [];

  const { data: nextCartonIdData } = useQuery({
    queryKey: ["warehouse", "getNextCartonIdPreview"],
    queryFn: () => (orpc.warehouse as any).getNextCartonIdPreview.call({}),
  });

  // === Derived state ===

  const nextCartonId = nextCartonIdData?.nextCartonId ?? "";

  const nextCartonIdParts = useMemo(() => {
    const match = nextCartonId.match(/^(.*-)(\d+)$/);
    if (!match) return null;
    return {
      prefix: match[1]!,
      nextNumber: Number(match[2]),
      width: match[2]!.length,
    };
  }, [nextCartonId]);

  const getCartonCount = useCallback((row: TableRow) => {
    const count = Math.floor(parseFloat(row.quantity) || 0);
    return count > 0 ? count : 0;
  }, []);

  const getCartonPacksPerCarton = useCallback((row: TableRow) => {
    const variant = row.variantId
      ? row.product.variants.find((v) => v.id === row.variantId)
      : null;
    const unitSizeKg = parseFloat(row.cartonUnitSize) || 0;
    const packWeightKg = parseFloat(variant?.weightKg || "0");
    if (!variant || unitSizeKg <= 0 || packWeightKg <= 0) return 0;
    const packs = unitSizeKg / packWeightKg;
    const roundedPacks = Math.round(packs);
    return Math.abs(packs - roundedPacks) < 0.001 ? roundedPacks : 0;
  }, []);

  const modalIsFashionProduct = isFashionTypeName(
    modalSelectedProduct?.category?.type?.name,
  );

  // Available attributes for modal selected product (filtered by entry type)
  const modalAvailableAttributes = useMemo(() => {
    if (!modalSelectedProduct) return [];

    if (modalIsFashionProduct) {
      const colorSet = new Set<string>();
      modalSelectedProduct.variants.forEach((v) => {
        const isLoose = v.packType === "loose";
        if (entryType === "loose" && !isLoose) return;
        if (entryType !== "loose" && isLoose) return;
        const color = String(v.color || "").trim();
        if (color) colorSet.add(color);
      });
      return Array.from(colorSet.values()).map((color) => ({
        key: color,
        label: color,
      }));
    }

    const brandMap = new Map<number, { key: string; label: string }>();
    modalSelectedProduct.variants.forEach((v) => {
      if (v.brand && v.brandId) {
        const isLoose = v.packType === "loose";
        if (entryType === "loose" && !isLoose) return;
        if (entryType !== "loose" && isLoose) return;
        brandMap.set(v.brand.id, {
          key: String(v.brand.id),
          label: v.brand.name,
        });
      }
    });
    return Array.from(brandMap.values());
  }, [entryType, modalIsFashionProduct, modalSelectedProduct]);

  // Check if all rows are complete
  const allRowsComplete = useMemo(() => {
    if (tableRows.length === 0) return true;
    return tableRows.every((row) => {
      if (
        row.variantId === null ||
        row.quantity === "" ||
        (entryType === "carton"
          ? getCartonCount(row) <= 0
          : parseFloat(row.quantity) <= 0)
      )
        return false;
      if (entryType === "loose") {
        return (
          row.looseWeight !== "" &&
          parseFloat(row.looseWeight) > 0 &&
          row.totalPrice !== "" &&
          parseFloat(row.totalPrice) > 0
        );
      }
      if (entryType === "carton") {
        return (
          row.cartonUnitSize !== "" &&
          parseFloat(row.cartonUnitSize) > 0 &&
          getCartonPacksPerCarton(row) > 0 &&
          row.pricePerPack !== "" &&
          parseFloat(row.pricePerPack) > 0
        );
      }
      return row.pricePerPack !== "" && parseFloat(row.pricePerPack) > 0;
    });
  }, [getCartonCount, getCartonPacksPerCarton, tableRows, entryType]);

  // Get filtered variants for a row (by brand/color + entry type)
  const getVariantsForRow = useCallback(
    (row: TableRow) => {
      return row.product.variants
        .filter((v) => {
          if (row.attributeKind === "color") {
            if (String(v.color || "").trim() !== row.brandName) return false;
          } else if (v.brandId !== row.brandId) {
            return false;
          }
          if (entryType === "loose") return v.packType === "loose";
          return v.packType !== "loose";
        })
        .sort(
          (a, b) =>
            getVariantMeasure(a).quantityPerPack -
            getVariantMeasure(b).quantityPerPack,
        );
    },
    [entryType],
  );

  // Get variant object for a row
  const getRowVariant = useCallback((row: TableRow) => {
    if (!row.variantId) return null;
    return row.product.variants.find((v) => v.id === row.variantId) || null;
  }, []);

  const getRowTotalQtyValue = useCallback(
    (row: TableRow) => {
      const variant = getRowVariant(row);
      if (!variant || !row.quantity || parseFloat(row.quantity) <= 0) return 0;
      const qty = parseFloat(row.quantity);
      const isFashionRow = isFashionTypeName(row.product.category?.type?.name);
      if (entryType === "loose") {
        const looseWeight = parseFloat(row.looseWeight) || 0;
        return qty * looseWeight;
      }
      if (entryType === "carton") {
        const cartonUnitSize = parseFloat(row.cartonUnitSize) || 0;
        return qty * cartonUnitSize;
      }
      if (isFashionRow) {
        return qty;
      }
      return qty * getVariantMeasure(variant).quantityPerPack;
    },
    [getRowVariant, entryType],
  );

  const getRowTotalQtyUnit = useCallback(
    (row: TableRow) => {
      const variant = getRowVariant(row);
      if (entryType === "loose" || entryType === "carton") return "KG";
      if (isFashionTypeName(row.product.category?.type?.name)) return "PCS";
      return getVariantMeasure(variant).quantityUnit;
    },
    [entryType, getRowVariant],
  );

  // Compute total qty string for a row
  const getRowTotalQty = useCallback(
    (row: TableRow) => {
      const totalQty = getRowTotalQtyValue(row);
      if (totalQty <= 0) return "—";
      const unit = getRowTotalQtyUnit(row);
      const decimals = unit === "KG" ? 1 : 0;
      return `${totalQty.toFixed(decimals)} ${unit}`;
    },
    [getRowTotalQtyUnit, getRowTotalQtyValue],
  );

  const getLooseSupplierPricePerKg = useCallback(
    (row: TableRow) => {
      if (entryType !== "loose") return 0;
      const totalQty = getRowTotalQtyValue(row);
      const totalPrice = parseFloat(row.totalPrice) || 0;
      return totalQty > 0 && totalPrice > 0 ? totalPrice / totalQty : 0;
    },
    [entryType, getRowTotalQtyValue],
  );

  // Totals
  const totalSummary = useMemo(() => {
    const totals = new Map<string, number>();

    for (const row of tableRows) {
      const value = getRowTotalQtyValue(row);
      const unit = getRowTotalQtyUnit(row);
      if (value <= 0 || !unit) continue;
      totals.set(unit, (totals.get(unit) || 0) + value);
    }

    if (totals.size === 0) {
      return { label: "Total Quantity", value: "0", unit: "" };
    }

    if (totals.size === 1) {
      const [unit, total] = Array.from(totals.entries())[0]!;
      const decimals = unit === "KG" ? 1 : 0;
      return {
        label: unit === "KG" ? "Total Weight" : "Total Quantity",
        value: total.toFixed(decimals),
        unit,
      };
    }

    return {
      label: "Total Quantity",
      value: Array.from(totals.entries())
        .map(
          ([unit, total]) => `${total.toFixed(unit === "KG" ? 1 : 0)} ${unit}`,
        )
        .join(" + "),
      unit: "",
    };
  }, [getRowTotalQtyUnit, getRowTotalQtyValue, tableRows]);

  const showGenericPackQtyLabel = useMemo(
    () =>
      entryType === "pack" &&
      tableRows.some((row) =>
        isFashionTypeName(row.product.category?.type?.name),
      ),
    [entryType, tableRows],
  );

  const getCartonCodeRange = useCallback(
    (rowIndex: number) => {
      if (!nextCartonIdParts) return "CTN-...";
      const startOffset = tableRows
        .slice(0, rowIndex)
        .reduce((sum, row) => sum + Math.max(1, getCartonCount(row)), 0);
      const count = Math.max(1, getCartonCount(tableRows[rowIndex]!));
      const startNumber = nextCartonIdParts.nextNumber + startOffset;
      const endNumber = startNumber + count - 1;
      const startId = `${nextCartonIdParts.prefix}${String(startNumber).padStart(nextCartonIdParts.width, "0")}`;
      if (count === 1) return startId;
      return `${startId}-${String(endNumber).padStart(nextCartonIdParts.width, "0")}`;
    },
    [getCartonCount, nextCartonIdParts, tableRows],
  );

  // === Mutations ===

  const createAreaMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      (orpc.warehouse as any).createStorageArea.call(data),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({
        queryKey: ["warehouse", "getStorageAreas"],
      });
      setStorageAreaId(result.area.id);
      setShowCreateAreaDialog(false);
      setNewAreaName("");
      setNewAreaDescription("");
      toast.success("Storage area created!");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to create storage area");
    },
  });

  // === Handlers ===

  const handleOpenProductModal = useCallback(() => {
    setModalSearch("");
    setModalTypeId(undefined);
    setModalCategoryId(undefined);
    setModalSubCategoryId(undefined);
    setModalSelectedProduct(null);
    setModalSelectedBrandId(null);
    setModalSelectedColor(null);
    setShowProductModal(true);
  }, []);

  const handleAddFromModal = useCallback(() => {
    if (!modalSelectedProduct) return;
    const isFashionProduct = isFashionTypeName(
      modalSelectedProduct.category?.type?.name,
    );
    if (isFashionProduct && entryType !== "pack") {
      toast.error("Fashion stock should be added through Pack Entry.");
      return;
    }
    if (!isFashionProduct && !modalSelectedBrandId) return;
    if (isFashionProduct && !modalSelectedColor) return;

    const brand = modalSelectedProduct.variants.find(
      (v) => v.brandId === modalSelectedBrandId,
    )?.brand;
    const availableVariants = modalSelectedProduct.variants
      .filter((v) => {
        if (isFashionProduct) {
          if (String(v.color || "").trim() !== modalSelectedColor) return false;
        } else if (v.brandId !== modalSelectedBrandId) {
          return false;
        }
        if (entryType === "loose") return v.packType === "loose";
        return v.packType !== "loose";
      })
      .sort(
        (a, b) =>
          getVariantMeasure(a).quantityPerPack -
          getVariantMeasure(b).quantityPerPack,
      );
    const newRow: TableRow = {
      id: ++rowIdRef.current,
      product: modalSelectedProduct,
      brandId: isFashionProduct ? null : modalSelectedBrandId,
      brandName: isFashionProduct
        ? modalSelectedColor || ""
        : brand?.name || "",
      attributeKind: isFashionProduct ? "color" : "brand",
      variantId:
        (entryType === "loose" || entryType === "carton") &&
        availableVariants.length > 0
          ? availableVariants[0]!.id
          : availableVariants.length === 1
            ? availableVariants[0]!.id
            : null,
      looseWeight: "",
      cartonUnitSize: "",
      quantity: "",
      pricePerPack: "",
      totalPrice: "",
    };
    setTableRows((prev) => [...prev, newRow]);
    setShowProductModal(false);
    setModalSelectedProduct(null);
    setModalSelectedBrandId(null);
    setModalSelectedColor(null);
    toast.success(`Added ${modalSelectedProduct.name} to the table`);
  }, [
    entryType,
    modalSelectedBrandId,
    modalSelectedColor,
    modalSelectedProduct,
  ]);

  const updateRow = useCallback((rowId: number, updates: Partial<TableRow>) => {
    setTableRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, ...updates } : r)),
    );
  }, []);

  const removeRow = useCallback((rowId: number) => {
    setTableRows((prev) => prev.filter((r) => r.id !== rowId));
  }, []);

  const handleSubmit = async () => {
    if (tableRows.length === 0) {
      toast.error("Please add at least one product");
      return;
    }
    const incomplete = tableRows.find((r) => {
      if (
        !r.variantId ||
        !r.quantity ||
        (entryType === "carton"
          ? getCartonCount(r) <= 0
          : parseFloat(r.quantity) <= 0)
      )
        return true;
      if (entryType === "loose") {
        return (
          !r.looseWeight ||
          parseFloat(r.looseWeight) <= 0 ||
          !r.totalPrice ||
          parseFloat(r.totalPrice) <= 0
        );
      }
      if (entryType === "carton") {
        return (
          !r.cartonUnitSize ||
          parseFloat(r.cartonUnitSize) <= 0 ||
          getCartonPacksPerCarton(r) <= 0 ||
          !r.pricePerPack ||
          parseFloat(r.pricePerPack) <= 0
        );
      }
      return !r.pricePerPack || parseFloat(r.pricePerPack) <= 0;
    });
    if (incomplete) {
      toast.error("Please fill in all fields for every product");
      return;
    }

    setIsSubmitting(true);
    try {
      const submitRow = (row: TableRow) => {
        const totalLooseQty = getRowTotalQtyValue(row);
        const qty =
          entryType === "loose"
            ? totalLooseQty
            : entryType === "carton"
              ? getCartonCount(row)
              : parseFloat(row.quantity);
        const price =
          entryType === "loose"
            ? getLooseSupplierPricePerKg(row)
            : parseFloat(row.pricePerPack);

        return (orpc.warehouse as any).addStockEntry.call({
          variantId: row.variantId,
          entryType,
          quantity: String(qty),
          quantityUnit:
            entryType === "loose"
              ? "KG"
              : entryType === "carton"
                ? "Carton"
                : "Pack",
          supplierId: supplierId || undefined,
          costType:
            entryType === "loose"
              ? "per_kg"
              : entryType === "carton"
                ? "per_carton"
                : "per_pack",
          purchasePrice: String(price),
          reference: reference || undefined,
          batchNo: batchNo || undefined,
          expiryDate: expiryDate || undefined,
          manufactureDate: manufactureDate || undefined,
          storageAreaId: storageAreaId || undefined,
          shelfRack: shelfRack || undefined,
          note: note || undefined,
          ...(entryType === "loose"
            ? {
                looseWeightPerUnit: parseFloat(row.looseWeight) || undefined,
              }
            : {}),
          ...(entryType === "carton"
            ? {
                cartonCount: getCartonCount(row),
                packsPerCarton: getCartonPacksPerCarton(row),
                cartonSource: "packs" as const,
                createCartonRecords: true,
              }
            : {}),
        });
      };

      if (entryType === "carton") {
        for (const row of tableRows) {
          await submitRow(row);
        }
      } else {
        await Promise.all(tableRows.map((row) => submitRow(row)));
      }
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      toast.success(
        `${tableRows.length} item${tableRows.length > 1 ? "s" : ""} added to stock!`,
      );
      router.push("/warehouse/dashboard/stock");
    } catch (err: any) {
      toast.error(err?.message || "Failed to add stock");
    } finally {
      setIsSubmitting(false);
    }
  };

  // === Render ===

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="icon">
                <Link href="/warehouse/dashboard/stock">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-lg font-semibold">Add Stock</h1>
                <p className="text-sm text-muted-foreground">
                  Add inventory to your warehouse
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => router.push("/warehouse/dashboard/stock")}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  isSubmitting || tableRows.length === 0 || !allRowsComplete
                }
              >
                {isSubmitting && (
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Check className="mr-2 h-4 w-4" />
                Confirm & Add Stock ({tableRows.length})
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* ------ Step 1: Entry Mode ------ */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                1
              </div>
              <CardTitle className="text-base">Entry Mode</CardTitle>
            </div>
            <CardDescription>
              Select how you want to add stock -- this determines which products
              and fields are shown
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Loose Entry */}
              <button
                type="button"
                onClick={() => {
                  if (tableRows.length > 0 && entryType !== "loose") {
                    if (
                      !confirm(
                        "Switching mode will clear your current items. Continue?",
                      )
                    )
                      return;
                    setTableRows([]);
                  }
                  setEntryType("loose");
                }}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left cursor-pointer ${
                  entryType === "loose"
                    ? "border-amber-500 bg-amber-50 shadow-sm"
                    : "border-gray-200 hover:border-amber-200 hover:bg-amber-50/30"
                }`}
              >
                <div
                  className={`p-2.5 rounded-lg ${entryType === "loose" ? "bg-amber-100" : "bg-gray-100"}`}
                >
                  <Weight
                    className={`h-5 w-5 ${entryType === "loose" ? "text-amber-600" : "text-gray-400"}`}
                  />
                </div>
                <div>
                  <p
                    className={`text-sm font-semibold ${entryType === "loose" ? "text-amber-800" : "text-gray-700"}`}
                  >
                    Loose Entry
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Enter quantity in KG
                  </p>
                </div>
              </button>

              {/* Pack Entry */}
              <button
                type="button"
                onClick={() => {
                  if (tableRows.length > 0 && entryType !== "pack") {
                    if (
                      !confirm(
                        "Switching mode will clear your current items. Continue?",
                      )
                    )
                      return;
                    setTableRows([]);
                  }
                  setEntryType("pack");
                }}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left cursor-pointer ${
                  entryType === "pack"
                    ? "border-blue-500 bg-blue-50 shadow-sm"
                    : "border-gray-200 hover:border-blue-200 hover:bg-blue-50/30"
                }`}
              >
                <div
                  className={`p-2.5 rounded-lg ${entryType === "pack" ? "bg-blue-100" : "bg-gray-100"}`}
                >
                  <Package
                    className={`h-5 w-5 ${entryType === "pack" ? "text-blue-600" : "text-gray-400"}`}
                  />
                </div>
                <div>
                  <p
                    className={`text-sm font-semibold ${entryType === "pack" ? "text-blue-800" : "text-gray-700"}`}
                  >
                    Pack Entry
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Enter number of packs
                  </p>
                </div>
              </button>

              {/* Carton Entry */}
              <button
                type="button"
                onClick={() => {
                  if (tableRows.length > 0 && entryType !== "carton") {
                    if (
                      !confirm(
                        "Switching mode will clear your current items. Continue?",
                      )
                    )
                      return;
                    setTableRows([]);
                  }
                  setEntryType("carton");
                }}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left cursor-pointer ${
                  entryType === "carton"
                    ? "border-emerald-500 bg-emerald-50 shadow-sm"
                    : "border-gray-200 hover:border-emerald-200 hover:bg-emerald-50/30"
                }`}
              >
                <div
                  className={`p-2.5 rounded-lg ${entryType === "carton" ? "bg-emerald-100" : "bg-gray-100"}`}
                >
                  <BoxSelect
                    className={`h-5 w-5 ${entryType === "carton" ? "text-emerald-600" : "text-gray-400"}`}
                  />
                </div>
                <div>
                  <p
                    className={`text-sm font-semibold ${entryType === "carton" ? "text-emerald-800" : "text-gray-700"}`}
                  >
                    Carton Entry
                  </p>
                  <p className="text-xs text-muted-foreground">
                    New supplier cartons
                  </p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* ------ Stock Items Table ------ */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">
                      Stock Items{" "}
                      {tableRows.length > 0 && `(${tableRows.length})`}
                    </CardTitle>
                  </div>
                  {tableRows.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setTableRows([])}
                    >
                      Clear All
                    </Button>
                  )}
                </div>
                <CardDescription>
                  Add products to this stock entry
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-t border-b bg-muted/40">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                          {entryType === "carton" ? "SKU / Code" : "SKU"}
                        </th>
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">
                          Product Name
                        </th>
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">
                          {entryType === "loose" ? "Weight" : "Unit Size"}
                        </th>
                        <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">
                          {entryType === "loose" || entryType === "carton"
                            ? "Qty"
                            : showGenericPackQtyLabel
                              ? "Qty"
                              : "Qty (Pack)"}
                        </th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">
                          Total Qty
                        </th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">
                          {entryType === "loose"
                            ? "Total Price"
                            : entryType === "carton"
                              ? "Price/Carton"
                              : "Price/Pack"}
                        </th>
                        <th className="w-10 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="text-center py-12 text-muted-foreground"
                          >
                            <div className="flex flex-col items-center gap-2">
                              <ShoppingCart className="h-8 w-8 text-muted-foreground/40" />
                              <p className="text-sm">No products added yet</p>
                              <p className="text-xs">
                                Click the button below to add products
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        tableRows.map((row, rowIndex) => {
                          const variants = getVariantsForRow(row);
                          const variant = getRowVariant(row);
                          const supplierPricePerKg =
                            getLooseSupplierPricePerKg(row);
                          const cartonRowTotalPrice =
                            getCartonCount(row) *
                            (parseFloat(row.pricePerPack) || 0);
                          return (
                            <tr
                              key={row.id}
                              className="border-b last:border-b-0 hover:bg-muted/20 transition-colors"
                            >
                              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                                {entryType === "carton"
                                  ? getCartonCodeRange(rowIndex)
                                  : variant?.sku || "—"}
                              </td>
                              <td className="px-3 py-2.5">
                                <p className="font-medium text-sm">
                                  {entryType === "carton"
                                    ? row.product.coreProduct?.name ||
                                      row.product.name
                                    : row.product.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {row.brandName}
                                </p>
                              </td>
                              <td className="px-3 py-2.5">
                                {entryType === "loose" ? (
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={row.looseWeight}
                                    onChange={(e) =>
                                      updateRow(row.id, {
                                        looseWeight: e.target.value.replace(
                                          /[^0-9.]/g,
                                          "",
                                        ),
                                      })
                                    }
                                    placeholder="KG"
                                    className="h-8 w-[90px] text-right text-sm"
                                  />
                                ) : entryType === "carton" ? (
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={row.cartonUnitSize}
                                    onChange={(e) =>
                                      updateRow(row.id, {
                                        cartonUnitSize: e.target.value.replace(
                                          /[^0-9.]/g,
                                          "",
                                        ),
                                      })
                                    }
                                    placeholder="KG"
                                    className="h-8 w-[90px] text-right text-sm"
                                  />
                                ) : (
                                  <Select
                                    value={
                                      row.variantId ? String(row.variantId) : ""
                                    }
                                    onValueChange={(v) =>
                                      updateRow(row.id, {
                                        variantId: Number(v),
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-8 w-[130px] text-xs">
                                      <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {variants.map((v) => (
                                        <SelectItem
                                          key={v.id}
                                          value={String(v.id)}
                                        >
                                          {getVariantMeasure(v).displayLabel}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  value={row.quantity}
                                  onChange={(e) =>
                                    updateRow(row.id, {
                                      quantity:
                                        entryType === "carton"
                                          ? e.target.value.replace(
                                              /[^0-9]/g,
                                              "",
                                            )
                                          : e.target.value.replace(
                                              /[^0-9.]/g,
                                              "",
                                            ),
                                    })
                                  }
                                  placeholder={
                                    entryType === "loose" ||
                                    entryType === "carton"
                                      ? "1"
                                      : "0"
                                  }
                                  className="h-8 w-[80px] text-center text-sm mx-auto"
                                />
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground text-sm">
                                {getRowTotalQty(row)}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                {entryType === "loose" ? (
                                  <div className="ml-auto w-[120px]">
                                    <Input
                                      type="text"
                                      inputMode="numeric"
                                      value={row.totalPrice}
                                      onChange={(e) =>
                                        updateRow(row.id, {
                                          totalPrice: e.target.value.replace(
                                            /[^0-9.]/g,
                                            "",
                                          ),
                                        })
                                      }
                                      placeholder="৳ 0"
                                      className="h-8 text-right text-sm"
                                    />
                                    <p className="mt-1 text-[11px] leading-none text-muted-foreground">
                                      {supplierPricePerKg > 0
                                        ? `৳ ${supplierPricePerKg.toFixed(2)}/KG`
                                        : "৳ 0.00/KG"}
                                    </p>
                                  </div>
                                ) : entryType === "carton" ? (
                                  <div className="ml-auto w-[120px]">
                                    <Input
                                      type="text"
                                      inputMode="numeric"
                                      value={row.pricePerPack}
                                      onChange={(e) =>
                                        updateRow(row.id, {
                                          pricePerPack: e.target.value.replace(
                                            /[^0-9.]/g,
                                            "",
                                          ),
                                        })
                                      }
                                      placeholder="৳ 0"
                                      className="h-8 text-right text-sm"
                                    />
                                    <p className="mt-1 text-[11px] leading-none text-muted-foreground">
                                      ৳ {cartonRowTotalPrice.toFixed(2)} total
                                    </p>
                                  </div>
                                ) : (
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={row.pricePerPack}
                                    onChange={(e) =>
                                      updateRow(row.id, {
                                        pricePerPack: e.target.value.replace(
                                          /[^0-9.]/g,
                                          "",
                                        ),
                                      })
                                    }
                                    placeholder="৳ 0"
                                    className="h-8 w-[90px] text-right text-sm ml-auto"
                                  />
                                )}
                              </td>
                              <td className="px-2 py-2.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeRow(row.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="border-t p-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleOpenProductModal}
                    disabled={!allRowsComplete}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                  </Button>
                  {!allRowsComplete && (
                    <p className="text-xs text-amber-600 mt-2 text-center">
                      Please complete all required values before adding more
                      products
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar -- Supplier Info + Summary */}
          <div className="space-y-4">
            {/* ------ Payment & Supplier Info ------ */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-sm">Payment & Supplier</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field>
                  <FieldLabel className="text-xs">Supplier / Payee</FieldLabel>
                  <Select
                    value={supplierId ? String(supplierId) : ""}
                    onValueChange={(v) => setSupplierId(Number(v))}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select supplier..." />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                          {s.company ? ` (${s.company})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Field>
                    <FieldLabel className="text-xs">Payment</FieldLabel>
                    <Select
                      value={paymentAccount}
                      onValueChange={(v) =>
                        setPaymentAccount(v as "cash" | "bank")
                      }
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel className="text-xs">Date</FieldLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full h-8 justify-start text-left font-normal text-sm",
                            !paymentDate && "text-muted-foreground",
                          )}
                        >
                          {paymentDate ? (
                            format(paymentDate, "MMM d, yyyy")
                          ) : (
                            <span>Pick date</span>
                          )}
                          <CalendarIcon className="ml-auto h-3.5 w-3.5 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={paymentDate}
                          onSelect={(date) =>
                            setPaymentDate(date ?? new Date())
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </Field>
                </div>

                <Field>
                  <FieldLabel className="text-xs">
                    Reference / Invoice No
                  </FieldLabel>
                  <Input
                    className="h-8 text-sm"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. INV-001"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Field>
                    <FieldLabel className="text-xs">Location</FieldLabel>
                    {storageAreas.length > 0 ? (
                      <Select
                        value={storageAreaId ? String(storageAreaId) : ""}
                        onValueChange={(v) => {
                          if (v === "__create__") {
                            setShowCreateAreaDialog(true);
                            return;
                          }
                          setStorageAreaId(Number(v));
                        }}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Location..." />
                        </SelectTrigger>
                        <SelectContent>
                          {storageAreas.map((a: any) => (
                            <SelectItem key={a.id} value={String(a.id)}>
                              {a.name}
                            </SelectItem>
                          ))}
                          <SelectItem
                            value="__create__"
                            className="text-primary font-medium"
                          >
                            + Create New
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-8 justify-start text-muted-foreground font-normal text-sm"
                        onClick={() => setShowCreateAreaDialog(true)}
                      >
                        + Create
                      </Button>
                    )}
                  </Field>

                  <Field>
                    <FieldLabel className="text-xs">Shelf / Rack</FieldLabel>
                    <Input
                      className="h-8 text-sm"
                      value={shelfRack}
                      onChange={(e) => setShelfRack(e.target.value)}
                      placeholder="e.g. A-01"
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>

            {/* ------ Entry Summary ------ */}
            <Card className="sticky top-20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Entry Summary</CardTitle>
                {tableRows.length > 0 && (
                  <CardDescription>
                    {tableRows.length} item{tableRows.length > 1 ? "s" : ""}{" "}
                    added
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mb-0.5">
                      Total Items
                    </p>
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                      {tableRows.length}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900">
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mb-0.5">
                      {totalSummary.label}
                    </p>
                    <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                      {totalSummary.value}
                      {totalSummary.unit && (
                        <span className="text-xs font-medium ml-0.5">
                          {totalSummary.unit}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Items Mini List */}
                {tableRows.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Items
                      </p>
                      {tableRows.map((row, idx) => (
                        <div
                          key={row.id}
                          className="flex items-center justify-between text-sm gap-2"
                        >
                          <span className="truncate text-muted-foreground">
                            <span className="text-foreground font-medium">
                              {idx + 1}.
                            </span>{" "}
                            {row.product.name}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {row.brandName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Action */}
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleSubmit}
                  disabled={
                    isSubmitting || tableRows.length === 0 || !allRowsComplete
                  }
                >
                  {isSubmitting && (
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <Check className="mr-2 h-4 w-4" />
                  {tableRows.length === 0
                    ? "Add items to continue"
                    : `Confirm & Add Stock (${tableRows.length})`}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ------ Product Selection Modal ------ */}
      <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Product</DialogTitle>
            <DialogDescription>
              Choose a product and the matching attribute to add to your stock
              entry
            </DialogDescription>
          </DialogHeader>

          {!modalSelectedProduct ? (
            <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
              {/* Filters: Type → Category → Sub-category */}
              <div className="flex gap-2 flex-wrap">
                <Select
                  value={modalTypeId ? String(modalTypeId) : "all"}
                  onValueChange={(v) => {
                    setModalTypeId(v === "all" ? undefined : Number(v));
                    setModalCategoryId(undefined);
                    setModalSubCategoryId(undefined);
                  }}
                >
                  <SelectTrigger className="w-full text-sm h-9 min-w-[120px] flex-1">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {typeOptions.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {categoryOptions.length > 0 && (
                  <Select
                    value={modalCategoryId ? String(modalCategoryId) : "all"}
                    onValueChange={(v) => {
                      setModalCategoryId(v === "all" ? undefined : Number(v));
                      setModalSubCategoryId(undefined);
                    }}
                  >
                    <SelectTrigger className="w-full text-sm h-9 min-w-[120px] flex-1">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categoryOptions.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {subCategoryOptions.length > 0 && (
                  <Select
                    value={
                      modalSubCategoryId ? String(modalSubCategoryId) : "all"
                    }
                    onValueChange={(v) =>
                      setModalSubCategoryId(v === "all" ? undefined : Number(v))
                    }
                  >
                    <SelectTrigger className="w-full text-sm h-9 min-w-[120px] flex-1">
                      <SelectValue placeholder="Sub-category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sub-categories</SelectItem>
                      {subCategoryOptions.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
                {loadingProducts ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : products.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No products found
                  </div>
                ) : (
                  products.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left hover:bg-muted/80 transition-colors cursor-pointer"
                      onClick={() => {
                        setModalSelectedProduct(p);
                        setModalSelectedBrandId(null);
                        setModalSelectedColor(null);
                      }}
                    >
                      {p.image && (
                        <Image
                          src={p.image}
                          alt={p.name}
                          width={36}
                          height={36}
                          className="w-9 h-9 rounded-md object-cover border"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {p.category?.type?.name
                            ? `${p.category.type.name} > `
                            : ""}
                          {p.category?.name}
                          {p.subCategory ? ` > ${p.subCategory.name}` : ""}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected product header */}
              <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                {modalSelectedProduct.image && (
                  <Image
                    src={modalSelectedProduct.image}
                    alt={modalSelectedProduct.name}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-lg object-cover border"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">
                    {modalSelectedProduct.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {modalSelectedProduct.category?.name}
                    {modalSelectedProduct.coreProduct
                      ? ` · ${modalSelectedProduct.coreProduct.name}`
                      : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setModalSelectedProduct(null);
                    setModalSelectedBrandId(null);
                    setModalSelectedColor(null);
                  }}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              </div>

              {/* Attribute selection */}
              <div>
                {modalIsFashionProduct && entryType !== "pack" && (
                  <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    Fashion products should be added with Pack Entry only.
                  </p>
                )}
                <p className="text-sm font-medium mb-2">
                  Select {modalIsFashionProduct ? "Color" : "Brand"}
                </p>
                {modalAvailableAttributes.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No {modalIsFashionProduct ? "colors" : "brands"} available{" "}
                    for this entry type
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {modalAvailableAttributes.map((attribute) => (
                      <button
                        key={attribute.key}
                        type="button"
                        onClick={() => {
                          if (modalIsFashionProduct) {
                            setModalSelectedColor(attribute.label);
                            setModalSelectedBrandId(null);
                          } else {
                            setModalSelectedBrandId(Number(attribute.key));
                            setModalSelectedColor(null);
                          }
                        }}
                        className={`p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${
                          (
                            modalIsFashionProduct
                              ? modalSelectedColor === attribute.label
                              : modalSelectedBrandId === Number(attribute.key)
                          )
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-gray-200 hover:border-primary/30"
                        }`}
                      >
                        <p className="text-sm font-medium">{attribute.label}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowProductModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddFromModal}
                  disabled={
                    modalIsFashionProduct
                      ? !modalSelectedColor
                      : !modalSelectedBrandId
                  }
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add to Table
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ------ Create Storage Area Dialog ------ */}
      <Dialog
        open={showCreateAreaDialog}
        onOpenChange={setShowCreateAreaDialog}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Storage Area</DialogTitle>
            <DialogDescription>
              Add a new storage area for your warehouse (e.g. Main Warehouse,
              Cold Storage, Dry Store).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Field>
              <FieldLabel>Name *</FieldLabel>
              <Input
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                placeholder="e.g. Main Warehouse"
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel>Description (Optional)</FieldLabel>
              <Input
                value={newAreaDescription}
                onChange={(e) => setNewAreaDescription(e.target.value)}
                placeholder="e.g. Ground floor, 500 sqft dry storage"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateAreaDialog(false)}
              disabled={createAreaMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newAreaName.trim()) {
                  toast.error("Please enter a name");
                  return;
                }
                createAreaMutation.mutate({
                  name: newAreaName.trim(),
                  description: newAreaDescription.trim() || undefined,
                });
              }}
              disabled={createAreaMutation.isPending || !newAreaName.trim()}
            >
              {createAreaMutation.isPending && (
                <Loader className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
