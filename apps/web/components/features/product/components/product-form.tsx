"use client";

import {
  FULFILLMENT_UNITS,
  type FulfillmentUnitCode,
  type ProductTypeFulfillmentProfile,
} from "@bikalpo-project/db/fulfillment";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ImageIcon,
  Info,
  Loader,
  Package,
  Plus,
  Save,
  Search,
  Settings,
  Tag,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import AdditionalImagesUploader from "@/components/AdditionalImagesUploader";
import ImageUploader from "@/components/ImageUploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import RichTextEditor from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  createProductSchema,
  updateProductSchema,
} from "@/schema/product.schema";
import { generateSlug } from "@/utils/generate-slug";
import { client, orpc } from "@/utils/orpc";
import type { ProductWithRelations } from "./product-columns";
import ProductFeaturesInput from "./product-features-input";
import type { DraftVariant } from "./variant-form-dialog";

// ============================================================
// Types
// ============================================================

export type VariantPriceSettings = {
  variantOptionId: number;
  brandId?: number | null;
  consumerPrice: string;
};

/** A saved brand configuration with its selected variant options and settings */
type BrandConfig = {
  brandId: number;
  brandName: string;
  /** Which variant option IDs are included for this brand */
  selectedVariantIds: number[];
  /** Per-variant settings keyed by variantOptionId */
  variantSettings: Record<number, VariantPriceSettings>;
};

type ProductRuleTrackingType = "none" | "batch" | "serial";

type ProductRuleSettings = {
  trackingTypes: ProductRuleTrackingType[];
  trackingAvailable: boolean;
  defaultTrackingType: ProductRuleTrackingType;
  returnPolicyAvailable: boolean;
  returnPolicyDefault: boolean;
  expiryAvailable: boolean;
  expiryDefault: boolean;
  damageAvailable: boolean;
  damageDefault: boolean;
  stockTrackingAvailable: boolean;
  stockTrackingDefault: boolean;
  minimumOrderAvailable: boolean;
  minimumOrderDefault: boolean;
  minimumOrderQtyDefault: string;
  inventoryUnitOptions: FulfillmentUnitCode[];
  inventoryUnitAvailable: boolean;
  defaultInventoryUnit: FulfillmentUnitCode;
  conversionAvailable: boolean;
  conversionDefault: boolean;
  inventoryLooseUnitAvailable: boolean;
  inventoryLooseUnitDefault: boolean;
  inventoryLooseUnitOptions: FulfillmentUnitCode[];
  defaultInventoryLooseUnit: FulfillmentUnitCode;
  returnablePackAvailable: boolean;
  returnablePackDefault: boolean;
  defaultPackDepositAmount: string;
};

type ProductRuleDefaults = {
  trackingType: ProductRuleTrackingType;
  expiryEnabled: boolean;
  damageControlEnabled: boolean;
  isReturnablePack: boolean;
  returnPolicyEnabled: boolean;
  stockTrackingEnabled: boolean;
  minimumOrderEnabled: boolean;
  minimumOrderQty: string;
  inventoryUnit: FulfillmentUnitCode;
  conversionEnabled: boolean;
  inventoryLooseUnitEnabled: boolean;
  inventoryLooseUnit: FulfillmentUnitCode;
  defaultPackDepositAmount: string;
};

const FALLBACK_RULE_SETTINGS: ProductRuleSettings = {
  trackingTypes: ["none"],
  trackingAvailable: true,
  defaultTrackingType: "none",
  returnPolicyAvailable: true,
  returnPolicyDefault: true,
  expiryAvailable: true,
  expiryDefault: false,
  damageAvailable: true,
  damageDefault: true,
  stockTrackingAvailable: true,
  stockTrackingDefault: true,
  minimumOrderAvailable: true,
  minimumOrderDefault: true,
  minimumOrderQtyDefault: "1",
  inventoryUnitOptions: ["unit"],
  inventoryUnitAvailable: true,
  defaultInventoryUnit: "unit",
  conversionAvailable: true,
  conversionDefault: false,
  inventoryLooseUnitAvailable: false,
  inventoryLooseUnitDefault: false,
  inventoryLooseUnitOptions: ["kg"],
  defaultInventoryLooseUnit: "kg",
  returnablePackAvailable: true,
  returnablePackDefault: false,
  defaultPackDepositAmount: "0",
};

function normalizeRuleSettings(
  settings?: ProductRuleSettings | null,
): ProductRuleSettings {
  const source = settings ?? FALLBACK_RULE_SETTINGS;
  const trackingTypes = source.trackingTypes?.length
    ? source.trackingTypes
    : FALLBACK_RULE_SETTINGS.trackingTypes;
  const inventoryUnitOptions = source.inventoryUnitOptions?.length
    ? source.inventoryUnitOptions
    : FALLBACK_RULE_SETTINGS.inventoryUnitOptions;
  const inventoryLooseUnitOptions = source.inventoryLooseUnitOptions?.length
    ? source.inventoryLooseUnitOptions
    : FALLBACK_RULE_SETTINGS.inventoryLooseUnitOptions;

  return {
    ...FALLBACK_RULE_SETTINGS,
    ...source,
    trackingTypes,
    trackingAvailable: source.trackingAvailable ?? true,
    defaultTrackingType: trackingTypes.includes(source.defaultTrackingType)
      ? source.defaultTrackingType
      : trackingTypes[0]!,
    inventoryUnitOptions,
    defaultInventoryUnit: inventoryUnitOptions.includes(
      source.defaultInventoryUnit,
    )
      ? source.defaultInventoryUnit
      : inventoryUnitOptions[0]!,
    inventoryUnitAvailable: source.inventoryUnitAvailable ?? true,
    inventoryLooseUnitOptions,
    defaultInventoryLooseUnit: inventoryLooseUnitOptions.includes(
      source.defaultInventoryLooseUnit,
    )
      ? source.defaultInventoryLooseUnit
      : inventoryLooseUnitOptions[0]!,
    minimumOrderQtyDefault: String(source.minimumOrderQtyDefault ?? "1"),
    defaultPackDepositAmount: String(source.defaultPackDepositAmount ?? "0"),
  };
}

function getRuleDefaultsFromSettings(
  settings?: ProductRuleSettings | null,
): ProductRuleDefaults {
  const normalized = normalizeRuleSettings(settings);

  return {
    trackingType: normalized.trackingAvailable
      ? normalized.defaultTrackingType
      : "none",
    expiryEnabled: normalized.expiryAvailable && normalized.expiryDefault,
    damageControlEnabled:
      normalized.damageAvailable && normalized.damageDefault,
    isReturnablePack:
      normalized.returnablePackAvailable && normalized.returnablePackDefault,
    returnPolicyEnabled:
      normalized.returnPolicyAvailable && normalized.returnPolicyDefault,
    stockTrackingEnabled:
      normalized.stockTrackingAvailable && normalized.stockTrackingDefault,
    minimumOrderEnabled:
      normalized.minimumOrderAvailable && normalized.minimumOrderDefault,
    minimumOrderQty: normalized.minimumOrderQtyDefault,
    inventoryUnit: normalized.defaultInventoryUnit,
    conversionEnabled:
      normalized.conversionAvailable && normalized.conversionDefault,
    inventoryLooseUnitEnabled:
      normalized.inventoryLooseUnitAvailable &&
      normalized.inventoryLooseUnitDefault,
    inventoryLooseUnit: normalized.defaultInventoryLooseUnit,
    defaultPackDepositAmount: normalized.defaultPackDepositAmount,
  };
}

// ============================================================
// Main Component
// ============================================================

interface ProductFormProps {
  mode: "create" | "edit";
  product?: ProductWithRelations;
  initialCoreProductId?: number | null;
}

export default function ProductForm({
  mode,
  product,
  initialCoreProductId = null,
}: ProductFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEdit = mode === "edit";
  const initialCoreProductIdForCreate =
    !isEdit && initialCoreProductId && Number.isFinite(initialCoreProductId)
      ? initialCoreProductId
      : null;
  const isCoreIdentityLocked = initialCoreProductIdForCreate !== null;

  // === State for cascading selection ===
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(
    (product?.category as any)?.typeId ?? null,
  );
  const [selectedCategory, setSelectedCategory] = useState<number | null>(
    product?.categoryId ?? null,
  );
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<
    number | null
  >(product?.subCategoryId ?? null);
  const [selectedCoreProductId, setSelectedCoreProductId] = useState<
    number | null
  >((product as any)?.coreProductId ?? initialCoreProductIdForCreate);
  const [initializedCoreProductId, setInitializedCoreProductId] = useState<
    number | null
  >(null);
  const [ruleDefaultsAppliedTypeId, setRuleDefaultsAppliedTypeId] = useState<
    number | null
  >(null);
  const [draftVariants] = useState<DraftVariant[]>([]);
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");

  // === Brand configuration state ===
  const [brandConfigs, setBrandConfigs] = useState<BrandConfig[]>(() => {
    // Pre-populate from existing product (edit mode)
    const pbs = (product as any)?.productBrands;
    const existingVPs = (product as any)?.variantPrices;
    if (!pbs || !Array.isArray(pbs) || pbs.length === 0) return [];

    const configs: BrandConfig[] = [];
    for (const pb of pbs) {
      // Find variant prices for this brand
      const brandVPs = (existingVPs || []).filter(
        (vp: any) =>
          (vp.brandId ?? null) === pb.brandId ||
          (!vp.brandId && pbs.length === 1),
      );

      const variantSettings: Record<number, VariantPriceSettings> = {};
      const selectedVariantIds: number[] = [];
      for (const vp of brandVPs) {
        selectedVariantIds.push(vp.variantOptionId);
        variantSettings[vp.variantOptionId] = {
          variantOptionId: vp.variantOptionId,
          brandId: pb.brandId,
          consumerPrice: vp.consumerPrice || "",
        };
      }

      configs.push({
        brandId: pb.brandId,
        brandName: pb.brand?.name ?? `Brand #${pb.brandId}`,
        selectedVariantIds,
        variantSettings,
      });
    }
    return configs;
  });

  // Currently-editing brand (for the inline config panel)
  const [activeBrandId, setActiveBrandId] = useState<number | null>(null);
  const [expandedBrandId, setExpandedBrandId] = useState<number | null>(null);

  // === Reference data queries ===
  const { data: typesData } = useQuery(
    orpc.adminProductType.getAll.queryOptions({ input: {} }),
  );
  const productTypes = typesData?.types ?? [];

  const { data: categoriesData } = useQuery(
    orpc.category.getAll.queryOptions(),
  );
  const allCategories = Array.isArray(categoriesData) ? categoriesData : [];

  const { data: subcategoriesData } = useQuery(
    orpc.adminSubcategory.getAllGlobal.queryOptions(),
  );
  const allSubcategories = Array.isArray(subcategoriesData)
    ? subcategoriesData
    : [];

  // Core products filtered by category
  const { data: coreProductsData } = useQuery(
    orpc.adminCoreProduct.getAll.queryOptions({
      input: {
        categoryId: selectedCategory ?? undefined,
        subCategoryId: selectedSubCategoryId ?? undefined,
      },
    }),
  );
  const coreProducts = coreProductsData?.coreProducts ?? [];

  const lockedCoreProductQuery = useQuery({
    ...orpc.adminCoreProduct.getById.queryOptions({
      input: { id: initialCoreProductIdForCreate ?? 0 },
    }),
    enabled: isCoreIdentityLocked,
  });

  const { data: catalogOptionsData } = useQuery({
    queryKey: ["adminCatalogApproval", "productFormOptions"],
    queryFn: () => orpc.adminCatalogApproval.getRequestOptions.call({}),
  });

  // ALL brands (global, unrestricted)
  const { data: allBrandsData } = useQuery(orpc.brand.getAll.queryOptions());
  const allBrands = Array.isArray(allBrandsData) ? allBrandsData : [];

  // Derived: selected core product details
  const selectedCoreProduct = coreProducts.find(
    (cp: any) => cp.id === selectedCoreProductId,
  );
  const lockedCoreProduct = lockedCoreProductQuery.data?.coreProduct;
  const activeCoreProduct = lockedCoreProduct ?? selectedCoreProduct;
  const availableVariantOptions =
    isCoreIdentityLocked && !activeCoreProduct
      ? []
      : getAvailableVariantsForCoreProduct(
          activeCoreProduct,
          catalogOptionsData?.variantOptions ?? [],
        );
  const isLoadingLockedCoreProduct =
    isCoreIdentityLocked &&
    lockedCoreProductQuery.isLoading &&
    !activeCoreProduct;
  const activeTypeId =
    (activeCoreProduct as any)?.category?.typeId ?? selectedTypeId;
  const activeProductType = productTypes.find(
    (type: any) => type.id === activeTypeId,
  );
  const activeFulfillmentProfile = activeProductType?.fulfillmentProfile as
    | ProductTypeFulfillmentProfile
    | undefined;
  const activeRuleSettings = useMemo(
    () =>
      normalizeRuleSettings(
        activeProductType?.ruleSettings as ProductRuleSettings | undefined,
      ),
    [activeProductType?.ruleSettings],
  );
  const activeRuleDefaults = getRuleDefaultsFromSettings(activeRuleSettings);
  const activeTypeName =
    (activeCoreProduct as any)?.category?.type?.name ??
    activeProductType?.name ??
    "Unassigned";

  // Filter cascades
  const filteredCategories = selectedTypeId
    ? allCategories.filter((c: any) => c.typeId === selectedTypeId)
    : allCategories;

  const filteredSubcategories = selectedCategory
    ? allSubcategories.filter((sc: any) => sc.categoryId === selectedCategory)
    : [];

  // Brands already configured (exclude from add-brand dropdown)
  const configuredBrandIds = new Set(brandConfigs.map((bc) => bc.brandId));
  const availableBrands = allBrands.filter(
    (b: any) => !configuredBrandIds.has(b.id),
  );

  const handleError = () => {
    toast.error(
      `An unexpected error occurred while ${isEdit ? "updating" : "creating"} the product.`,
    );
  };

  const createMutation = useMutation({
    ...orpc.product.create.mutationOptions(),
    onSuccess: async (result) => {
      if (result.product && draftVariants.length > 0) {
        const newProductId = result.product.id;
        try {
          for (const d of draftVariants) {
            await client.adminProductVariant.create({
              ...d,
              productId: newProductId,
            });
          }
        } catch {
          toast.error("Product created but some variants failed to save.");
        }
      }
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Product created successfully");
      router.push("/dashboard/admin/products");
    },
    onError: handleError,
  });

  const updateMutation = useMutation({
    ...orpc.product.update.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Product updated successfully");
      router.push("/dashboard/admin/products");
    },
    onError: handleError,
  });

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    isLoadingLockedCoreProduct;

  const form = useForm({
    defaultValues: {
      id: product?.id ?? 0,
      name: product?.name ?? "",
      slug: product?.slug ?? "",
      sku: product?.sku ?? "",
      description: product?.description ?? "",
      categoryId: product?.categoryId ?? 0,
      subCategoryId:
        product?.subCategoryId ?? (undefined as number | undefined),

      // These fields are auto-managed (synced from variants)
      size: product?.size ?? "—",
      price: product?.price ?? "0",
      reorderLevel: product?.reorderLevel ?? 0,
      supplier: product?.supplier ?? "",
      image: product?.image ?? "",
      additionalImages:
        product?.images?.map((img) => img.imageUrl) ?? ([] as string[]),
      features: (product?.features ?? []) as {
        title: string;
        items: { key: string; value: string }[];
      }[],
      isFeatured: product?.isFeatured ?? false,
      brandId: product?.brandId ?? (undefined as number | undefined),

      // New fields
      coreProductId:
        (product as any)?.coreProductId ?? initialCoreProductIdForCreate,
      shortDescription: (product as any)?.shortDescription ?? "",
      videoUrl: (product as any)?.videoUrl ?? "",
      trackingType:
        (product as any)?.trackingType ?? activeRuleDefaults.trackingType,
      expiryEnabled:
        (product as any)?.expiryEnabled ?? activeRuleDefaults.expiryEnabled,
      damageControlEnabled:
        (product as any)?.damageControlEnabled ??
        activeRuleDefaults.damageControlEnabled,
      isReturnablePack:
        (product as any)?.isReturnablePack ??
        activeRuleDefaults.isReturnablePack,
      defaultPackDepositAmount: String(
        (product as any)?.defaultPackDepositAmount ??
          activeRuleDefaults.defaultPackDepositAmount,
      ),
      allowedPackBrands:
        (product as any)?.allowedPackBrands ?? ([] as string[]),
      allowedPackSizes: (product as any)?.allowedPackSizes ?? ([] as string[]),
      stockTrackingEnabled:
        (product as any)?.stockTrackingEnabled ??
        activeRuleDefaults.stockTrackingEnabled,
      returnPolicyEnabled:
        (product as any)?.returnPolicyEnabled ??
        activeRuleDefaults.returnPolicyEnabled,
      minimumOrderEnabled:
        (product as any)?.minimumOrderEnabled ??
        activeRuleDefaults.minimumOrderEnabled,
      minimumOrderQty: String(
        (product as any)?.minimumOrderQty ?? activeRuleDefaults.minimumOrderQty,
      ),
      inventoryUnit:
        (product as any)?.inventoryUnit ?? activeRuleDefaults.inventoryUnit,
      conversionEnabled:
        (product as any)?.conversionEnabled ??
        activeRuleDefaults.conversionEnabled,
      inventoryLooseUnitEnabled:
        (product as any)?.inventoryLooseUnitEnabled ??
        activeRuleDefaults.inventoryLooseUnitEnabled,
      inventoryLooseUnit:
        (product as any)?.inventoryLooseUnit ??
        activeRuleDefaults.inventoryLooseUnit,
      visibility: (product as any)?.visibility ?? "public",
      status: (product as any)?.status ?? "active",
    },
    validators: {
      //@ts-expect-error
      onSubmit: isEdit ? updateProductSchema : createProductSchema,
    },
    onSubmit: async ({ value }) => {
      // Build variant prices array from brand configs
      const vpArray: any[] = [];
      for (const bc of brandConfigs) {
        for (const voId of bc.selectedVariantIds) {
          const settings = bc.variantSettings[voId];
          if (!settings) continue;
          vpArray.push({
            variantOptionId: settings.variantOptionId,
            brandId: bc.brandId,
            consumerPrice: settings.consumerPrice || "0",
          });
        }
      }

      const brandIds = brandConfigs.map((bc) => bc.brandId);

      const payload = {
        ...value,
        coreProductId: selectedCoreProductId,
        brandIds: brandIds.length > 0 ? brandIds : undefined,
        variantPrices: vpArray.length > 0 ? vpArray : undefined,
      };

      if (isEdit) {
        updateMutation.mutate(payload);
      } else {
        createMutation.mutate(payload);
      }
    },
  });

  const autoGenerateSlugFromName = (value: string) => {
    const generatedSlug = generateSlug(value);
    form.setFieldValue("slug", generatedSlug);
  };

  const applyCoreProductToForm = useCallback(
    (cp: any) => {
      setSelectedCoreProductId(cp.id);
      setSelectedTypeId(cp.category?.typeId ?? null);
      setSelectedCategory(cp.categoryId);
      setSelectedSubCategoryId(cp.subCategoryId ?? null);
      form.setFieldValue("name", cp.name);
      form.setFieldValue("slug", cp.slug);
      form.setFieldValue("image", cp.image);
      form.setFieldValue("categoryId", cp.categoryId);
      form.setFieldValue("subCategoryId", cp.subCategoryId ?? undefined);
      form.setFieldValue("coreProductId", cp.id);
    },
    [form],
  );

  // When a core product is selected, auto-fill fields
  const handleCoreProductSelect = (cpId: number | null) => {
    setSelectedCoreProductId(cpId);
    if (cpId && coreProducts.length > 0) {
      const cp = coreProducts.find((c: any) => c.id === cpId);
      if (cp) {
        applyCoreProductToForm(cp);
      }
    }
  };

  useEffect(() => {
    if (
      !isCoreIdentityLocked ||
      !activeCoreProduct ||
      initializedCoreProductId === activeCoreProduct.id
    ) {
      return;
    }

    applyCoreProductToForm(activeCoreProduct);
    setInitializedCoreProductId(activeCoreProduct.id);
  }, [
    activeCoreProduct,
    applyCoreProductToForm,
    initializedCoreProductId,
    isCoreIdentityLocked,
  ]);

  useEffect(() => {
    if (
      isEdit ||
      !activeTypeId ||
      !activeProductType ||
      ruleDefaultsAppliedTypeId === activeTypeId
    ) {
      return;
    }

    const defaults = getRuleDefaultsFromSettings(activeRuleSettings);
    form.setFieldValue("trackingType", defaults.trackingType);
    form.setFieldValue("expiryEnabled", defaults.expiryEnabled);
    form.setFieldValue("damageControlEnabled", defaults.damageControlEnabled);
    form.setFieldValue("isReturnablePack", defaults.isReturnablePack);
    form.setFieldValue("returnPolicyEnabled", defaults.returnPolicyEnabled);
    form.setFieldValue("stockTrackingEnabled", defaults.stockTrackingEnabled);
    form.setFieldValue("minimumOrderEnabled", defaults.minimumOrderEnabled);
    form.setFieldValue("minimumOrderQty", defaults.minimumOrderQty);
    form.setFieldValue("inventoryUnit", defaults.inventoryUnit);
    form.setFieldValue("conversionEnabled", defaults.conversionEnabled);
    form.setFieldValue(
      "inventoryLooseUnitEnabled",
      defaults.inventoryLooseUnitEnabled,
    );
    form.setFieldValue("inventoryLooseUnit", defaults.inventoryLooseUnit);
    form.setFieldValue(
      "defaultPackDepositAmount",
      defaults.defaultPackDepositAmount,
    );
    setRuleDefaultsAppliedTypeId(activeTypeId);
  }, [
    activeProductType,
    activeRuleSettings,
    activeTypeId,
    form,
    isEdit,
    ruleDefaultsAppliedTypeId,
  ]);

  // Add a brand configuration
  const handleAddBrand = (brandId: number) => {
    const brand = allBrands.find((b: any) => b.id === brandId);
    if (!brand) return;

    const newConfig: BrandConfig = {
      brandId: brand.id,
      brandName: brand.name,
      selectedVariantIds: [],
      variantSettings: {},
    };

    setBrandConfigs((prev) => [...prev, newConfig]);
    setActiveBrandId(brandId);
    setExpandedBrandId(brandId);
  };

  // Remove a brand configuration
  const handleRemoveBrand = (brandId: number) => {
    setBrandConfigs((prev) => prev.filter((bc) => bc.brandId !== brandId));
    if (activeBrandId === brandId) setActiveBrandId(null);
    if (expandedBrandId === brandId) setExpandedBrandId(null);
  };

  // Toggle variant inclusion for a brand
  const handleToggleVariant = (
    brandId: number,
    variantOptionId: number,
    variantOption: any,
  ) => {
    setBrandConfigs((prev) =>
      prev.map((bc) => {
        if (bc.brandId !== brandId) return bc;
        const isIncluded = bc.selectedVariantIds.includes(variantOptionId);
        if (isIncluded) {
          const newIds = bc.selectedVariantIds.filter(
            (id) => id !== variantOptionId,
          );
          const { [variantOptionId]: _, ...rest } = bc.variantSettings;
          return { ...bc, selectedVariantIds: newIds, variantSettings: rest };
        } else {
          return {
            ...bc,
            selectedVariantIds: [...bc.selectedVariantIds, variantOptionId],
            variantSettings: {
              ...bc.variantSettings,
              [variantOptionId]: makeDefaultSettings(variantOptionId, brandId),
            },
          };
        }
      }),
    );
  };

  // Update a variant setting for a brand
  const updateBrandVariantField = (
    brandId: number,
    variantOptionId: number,
    field: keyof VariantPriceSettings,
    value: any,
  ) => {
    setBrandConfigs((prev) =>
      prev.map((bc) => {
        if (bc.brandId !== brandId) return bc;
        const current =
          bc.variantSettings[variantOptionId] ??
          makeDefaultSettings(variantOptionId, brandId);
        return {
          ...bc,
          variantSettings: {
            ...bc.variantSettings,
            [variantOptionId]: { ...current, [field]: value },
          },
        };
      }),
    );
  };

  const isLpgRules = activeFulfillmentProfile?.family === "lpg";
  const supportsLooseInventory = activeRuleSettings.inventoryLooseUnitAvailable;
  const inventoryUnitOptions = activeRuleSettings.inventoryUnitOptions.map(
    (code) => ({
      value: code,
      label: FULFILLMENT_UNITS[code]?.label ?? code,
    }),
  );
  const looseUnitOptions = activeRuleSettings.inventoryLooseUnitOptions.map(
    (code) => ({
      value: code,
      label: FULFILLMENT_UNITS[code]?.label ?? code,
    }),
  );
  const returnableRuleLabel = isLpgRules
    ? "Empty Cylinder Exchange"
    : "Empty Pack Return";
  const returnableRuleDescription = isLpgRules
    ? "Require empty cylinder exchange for refill-style sales"
    : "Require returnable packaging such as jars, drums, or packs";
  const depositLabel = isLpgRules
    ? "Exchange Value (BDT)"
    : "Deposit Amount (BDT)";
  const conversionDescription =
    "Enable unit conversion for products that need pack-to-loose or carton-to-pack handling.";

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="icon">
                <Link href="/dashboard/admin/products">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-lg font-semibold">
                  {isEdit ? "Edit Product" : "New Product"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isEdit
                    ? product?.name
                    : "Create a product from Core Identity"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/admin/products")}
                disabled={isPending}
              >
                Discard
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  form.setFieldValue("status", "draft");
                  form.handleSubmit();
                }}
                disabled={isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </Button>
              <Button onClick={() => form.handleSubmit()} disabled={isPending}>
                {isPending && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                {isEdit ? "Save Changes" : "Publish Product"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content - Left Column (2/3 width) */}
            <div className="lg:col-span-2 space-y-6">
              {/* ── 1. Core Product Selection ── */}
              {!isEdit && (
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">
                        Core Product Identity
                      </CardTitle>
                    </div>
                    <CardDescription>
                      {isCoreIdentityLocked
                        ? "This product is based on the selected core identity."
                        : "Select a pre-defined Core Identity to create a product from"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isCoreIdentityLocked ? (
                      <div className="space-y-4">
                        {isLoadingLockedCoreProduct ? (
                          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                            <Loader className="h-4 w-4 animate-spin" />
                            Loading core identity...
                          </div>
                        ) : activeCoreProduct ? (
                          <>
                            <div className="flex items-center gap-4 rounded-lg border bg-muted/40 p-3">
                              {activeCoreProduct.image ? (
                                <Image
                                  src={activeCoreProduct.image}
                                  alt={activeCoreProduct.name}
                                  width={56}
                                  height={56}
                                  className="h-14 w-14 rounded-lg border bg-background object-cover"
                                />
                              ) : (
                                <div className="flex h-14 w-14 items-center justify-center rounded-lg border bg-background">
                                  <Package className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold">
                                  {activeCoreProduct.name}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  Slug: {activeCoreProduct.slug}
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <ReadOnlyIdentityField
                                label="Type"
                                value={activeTypeName}
                              />
                              <ReadOnlyIdentityField
                                label="Category"
                                value={
                                  activeCoreProduct.category?.name ?? "None"
                                }
                              />
                              <ReadOnlyIdentityField
                                label="Sub Category"
                                value={
                                  activeCoreProduct.subCategory?.name ?? "None"
                                }
                              />
                              <ReadOnlyIdentityField
                                label="Core Identity"
                                value={activeCoreProduct.name}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                            Core identity could not be loaded.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Type */}
                        <Field>
                          <FieldLabel>Type</FieldLabel>
                          <Select
                            value={
                              selectedTypeId ? String(selectedTypeId) : "all"
                            }
                            onValueChange={(v) => {
                              const val = v === "all" ? null : Number(v);
                              setSelectedTypeId(val);
                              setSelectedCategory(null);
                              setSelectedSubCategoryId(null);
                              setSelectedCoreProductId(null);
                              form.setFieldValue("categoryId", 0);
                              form.setFieldValue("subCategoryId", undefined);
                              form.setFieldValue("coreProductId", null);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Types</SelectItem>
                              {productTypes.map((t: any) => (
                                <SelectItem key={t.id} value={String(t.id)}>
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>

                        {/* Category */}
                        <Field>
                          <FieldLabel>Category *</FieldLabel>
                          <Select
                            value={
                              selectedCategory ? String(selectedCategory) : "0"
                            }
                            onValueChange={(v) => {
                              const val = Number(v);
                              setSelectedCategory(val || null);
                              setSelectedSubCategoryId(null);
                              setSelectedCoreProductId(null);
                              form.setFieldValue("categoryId", val);
                              form.setFieldValue("subCategoryId", undefined);
                              form.setFieldValue("coreProductId", null);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0" disabled>
                                Select category
                              </SelectItem>
                              {filteredCategories.map((c: any) => (
                                <SelectItem key={c.id} value={String(c.id)}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>

                        {/* Sub Category */}
                        <Field>
                          <FieldLabel>Sub Category</FieldLabel>
                          <Select
                            value={
                              selectedSubCategoryId
                                ? String(selectedSubCategoryId)
                                : "none"
                            }
                            onValueChange={(v) => {
                              const val = v === "none" ? null : Number(v);
                              setSelectedSubCategoryId(val);
                              setSelectedCoreProductId(null);
                              form.setFieldValue(
                                "subCategoryId",
                                val ?? undefined,
                              );
                              form.setFieldValue("coreProductId", null);
                            }}
                            disabled={filteredSubcategories.length === 0}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">All</SelectItem>
                              {filteredSubcategories.map((sc: any) => (
                                <SelectItem key={sc.id} value={String(sc.id)}>
                                  {sc.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>

                        {/* Core Identity */}
                        <Field>
                          <FieldLabel>Core Identity *</FieldLabel>
                          <Select
                            value={
                              selectedCoreProductId
                                ? String(selectedCoreProductId)
                                : "0"
                            }
                            onValueChange={(v) => {
                              const val = Number(v);
                              handleCoreProductSelect(val || null);
                            }}
                            disabled={!selectedCategory}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select core product" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0" disabled>
                                Select core identity
                              </SelectItem>
                              {coreProducts.map((cp: any) => (
                                <SelectItem key={cp.id} value={String(cp.id)}>
                                  {cp.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ── 1b. Product Name (editable, separate from core identity) ── */}
              {(selectedCoreProductId || isEdit) && (
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">Product Name</CardTitle>
                    </div>
                    <CardDescription>
                      Set the display name for this product. Pre-filled from
                      Core Identity but can be customized.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <form.Field name="name">
                        {(field) => (
                          <Field>
                            <FieldLabel>Product Name *</FieldLabel>
                            <Input
                              value={field.state.value}
                              onChange={(e) => {
                                field.handleChange(e.target.value);
                                autoGenerateSlugFromName(e.target.value);
                              }}
                              placeholder="Enter product display name"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              This name will be used as the product label
                            </p>
                          </Field>
                        )}
                      </form.Field>
                      <form.Field name="slug">
                        {(field) => (
                          <Field>
                            <FieldLabel>Slug</FieldLabel>
                            <Input
                              value={field.state.value}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              placeholder="product-slug"
                            />
                          </Field>
                        )}
                      </form.Field>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── 2. Brand Selection + Variant Configuration ── */}
              {(selectedCoreProductId || isEdit) && (
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">
                        Brand & Variant Configuration
                      </CardTitle>
                    </div>
                    <CardDescription>
                      Select brands and configure variants for each. You must
                      complete variant setup before adding another brand.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Saved brand configs */}
                    {brandConfigs.map((bc) => (
                      <BrandConfigCard
                        key={bc.brandId}
                        config={bc}
                        variantOptions={availableVariantOptions}
                        isExpanded={expandedBrandId === bc.brandId}
                        onToggleExpand={() =>
                          setExpandedBrandId(
                            expandedBrandId === bc.brandId ? null : bc.brandId,
                          )
                        }
                        onRemove={() => handleRemoveBrand(bc.brandId)}
                        onToggleVariant={(voId, vo) =>
                          handleToggleVariant(bc.brandId, voId, vo)
                        }
                        onUpdateField={(voId, field, value) =>
                          updateBrandVariantField(
                            bc.brandId,
                            voId,
                            field,
                            value,
                          )
                        }
                      />
                    ))}

                    {/* Add Brand Button + Modal */}
                    <div className="border border-dashed rounded-lg p-4">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start gap-2 text-muted-foreground"
                        onClick={() => {
                          setBrandSearch("");
                          setBrandModalOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Add a brand...
                      </Button>
                      {brandConfigs.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Select a brand to begin configuring variants for this
                          product.
                        </p>
                      )}
                    </div>

                    {/* Brand Selector Modal */}
                    <Dialog
                      open={brandModalOpen}
                      onOpenChange={setBrandModalOpen}
                    >
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Select Brand</DialogTitle>
                          <DialogDescription>
                            Search and select a brand to add to this product.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                          {/* Search Input */}
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search brands..."
                              value={brandSearch}
                              onChange={(e) => setBrandSearch(e.target.value)}
                              className="pl-9"
                              autoFocus
                            />
                          </div>

                          {/* Brand List */}
                          <div className="max-h-[300px] overflow-y-auto space-y-1 -mx-1 px-1">
                            {(() => {
                              const filtered = availableBrands.filter(
                                (b: any) =>
                                  b.name
                                    .toLowerCase()
                                    .includes(brandSearch.toLowerCase()),
                              );
                              if (filtered.length === 0) {
                                return (
                                  <div className="text-center py-8 text-sm text-muted-foreground">
                                    {availableBrands.length === 0
                                      ? "All brands have been added."
                                      : "No brands match your search."}
                                  </div>
                                );
                              }
                              return filtered.map((b: any) => (
                                <button
                                  key={b.id}
                                  type="button"
                                  className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm text-left hover:bg-muted/80 transition-colors cursor-pointer"
                                  onClick={() => {
                                    handleAddBrand(b.id);
                                    setBrandModalOpen(false);
                                    setBrandSearch("");
                                  }}
                                >
                                  {b.logo ? (
                                    <Image
                                      src={b.logo}
                                      alt={b.name}
                                      width={32}
                                      height={32}
                                      className="h-8 w-8 rounded-md object-cover border"
                                    />
                                  ) : (
                                    <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                                      {b.name.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <span className="font-medium">{b.name}</span>
                                </button>
                              ));
                            })()}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {brandConfigs.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {brandConfigs.length} brand
                        {brandConfigs.length > 1 ? "s" : ""} configured — one
                        product will be created with all brands attached
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ── 5. Product Details ── */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Product Details</CardTitle>
                  <CardDescription>
                    Additional product information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form.Field name="shortDescription">
                    {(field) => (
                      <Field>
                        <FieldLabel>Short Description</FieldLabel>
                        <Input
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Premium quality rice for daily consumption"
                        />
                      </Field>
                    )}
                  </form.Field>

                  <form.Field name="description">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>
                          Full Description
                        </FieldLabel>
                        <RichTextEditor
                          value={field.state.value}
                          onChange={field.handleChange}
                          placeholder="Describe your product..."
                        />
                      </Field>
                    )}
                  </form.Field>
                </CardContent>
              </Card>

              {/* ── 6. Inventory & Product Rules ── */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">
                      Inventory &amp; Product Rules
                    </CardTitle>
                  </div>
                  <CardDescription>
                    Database-backed stock, return, order, and conversion rules.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {activeRuleSettings.trackingAvailable && (
                      <form.Field name="trackingType">
                        {(field) => (
                          <RuleControlRow
                            description="Choose how this product is tracked in inventory."
                            label="Batch Tracking"
                          >
                            <Select
                              value={field.state.value}
                              onValueChange={(value) =>
                                field.handleChange(value as any)
                              }
                            >
                              <SelectTrigger className="h-9 w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {activeRuleSettings.trackingTypes.map(
                                  (type) => (
                                    <SelectItem key={type} value={type}>
                                      {type === "none"
                                        ? "Disable"
                                        : type === "batch"
                                          ? "Enable"
                                          : "Serial Tracking"}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                          </RuleControlRow>
                        )}
                      </form.Field>
                    )}

                    {activeRuleSettings.returnPolicyAvailable && (
                      <form.Field name="returnPolicyEnabled">
                        {(field) => (
                          <RuleControlRow
                            description="Allow standard product returns."
                            label="Return Policy"
                          >
                            <Switch
                              aria-label="Return Policy"
                              checked={field.state.value}
                              onCheckedChange={field.handleChange}
                            />
                          </RuleControlRow>
                        )}
                      </form.Field>
                    )}

                    {activeRuleSettings.expiryAvailable && (
                      <form.Field name="expiryEnabled">
                        {(field) => (
                          <RuleControlRow
                            description="Track product expiry dates."
                            label="Expiry Tracking"
                          >
                            <Switch
                              aria-label="Expiry Tracking"
                              checked={field.state.value}
                              onCheckedChange={field.handleChange}
                            />
                          </RuleControlRow>
                        )}
                      </form.Field>
                    )}

                    {activeRuleSettings.damageAvailable && (
                      <form.Field name="damageControlEnabled">
                        {(field) => (
                          <RuleControlRow
                            description="Enable damage reporting for this product."
                            label="Damage Control"
                          >
                            <Switch
                              aria-label="Damage Control"
                              checked={field.state.value}
                              onCheckedChange={field.handleChange}
                            />
                          </RuleControlRow>
                        )}
                      </form.Field>
                    )}

                    {activeRuleSettings.stockTrackingAvailable && (
                      <form.Field name="stockTrackingEnabled">
                        {(field) => (
                          <RuleControlRow
                            description="Track inventory movement for this product."
                            label="Stock Tracking"
                          >
                            <Switch
                              aria-label="Stock Tracking"
                              checked={field.state.value}
                              onCheckedChange={field.handleChange}
                            />
                          </RuleControlRow>
                        )}
                      </form.Field>
                    )}

                    {activeRuleSettings.minimumOrderAvailable && (
                      <form.Field name="minimumOrderEnabled">
                        {(enabledField) => (
                          <RuleControlRow
                            description="Apply a minimum order to generated variants."
                            label="Minimum Order Qty"
                          >
                            <div className="flex w-full items-center justify-end gap-3">
                              <Switch
                                aria-label="Minimum Order Qty"
                                checked={enabledField.state.value}
                                onCheckedChange={enabledField.handleChange}
                              />
                              <form.Field name="minimumOrderQty">
                                {(qtyField) => (
                                  <Input
                                    aria-label="Minimum Qty"
                                    className="h-9 flex-1 text-right"
                                    disabled={!enabledField.state.value}
                                    min="0"
                                    onChange={(event) =>
                                      qtyField.handleChange(event.target.value)
                                    }
                                    step="0.01"
                                    type="number"
                                    value={qtyField.state.value}
                                  />
                                )}
                              </form.Field>
                            </div>
                          </RuleControlRow>
                        )}
                      </form.Field>
                    )}

                    {activeRuleSettings.inventoryUnitAvailable && (
                      <form.Field name="inventoryUnit">
                        {(field) => (
                          <RuleControlRow
                            description="Saved to the product and applied to generated variants."
                            label="Inventory Unit"
                          >
                            <Select
                              value={field.state.value}
                              onValueChange={(value) =>
                                field.handleChange(value as FulfillmentUnitCode)
                              }
                            >
                              <SelectTrigger className="h-9 w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {inventoryUnitOptions.map((unit) => (
                                  <SelectItem
                                    key={unit.value}
                                    value={unit.value}
                                  >
                                    {unit.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </RuleControlRow>
                        )}
                      </form.Field>
                    )}

                    {activeRuleSettings.conversionAvailable && (
                      <form.Field name="conversionEnabled">
                        {(field) => (
                          <RuleControlRow
                            description={conversionDescription}
                            label="Conversion"
                          >
                            <Switch
                              aria-label="Conversion"
                              checked={field.state.value}
                              onCheckedChange={field.handleChange}
                            />
                          </RuleControlRow>
                        )}
                      </form.Field>
                    )}

                    {supportsLooseInventory && (
                      <form.Field name="inventoryLooseUnitEnabled">
                        {(enabledField) => (
                          <RuleControlRow
                            description="Enable loose inventory for weight or volume based sales."
                            label="Inventory Loose Unit"
                          >
                            <div className="flex w-full items-center justify-end gap-3">
                              <Switch
                                aria-label="Inventory Loose Unit"
                                checked={enabledField.state.value}
                                onCheckedChange={enabledField.handleChange}
                              />
                              <form.Field name="inventoryLooseUnit">
                                {(unitField) => (
                                  <Select
                                    disabled={!enabledField.state.value}
                                    value={unitField.state.value}
                                    onValueChange={(value) =>
                                      unitField.handleChange(
                                        value as FulfillmentUnitCode,
                                      )
                                    }
                                  >
                                    <SelectTrigger className="h-9 flex-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {looseUnitOptions.map((unit) => (
                                        <SelectItem
                                          key={unit.value}
                                          value={unit.value}
                                        >
                                          {unit.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </form.Field>
                            </div>
                          </RuleControlRow>
                        )}
                      </form.Field>
                    )}

                    {activeRuleSettings.returnablePackAvailable && (
                      <form.Field name="isReturnablePack">
                        {(returnableField) => (
                          <RuleControlRow
                            description={returnableRuleDescription}
                            label={returnableRuleLabel}
                          >
                            <div className="flex w-full items-center justify-end gap-3">
                              <Switch
                                aria-label={returnableRuleLabel}
                                checked={returnableField.state.value}
                                onCheckedChange={returnableField.handleChange}
                              />
                              <form.Field name="defaultPackDepositAmount">
                                {(depositField) => (
                                  <Input
                                    aria-label={depositLabel}
                                    className="h-9 flex-1 text-right"
                                    disabled={!returnableField.state.value}
                                    min="0"
                                    onChange={(event) =>
                                      depositField.handleChange(
                                        event.target.value,
                                      )
                                    }
                                    step="0.01"
                                    type="number"
                                    value={depositField.state.value}
                                  />
                                )}
                              </form.Field>
                            </div>
                          </RuleControlRow>
                        )}
                      </form.Field>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* ── 7. Features ── */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Product Features</CardTitle>
                  <CardDescription>
                    Add feature groups with key-value pairs (e.g.,
                    Specifications: Weight - 500g)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form.Field name="features">
                    {(field) => (
                      <ProductFeaturesInput
                        value={field.state.value}
                        onChange={field.handleChange}
                      />
                    )}
                  </form.Field>
                </CardContent>
              </Card>

              {/* ── 8. Media ── */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">Media</CardTitle>
                  </div>
                  <CardDescription>Product images and media</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <form.Field name="image">
                      {(field) => {
                        const isInvalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel>Thumbnail / Main Image</FieldLabel>
                            <ImageUploader
                              value={field.state.value}
                              onChange={field.handleChange}
                              folder="products"
                              maxSizeMB={5}
                            />
                            {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                            )}
                          </Field>
                        );
                      }}
                    </form.Field>

                    <form.Field name="additionalImages">
                      {(field) => (
                        <Field>
                          <FieldLabel>Gallery</FieldLabel>
                          <AdditionalImagesUploader
                            value={field.state.value}
                            onChange={field.handleChange}
                            folder="products/additional"
                            maxSizeMB={5}
                          />
                        </Field>
                      )}
                    </form.Field>
                  </div>

                  <form.Field name="videoUrl">
                    {(field) => (
                      <Field>
                        <FieldLabel>Video URL (optional)</FieldLabel>
                        <Input
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="https://youtube.com/watch?v=..."
                        />
                      </Field>
                    )}
                  </form.Field>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Right Column (1/3 width) */}
            <div className="space-y-6">
              {/* Visibility */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Visibility</CardTitle>
                </CardHeader>
                <CardContent>
                  <form.Field name="visibility">
                    {(field) => (
                      <div className="space-y-2">
                        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                          <input
                            type="radio"
                            name="visibility"
                            value="public"
                            checked={field.state.value === "public"}
                            onChange={() => field.handleChange("public")}
                            className="accent-primary"
                          />
                          <div>
                            <p className="text-sm font-medium">Public</p>
                            <p className="text-xs text-muted-foreground">
                              Visible to all customers
                            </p>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                          <input
                            type="radio"
                            name="visibility"
                            value="private"
                            checked={field.state.value === "private"}
                            onChange={() => field.handleChange("private")}
                            className="accent-primary"
                          />
                          <div>
                            <p className="text-sm font-medium">Private</p>
                            <p className="text-xs text-muted-foreground">
                              Only visible to admins
                            </p>
                          </div>
                        </label>
                      </div>
                    )}
                  </form.Field>
                </CardContent>
              </Card>

              {/* Status Controls */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">Status</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form.Field name="isFeatured">
                    {(field) => (
                      <div className="flex items-center justify-between">
                        <div>
                          <FieldLabel className="text-sm font-medium">
                            Featured
                          </FieldLabel>
                          <p className="text-xs text-muted-foreground">
                            Show in featured section
                          </p>
                        </div>
                        <Switch
                          checked={field.state.value}
                          onCheckedChange={field.handleChange}
                        />
                      </div>
                    )}
                  </form.Field>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// Helper: default variant settings
// ============================================================

function makeDefaultSettings(
  variantOptionId: number,
  brandId: number | null,
): VariantPriceSettings {
  return {
    variantOptionId,
    brandId,
    consumerPrice: "",
  };
}

function getAvailableVariantsForCoreProduct(
  coreProduct: any,
  variantOptions: any[] = [],
) {
  if (!coreProduct) return variantOptions;

  const typeId = coreProduct.category?.typeId ?? null;
  const categoryId = coreProduct.categoryId ?? null;

  return variantOptions
    .filter((variant) => {
      const isGlobal = variant.typeId == null && variant.categoryId == null;
      const isTypeWide =
        variant.typeId === typeId && variant.categoryId == null;
      const isCategoryScoped =
        variant.typeId === typeId && variant.categoryId === categoryId;

      return isGlobal || isTypeWide || isCategoryScoped;
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function RuleControlRow({
  children,
  description,
  label,
}: {
  children: ReactNode;
  description: string;
  label: string;
}) {
  return (
    <div className="grid min-h-14 grid-cols-1 items-center gap-3 rounded-md border bg-background px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 items-center gap-2">
        <FieldLabel className="text-sm font-medium">{label}</FieldLabel>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label={`${label} details`}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              type="button"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-64 text-xs" side="top">
            {description}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex min-w-0 justify-start sm:w-[190px] sm:justify-end">
        {children}
      </div>
    </div>
  );
}

function ReadOnlyIdentityField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

// ============================================================
// Brand Config Card — collapsible per-brand variant config
// ============================================================

function BrandConfigCard({
  config,
  variantOptions,
  isExpanded,
  onToggleExpand,
  onRemove,
  onToggleVariant,
  onUpdateField,
}: {
  config: BrandConfig;
  variantOptions: any[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRemove: () => void;
  onToggleVariant: (variantOptionId: number, variantOption: any) => void;
  onUpdateField: (
    variantOptionId: number,
    field: keyof VariantPriceSettings,
    value: any,
  ) => void;
}) {
  return (
    <div className="space-y-3">
      {/* Brand header — flat row */}
      <div
        className="flex items-center gap-3 cursor-pointer group"
        onClick={onToggleExpand}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="font-semibold text-sm">{config.brandName}</span>
        <Badge variant="outline" className="text-[10px] font-normal">
          {config.selectedVariantIds.length} variant
          {config.selectedVariantIds.length !== 1 ? "s" : ""}
        </Badge>
        <div className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive/60 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="pl-7 space-y-3">
          {/* Variant selection + pricing — unified list */}
          <div className="space-y-1.5">
            {variantOptions.length === 0 ? (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                No variant options are available for this core identity.
              </div>
            ) : (
              variantOptions.map((v: any) => {
                const isIncluded = config.selectedVariantIds.includes(v.id);
                const settings = isIncluded
                  ? (config.variantSettings[v.id] ??
                    makeDefaultSettings(v.id, config.brandId))
                  : null;

                return (
                  <div
                    key={v.id}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
                      isIncluded ? "bg-muted/50" : "hover:bg-muted/30"
                    }`}
                  >
                    <Checkbox
                      checked={isIncluded}
                      onCheckedChange={() => onToggleVariant(v.id, v)}
                    />
                    <span
                      className={`text-sm flex-1 min-w-0 ${isIncluded ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {v.name}
                      {v.size && (
                        <span className="text-muted-foreground ml-1">
                          · {v.size} {v.unit}
                        </span>
                      )}
                    </span>
                    {isIncluded && settings && (
                      <div className="relative w-24 shrink-0">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                          ৳
                        </span>
                        <Input
                          className="h-7 text-sm pl-6 pr-2 text-right"
                          type="number"
                          step="0.01"
                          value={settings.consumerPrice}
                          onChange={(e) =>
                            onUpdateField(v.id, "consumerPrice", e.target.value)
                          }
                          placeholder="0"
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <Separator />
    </div>
  );
}
