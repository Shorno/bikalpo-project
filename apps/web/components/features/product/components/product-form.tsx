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
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Loader,
  Plus,
  Search,
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
import { Button } from "@/components/ui/button";
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
import DeleteProductDialog from "./delete-product-dialog";
import type { ProductWithRelations } from "./product-columns";
import {
  ProductEditorSection as FormSection,
  ProductEditorIdentity as IdentitySummaryRow,
} from "./product-editor-ui";
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

/** A saved brand configuration with its selected variant options */
type BrandConfig = {
  brandId: number;
  brandName: string;
  brandLogo?: string | null;
  /** Which variant option IDs are included for this brand */
  selectedVariantIds: number[];
  /**
   * Per-variant settings keyed by variantOptionId. Pricing is NOT edited in
   * this form (it lives in the product-price space), but we keep any existing
   * consumerPrice here so re-saving the product round-trips it instead of
   * wiping prices already set elsewhere.
   */
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
  structureLocked?: boolean;
}

export default function ProductForm({
  mode,
  product,
  initialCoreProductId = null,
  structureLocked = false,
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
  const isStructureLocked =
    structureLocked && isEdit && selectedCoreProductId !== null;
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
          vp.isActive !== false &&
          ((vp.brandId ?? null) === pb.brandId ||
            (!vp.brandId && pbs.length === 1)),
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
        brandLogo: pb.brand?.logo ?? null,
        selectedVariantIds,
        variantSettings,
      });
    }
    return configs;
  });

  // Currently-editing brand (for the inline config panel)
  const [activeBrandId, setActiveBrandId] = useState<number | null>(null);
  // Brands are expanded by default; this tracks the ones the user collapsed.
  const [collapsedBrandIds, setCollapsedBrandIds] = useState<Set<number>>(
    () => new Set(),
  );

  const toggleBrandExpanded = (brandId: number) => {
    setCollapsedBrandIds((prev) => {
      const next = new Set(prev);
      if (next.has(brandId)) {
        next.delete(brandId);
      } else {
        next.add(brandId);
      }
      return next;
    });
  };

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
  const selectableCoreProducts = coreProducts.filter(
    (coreProduct: any) => !coreProduct.hasConfiguration,
  );

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
      if (brandConfigs.length === 0) {
        toast.error("Add at least one brand");
        return;
      }
      if (
        brandConfigs.some((config) => config.selectedVariantIds.length === 0)
      ) {
        toast.error("Select at least one variant for every brand");
        return;
      }

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
        coreProductId: isStructureLocked ? undefined : selectedCoreProductId,
        brandIds: isStructureLocked
          ? undefined
          : brandIds.length > 0
            ? brandIds
            : undefined,
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
      !isEdit &&
      isCoreIdentityLocked &&
      lockedCoreProduct?.hasConfiguration
    ) {
      router.replace(
        `/dashboard/admin/products/core/${lockedCoreProduct.id}/edit`,
      );
    }
  }, [isCoreIdentityLocked, isEdit, lockedCoreProduct, router]);

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
      brandLogo: brand.logo ?? null,
      selectedVariantIds: [],
      variantSettings: {},
    };

    setBrandConfigs((prev) => [...prev, newConfig]);
    setActiveBrandId(brandId);
    // New brands start expanded — make sure they aren't in the collapsed set.
    setCollapsedBrandIds((prev) => {
      if (!prev.has(brandId)) return prev;
      const next = new Set(prev);
      next.delete(brandId);
      return next;
    });
  };

  // Remove a brand configuration
  const handleRemoveBrand = (brandId: number) => {
    setBrandConfigs((prev) => prev.filter((bc) => bc.brandId !== brandId));
    if (activeBrandId === brandId) setActiveBrandId(null);
    setCollapsedBrandIds((prev) => {
      if (!prev.has(brandId)) return prev;
      const next = new Set(prev);
      next.delete(brandId);
      return next;
    });
  };

  // Toggle variant inclusion for a brand
  const handleToggleVariant = (brandId: number, variantOptionId: number) => {
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

  // Select-all / clear all variants for a brand at once
  const handleSetVariants = (brandId: number, variantOptionIds: number[]) => {
    setBrandConfigs((prev) =>
      prev.map((bc) => {
        if (bc.brandId !== brandId) return bc;
        const variantSettings: Record<number, VariantPriceSettings> = {};
        for (const voId of variantOptionIds) {
          variantSettings[voId] =
            bc.variantSettings[voId] ?? makeDefaultSettings(voId, brandId);
        }
        return {
          ...bc,
          selectedVariantIds: variantOptionIds,
          variantSettings,
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
    ? "Empty cylinder exchange"
    : "Empty pack return";
  const returnableRuleDescription = isLpgRules
    ? "Require empty cylinder exchange for refill-style sales"
    : "Require returnable packaging such as jars, drums, or packs";
  const depositLabel = isLpgRules
    ? "Exchange Value (BDT)"
    : "Deposit Amount (BDT)";
  const conversionDescription =
    "Enable unit conversion for products that need pack-to-loose or carton-to-pack handling.";

  const identityDescription = isEdit
    ? "The core product this listing is based on."
    : isCoreIdentityLocked
      ? "This product is based on the selected core identity."
      : selectedCoreProductId
        ? "The core product this listing is based on."
        : "Choose the core product this listing is based on.";

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Command bar */}
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
            >
              <Link href="/dashboard/admin/products">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                Products <span className="opacity-50">/</span>{" "}
                {isEdit ? "Edit product" : "New product"}
              </p>
              <div className="flex items-center gap-2">
                <form.Subscribe selector={(state) => state.values.name}>
                  {(name) => (
                    <h1 className="truncate text-base font-semibold leading-tight">
                      {name || (isEdit ? product?.name : "New product")}
                    </h1>
                  )}
                </form.Subscribe>
                <form.Subscribe selector={(state) => state.values.status}>
                  {(status) => <StatusPill status={status} />}
                </form.Subscribe>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isEdit && product?.id ? (
              <DeleteProductDialog
                productId={product.id}
                productName={product.name}
                force
                compact
                onSuccess={() => router.push("/dashboard/admin/products")}
              />
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard/admin/products")}
              disabled={isPending}
            >
              Discard
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                form.setFieldValue("status", "draft");
                form.handleSubmit();
              }}
              disabled={isPending}
            >
              Save draft
            </Button>
            <Button
              size="sm"
              onClick={() => form.handleSubmit()}
              disabled={isPending}
            >
              {isPending && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Publish"}
            </Button>
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
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
            {/* Console panel */}
            <div className="divide-y rounded-xl border bg-card">
              {/* ── Identity ── */}
              <FormSection title="Identity" description={identityDescription}>
                <div className="space-y-4">
                  {isEdit ? (
                    <IdentitySummaryRow
                      image={product?.image}
                      name={product?.name ?? "Product"}
                      meta={[
                        activeTypeName,
                        product?.category?.name,
                        (product as any)?.subCategory?.name,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                  ) : isCoreIdentityLocked ? (
                    isLoadingLockedCoreProduct ? (
                      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                        <Loader className="h-4 w-4 animate-spin" />
                        Loading core identity...
                      </div>
                    ) : activeCoreProduct ? (
                      <IdentitySummaryRow
                        image={activeCoreProduct.image}
                        name={activeCoreProduct.name}
                        meta={[
                          activeTypeName,
                          activeCoreProduct.category?.name,
                          activeCoreProduct.subCategory?.name,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      />
                    ) : (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                        Core identity could not be loaded.
                      </div>
                    )
                  ) : selectedCoreProductId ? (
                    <IdentitySummaryRow
                      image={activeCoreProduct?.image}
                      name={activeCoreProduct?.name ?? "Core identity"}
                      meta={[
                        activeTypeName,
                        activeCoreProduct?.category?.name,
                        activeCoreProduct?.subCategory?.name,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      action={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0"
                          onClick={() => {
                            setSelectedCoreProductId(null);
                            form.setFieldValue("coreProductId", null);
                          }}
                        >
                          Change
                        </Button>
                      }
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                            <SelectItem value="all">All types</SelectItem>
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

                      {/* Sub category */}
                      <Field>
                        <FieldLabel>Sub category</FieldLabel>
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

                      {/* Core identity */}
                      <Field>
                        <FieldLabel>Core identity *</FieldLabel>
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
                            {selectableCoreProducts.map((cp: any) => (
                              <SelectItem key={cp.id} value={String(cp.id)}>
                                {cp.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  )}

                  {(selectedCoreProductId || isEdit) && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <form.Field name="name">
                        {(field) => (
                          <Field>
                            <FieldLabel>Display name *</FieldLabel>
                            <Input
                              value={field.state.value}
                              onChange={(e) => {
                                field.handleChange(e.target.value);
                                autoGenerateSlugFromName(e.target.value);
                              }}
                              placeholder="Enter product display name"
                            />
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
                  )}
                </div>
              </FormSection>

              {/* ── Brands and variants ── */}
              {(selectedCoreProductId || isEdit) &&
                (isStructureLocked ? (
                  <FormSection
                    title="Brand and variants"
                    description="The brand is fixed for this generated product. Prices are managed in Product Price."
                  >
                    {brandConfigs.map((bc) => (
                      <BrandConfigCard
                        key={bc.brandId}
                        config={bc}
                        variantOptions={availableVariantOptions}
                        isExpanded={!collapsedBrandIds.has(bc.brandId)}
                        onToggleExpand={() => toggleBrandExpanded(bc.brandId)}
                        onRemove={() => undefined}
                        onToggleVariant={(voId) =>
                          handleToggleVariant(bc.brandId, voId)
                        }
                        onSetVariants={(voIds) =>
                          handleSetVariants(bc.brandId, voIds)
                        }
                        canRemove={false}
                      />
                    ))}
                  </FormSection>
                ) : (
                  <FormSection
                    title="Brands and variants"
                    description="Pick the variants each brand offers. Prices are managed in Product Price."
                  >
                    <div className="space-y-3">
                      {brandConfigs.map((bc) => (
                        <BrandConfigCard
                          key={bc.brandId}
                          config={bc}
                          variantOptions={availableVariantOptions}
                          isExpanded={!collapsedBrandIds.has(bc.brandId)}
                          onToggleExpand={() => toggleBrandExpanded(bc.brandId)}
                          onRemove={() => handleRemoveBrand(bc.brandId)}
                          onToggleVariant={(voId) =>
                            handleToggleVariant(bc.brandId, voId)
                          }
                          onSetVariants={(voIds) =>
                            handleSetVariants(bc.brandId, voIds)
                          }
                        />
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-center gap-2 border-dashed text-muted-foreground"
                        onClick={() => {
                          setBrandSearch("");
                          setBrandModalOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Add a brand
                      </Button>

                      {brandConfigs.length === 0 && (
                        <p className="text-center text-xs text-muted-foreground">
                          Add a brand to start configuring variants.
                        </p>
                      )}
                    </div>

                    <Dialog
                      open={brandModalOpen}
                      onOpenChange={setBrandModalOpen}
                    >
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Select brand</DialogTitle>
                          <DialogDescription>
                            Search and select a brand to add to this product.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
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
                  </FormSection>
                ))}

              {/* ── Description ── */}
              {(selectedCoreProductId || isEdit) && (
                <FormSection
                  title="Description"
                  description="How this product appears to customers."
                >
                  <div className="space-y-4">
                    <form.Field name="shortDescription">
                      {(field) => (
                        <Field>
                          <FieldLabel>Short description</FieldLabel>
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
                            Full description
                          </FieldLabel>
                          <RichTextEditor
                            value={field.state.value}
                            onChange={field.handleChange}
                            placeholder="Describe your product..."
                          />
                        </Field>
                      )}
                    </form.Field>
                  </div>
                </FormSection>
              )}

              {/* ── Inventory rules ── */}
              <FormSection
                title="Inventory rules"
                description="Stock, return, order, and conversion behavior."
              >
                <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                  {activeRuleSettings.trackingAvailable && (
                    <form.Field name="trackingType">
                      {(field) => (
                        <RuleControlRow
                          description="Choose how this product is tracked in inventory."
                          label="Batch tracking"
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
                              {activeRuleSettings.trackingTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type === "none"
                                    ? "Disable"
                                    : type === "batch"
                                      ? "Enable"
                                      : "Serial tracking"}
                                </SelectItem>
                              ))}
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
                          label="Return policy"
                        >
                          <Switch
                            aria-label="Return policy"
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
                          label="Expiry tracking"
                        >
                          <Switch
                            aria-label="Expiry tracking"
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
                          label="Damage control"
                        >
                          <Switch
                            aria-label="Damage control"
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
                          label="Stock tracking"
                        >
                          <Switch
                            aria-label="Stock tracking"
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
                          label="Minimum order qty"
                        >
                          <div className="flex w-full items-center justify-end gap-3">
                            <Switch
                              aria-label="Minimum order qty"
                              checked={enabledField.state.value}
                              onCheckedChange={enabledField.handleChange}
                            />
                            <form.Field name="minimumOrderQty">
                              {(qtyField) => (
                                <Input
                                  aria-label="Minimum qty"
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
                          label="Inventory unit"
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
                                <SelectItem key={unit.value} value={unit.value}>
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
                          label="Inventory loose unit"
                        >
                          <div className="flex w-full items-center justify-end gap-3">
                            <Switch
                              aria-label="Inventory loose unit"
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
              </FormSection>

              {/* ── Features ── */}
              <FormSection
                title="Features"
                description="Grouped key-value specifications (e.g. Weight — 500g)."
              >
                <form.Field name="features">
                  {(field) => (
                    <ProductFeaturesInput
                      value={field.state.value}
                      onChange={field.handleChange}
                    />
                  )}
                </form.Field>
              </FormSection>

              {/* ── Media ── */}
              <FormSection
                title="Media"
                description="Images and video for this product."
              >
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <form.Field name="image">
                      {(field) => {
                        const isInvalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel>Thumbnail / main image</FieldLabel>
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
                        <FieldLabel>Video URL</FieldLabel>
                        <Input
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="https://youtube.com/watch?v=..."
                        />
                      </Field>
                    )}
                  </form.Field>
                </div>
              </FormSection>
            </div>

            {/* Sidebar */}
            <div className="space-y-4 lg:sticky lg:top-[72px]">
              <div className="rounded-xl border bg-card">
                <div className="border-b px-4 py-3">
                  <h3 className="text-sm font-semibold">Publish</h3>
                </div>
                <div className="space-y-4 p-4">
                  <form.Field name="status">
                    {(field) => (
                      <div className="space-y-1.5">
                        <FieldLabel className="text-xs text-muted-foreground">
                          Status
                        </FieldLabel>
                        <Select
                          value={field.state.value}
                          onValueChange={(v) => field.handleChange(v as any)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="visibility">
                    {(field) => (
                      <div className="space-y-1.5">
                        <FieldLabel className="text-xs text-muted-foreground">
                          Visibility
                        </FieldLabel>
                        <Select
                          value={field.state.value}
                          onValueChange={(v) => field.handleChange(v as any)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="public">Public</SelectItem>
                            <SelectItem value="private">Private</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {field.state.value === "public"
                            ? "Visible to all customers"
                            : "Only visible to admins"}
                        </p>
                      </div>
                    )}
                  </form.Field>

                  <Separator />

                  <form.Field name="isFeatured">
                    {(field) => (
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Featured</p>
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
                </div>
              </div>
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
    consumerPrice: "0",
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

// ============================================================
// Presentational helpers
// ============================================================

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    inactive: "bg-muted text-muted-foreground",
    draft: "bg-amber-500/10 text-amber-600 dark:text-amber-500",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
        styles[status] ?? styles.inactive
      }`}
    >
      {status}
    </span>
  );
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
    <div className="flex min-h-[52px] items-center justify-between gap-4 border-t py-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <FieldLabel className="text-sm font-normal">{label}</FieldLabel>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label={`${label} details`}
              className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
      <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
        {children}
      </div>
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
  onSetVariants,
  canRemove = true,
}: {
  config: BrandConfig;
  variantOptions: any[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRemove: () => void;
  onToggleVariant: (variantOptionId: number) => void;
  onSetVariants: (variantOptionIds: number[]) => void;
  canRemove?: boolean;
}) {
  const selectedCount = config.selectedVariantIds.length;
  const totalCount = variantOptions.length;
  const allSelected = totalCount > 0 && selectedCount === totalCount;

  return (
    <div className="rounded-lg border bg-card">
      {/* Brand header */}
      <div className="group flex items-center gap-3 p-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={onToggleExpand}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          {config.brandLogo ? (
            <Image
              src={config.brandLogo}
              alt={config.brandName}
              width={32}
              height={32}
              className="h-8 w-8 rounded-md border object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
              {config.brandName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{config.brandName}</p>
            <p className="text-xs text-muted-foreground">
              {selectedCount > 0
                ? `${selectedCount} variant${selectedCount !== 1 ? "s" : ""} selected`
                : "No variants selected yet"}
            </p>
          </div>
        </button>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive/60 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onRemove}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Expanded content — variant chips */}
      {isExpanded && (
        <>
          <Separator />
          <div className="space-y-3 p-3">
            {totalCount === 0 ? (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                No variant options are available for this core identity.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Tap a variant to include it for this brand
                  </span>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() =>
                      onSetVariants(
                        allSelected ? [] : variantOptions.map((v: any) => v.id),
                      )
                    }
                  >
                    {allSelected ? "Clear all" : "Select all"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {variantOptions.map((v: any) => {
                    const isIncluded = config.selectedVariantIds.includes(v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => onToggleVariant(v.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                          isIncluded
                            ? "border-primary bg-primary/10 font-medium text-primary"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {isIncluded && <Check className="h-3.5 w-3.5" />}
                        <span>
                          {v.name}
                          {v.size && (
                            <span className="ml-1 opacity-70">
                              · {v.size}
                              {v.unit ? ` ${v.unit}` : ""}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
