"use client";

import {
  type FulfillmentUnitCode,
  inferProductTypeFamily,
  type ProductTypeFulfillmentProfile,
} from "@bikalpo-project/db/fulfillment";
import {
  DELIVERY_COST_METHODS,
  type DeliveryCostMethod,
  deliveryMethodFromUnit,
  type InventoryUnitCode,
  isDeliveryCostMethod,
} from "@bikalpo-project/db/product-client-options";
import { suggestDeliveryCostUnit } from "@bikalpo-project/db/product-delivery";
import type { VariantProductFamily } from "@bikalpo-project/db/variant-definition";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Info,
  Loader,
  Loader2,
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import RichTextEditor from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
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
import { orpc } from "@/utils/orpc";
import {
  AddVariantDialog,
  type NewVariantDefinition,
} from "./add-variant-dialog";
import DeleteProductDialog from "./delete-product-dialog";
import { LpgVariantPricing, LpgVariantTable } from "./lpg-variant-table";
import {
  cylinderKgOf,
  DEFAULT_LPG_TYPE_OPTIONS,
  emptyVariantTableRows,
  rowsFromSizeSaleTypes,
  salePriceError,
  salePriceKey,
  type SizeSaleTypes,
  sizeSaleTypes,
  parseSizeList,
  type VariantTableRow,
} from "./lpg-variant-table-model";
import {
  exchangeCreditFrom,
  exchangePriceFrom,
  FinalActions,
  firstPricingError,
  type PricingRow,
  type PricingValue,
  ProductPricingTable,
  priceInputValue,
  resolveDeliveryUnit,
} from "./product-delivery-pricing";
import {
  type ClientRuleValues,
  ClientRulesGrid,
  DeliveryMethodSelect,
  EMPTY_VARIANT_FILTER,
  FeaturedCheckbox,
  filterVariantsForBrand,
  VISIBILITY_HELP,
} from "./product-rules-grid";
import type { ProductWithRelations } from "./product-columns";
import {
  ProductEditorSection as FormSection,
  ProductEditorIdentity as IdentitySummaryRow,
} from "./product-editor-ui";

// ============================================================
// Types
// ============================================================

export type VariantPriceSettings = {
  variantOptionId: number;
  brandId?: number | null;
  consumerPrice: string;
  exchangeEnabled: boolean;
  exchangeCreditAmount: string;
  /** Exchange price typed in Pricing; the credit is New minus Exchange. */
  exchangePrice?: string;
};

/** A saved brand configuration with its selected variant options */
type BrandConfig = {
  brandId: number;
  brandName: string;
  brandLogo?: string | null;
  /** Which variant option IDs are included for this brand */
  selectedVariantIds: number[];
  /**
   * Per-variant settings keyed by variantOptionId. The optional Pricing
   * section edits consumerPrice (New) and exchangePrice; saved prices load
   * here so re-saving the product keeps them.
   */
  variantSettings: Record<number, VariantPriceSettings>;
};

type SearchCreateOption = {
  id: number;
  name: string;
};

/**
 * Pick from a list or type a new name: when nothing matches, an
 * "Add …" row creates it. Used for Sub category and Core identity.
 */
function SearchCreateCombobox({
  noun,
  options,
  selected,
  disabled,
  disabledLabel,
  creating = false,
  clearLabel,
  onSelect,
  onCreate,
  onClear,
}: {
  noun: string;
  options: SearchCreateOption[];
  selected?: SearchCreateOption;
  disabled: boolean;
  disabledLabel: string;
  creating?: boolean;
  /** Shown as the first row when something is selected and it can be unset. */
  clearLabel?: string;
  onSelect: (id: number) => void;
  onCreate: (name: string) => boolean | Promise<boolean>;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const search = query.trim();
  const matches = options.filter((option) =>
    option.name.toLowerCase().includes(search.toLowerCase()),
  );
  const canCreate =
    !creating &&
    search.length >= 2 &&
    matches.length === 0 &&
    !options.some(
      (option) => option.name.toLowerCase() === search.toLowerCase(),
    );

  const close = () => {
    setQuery("");
    setOpen(false);
  };

  const choose = (id: number) => {
    onSelect(id);
    close();
  };

  const create = async () => {
    if (!canCreate) return;
    const created = await onCreate(search);
    if (created) close();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={`Select or add a ${noun}`}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span
            className={selected ? "truncate" : "truncate text-muted-foreground"}
          >
            {selected?.name ?? (disabled ? disabledLabel : `Search ${noun}`)}
          </span>
          {creating ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={`Search or add a ${noun}`}
            value={query}
            onValueChange={setQuery}
            maxLength={100}
          />
          <CommandList>
            <CommandEmpty>
              {search.length < 2
                ? `Type at least 2 characters to add a new ${noun}.`
                : `No ${noun} found.`}
            </CommandEmpty>
            <CommandGroup>
              {selected && onClear && clearLabel && !search && (
                <CommandItem
                  value="clear-selection"
                  className="text-muted-foreground"
                  onSelect={() => {
                    onClear();
                    close();
                  }}
                >
                  {clearLabel}
                </CommandItem>
              )}
              {matches.map((option) => (
                <CommandItem
                  key={option.id}
                  value={String(option.id)}
                  data-checked={option.id === selected?.id}
                  onSelect={() => choose(option.id)}
                >
                  <span className="truncate">{option.name}</span>
                </CommandItem>
              ))}
              {canCreate && (
                <CommandItem
                  value={`create-${search}`}
                  onSelect={() => void create()}
                  className="text-primary"
                >
                  <Plus className="size-4" />
                  <span className="truncate">
                    Add &ldquo;{search}&rdquo; as a new {noun}
                  </span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

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
    trackingType:
      normalized.expiryAvailable && normalized.expiryDefault
        ? "batch"
        : normalized.trackingAvailable
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
  backHref?: string;
  editAdapter?: {
    backHref: string;
    coreProduct: any;
    variantOptions: any[];
    productType?: any;
    onUpdate: (payload: any) => Promise<unknown>;
    onUpdated?: () => void | Promise<void>;
    publishOnSave?: boolean;
    /** LPG products use the Variant Table (retailer and wholesaler Edit). */
    lpgVariantTable?: boolean;
    /** Sets up a size the Variant Table needs (store-only for sellers). */
    onCreateVariant?: (definition: any) => Promise<any>;
  };
}

export default function ProductForm({
  mode,
  product,
  initialCoreProductId = null,
  structureLocked = false,
  backHref,
  editAdapter,
}: ProductFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEdit = mode === "edit";
  const listHref =
    editAdapter?.backHref ?? backHref ?? "/dashboard/admin/products";
  const usesExternalEditAdapter = Boolean(editAdapter && isEdit);
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
  const [newCoreProductName, setNewCoreProductName] = useState<string | null>(
    null,
  );
  const isStructureLocked =
    structureLocked && isEdit && selectedCoreProductId !== null;
  const [initializedCoreProductId, setInitializedCoreProductId] = useState<
    number | null
  >(null);
  const [ruleDefaultsAppliedTypeId, setRuleDefaultsAppliedTypeId] = useState<
    number | null
  >(null);
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  // Brands/variants created inline show at once, before the lists refetch.
  const [createdBrands, setCreatedBrands] = useState<any[]>([]);
  const [createdVariants, setCreatedVariants] = useState<any[]>([]);
  const [creatingBrand, setCreatingBrand] = useState(false);
  // Sub categories added from the Sub category search show at once.
  const [createdSubcategories, setCreatedSubcategories] = useState<any[]>([]);
  const [creatingSubcategory, setCreatingSubcategory] = useState(false);
  const [pickedCoreProduct, setPickedCoreProduct] = useState<any>(null);
  const [variantDialogBrandId, setVariantDialogBrandId] = useState<
    number | null
  >(null);
  // Inventory & Product Rules: the client's "Variant Attribute" choices.
  const attributesQuery = useQuery(orpc.variantAttribute.list.queryOptions());
  const variantAttributes = (attributesQuery.data ?? []) as Array<{
    name: string;
  }>;
  // Products saved before the client's fields get its defaults once.
  const [clientDefaultsFamily, setClientDefaultsFamily] = useState<
    string | null
  >(null);

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
          ((product as any)?.status === "inactive" || vp.isActive !== false) &&
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
          consumerPrice: priceInputValue(vp.consumerPrice),
          exchangeEnabled: vp.exchangeEnabled ?? false,
          exchangeCreditAmount: String(vp.exchangeCreditAmount ?? "0"),
          exchangePrice: vp.exchangeEnabled
            ? exchangePriceFrom(vp.consumerPrice, vp.exchangeCreditAmount)
            : "",
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

  // LPG Variant Table rows and Type prices; Edit rebuilds them from the
  // saved sizes.
  const [lpgRows, setLpgRows] = useState<VariantTableRow[]>(() =>
    initialLpgTable(product).rows,
  );
  const [lpgPrices, setLpgPrices] = useState<Record<string, string>>(() =>
    initialLpgTable(product).prices,
  );

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
  const { data: typesData } = useQuery({
    ...orpc.adminProductType.getAll.queryOptions({ input: {} }),
    enabled: !usesExternalEditAdapter,
  });
  const productTypes = editAdapter?.productType
    ? [editAdapter.productType]
    : (typesData?.types ?? []);

  const { data: categoriesData } = useQuery({
    ...orpc.category.getAll.queryOptions(),
    enabled: !usesExternalEditAdapter,
  });
  const allCategories = Array.isArray(categoriesData) ? categoriesData : [];

  const { data: subcategoriesData } = useQuery({
    ...orpc.adminSubcategory.getAllGlobal.queryOptions(),
    enabled: !usesExternalEditAdapter,
  });
  const loadedSubcategories = Array.isArray(subcategoriesData)
    ? subcategoriesData
    : [];
  const allSubcategories = [
    ...loadedSubcategories,
    ...createdSubcategories.filter(
      (created) =>
        !loadedSubcategories.some((loaded: any) => loaded.id === created.id),
    ),
  ];

  // Core products filtered by category
  const coreProductsQuery = useQuery({
    ...orpc.adminCoreProduct.getAll.queryOptions({
      input: {
        categoryId: selectedCategory ?? undefined,
        subCategoryId: selectedSubCategoryId ?? undefined,
      },
    }),
    enabled: !usesExternalEditAdapter,
  });
  const coreProductsData = coreProductsQuery.data;
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
    enabled: !usesExternalEditAdapter,
  });

  // ALL brands (global, unrestricted)
  const { data: allBrandsData } = useQuery({
    ...orpc.brand.getAll.queryOptions(),
    enabled: !usesExternalEditAdapter,
  });
  const loadedBrands = editAdapter
    ? ((product as any)?.productBrands ?? []).map((row: any) => row.brand)
    : Array.isArray(allBrandsData)
      ? allBrandsData
      : [];
  const allBrands = [
    ...loadedBrands,
    ...createdBrands.filter(
      (created) => !loadedBrands.some((brand: any) => brand.id === created.id),
    ),
  ];

  // Derived: selected core product details
  // Picking a core identity also sets its sub category, which reloads the
  // list; the picked row stands in until the reloaded list arrives.
  const selectedCoreProduct =
    coreProducts.find((cp: any) => cp.id === selectedCoreProductId) ??
    (pickedCoreProduct?.id === selectedCoreProductId
      ? pickedCoreProduct
      : undefined);
  const lockedCoreProduct =
    editAdapter?.coreProduct ?? lockedCoreProductQuery.data?.coreProduct;
  const draftCoreCategory = allCategories.find(
    (category: any) => category.id === selectedCategory,
  );
  const draftCoreProduct =
    newCoreProductName && selectedCategory
      ? {
          id: -1,
          name: newCoreProductName,
          slug: generateSlug(newCoreProductName),
          image: "",
          categoryId: selectedCategory,
          subCategoryId: selectedSubCategoryId,
          brandCreationMode: "batch",
          configuredBrandIds: [],
          category: {
            ...draftCoreCategory,
            type: productTypes.find(
              (type: any) => type.id === draftCoreCategory?.typeId,
            ),
          },
          subCategory: allSubcategories.find(
            (subCategory: any) => subCategory.id === selectedSubCategoryId,
          ),
        }
      : undefined;
  const activeCoreProduct =
    lockedCoreProduct ?? selectedCoreProduct ?? draftCoreProduct;
  const hasSelectedCoreIdentity =
    selectedCoreProductId !== null || newCoreProductName !== null;
  const isSingleBrandCreation =
    !isStructureLocked &&
    (activeCoreProduct as any)?.brandCreationMode === "single";
  const availableVariantOptions =
    isCoreIdentityLocked && !activeCoreProduct
      ? []
      : getAvailableVariantsForCoreProduct(activeCoreProduct, [
          ...(editAdapter?.variantOptions ??
            catalogOptionsData?.variantOptions ??
            []),
          ...createdVariants,
        ]).filter(
          (variant: any, index: number, list: any[]) =>
            list.findIndex((item) => item.id === variant.id) === index,
        );
  const isLoadingLockedCoreProduct =
    isCoreIdentityLocked &&
    lockedCoreProductQuery.isLoading &&
    !activeCoreProduct;
  const activeTypeId =
    (activeCoreProduct as any)?.category?.typeId ?? selectedTypeId;
  const activeProductType =
    productTypes.find((type: any) => type.id === activeTypeId) ??
    (usesExternalEditAdapter ? productTypes[0] : undefined);
  const activeFulfillmentProfile = activeProductType?.fulfillmentProfile as
    | ProductTypeFulfillmentProfile
    | undefined;
  const isLpgRules =
    activeFulfillmentProfile?.family === "lpg" ||
    activeProductType?.family === "lpg";
  // LPG uses the client's Type × Size Variant Table (admin, and seller
  // edit pages that opt in).
  const [savedFitsLpgTable] = useState(
    () => !isEdit || savedVariantsFitLpgTable(product),
  );
  const usesLpgVariantTable =
    isLpgRules &&
    (!usesExternalEditAdapter || Boolean(editAdapter?.lpgVariantTable)) &&
    savedFitsLpgTable;
  const lpgTypeOptions = useMemo(() => {
    const typeAttribute = (variantAttributes as any[]).find(
      (attribute) => attribute.name === "Type",
    );
    const options = Array.isArray(typeAttribute?.options)
      ? (typeAttribute.options as string[]).filter(Boolean)
      : [];
    return options.length > 0 ? options : [...DEFAULT_LPG_TYPE_OPTIONS];
  }, [variantAttributes]);
  // One row per Type option.
  const lpgTableRows =
    lpgRows.length >= lpgTypeOptions.length
      ? lpgRows
      : [
          ...lpgRows,
          ...emptyVariantTableRows(lpgTypeOptions.length - lpgRows.length),
        ];
  const lpgEntries = sizeSaleTypes(lpgTableRows, lpgTypeOptions);
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

  // A Core Identity is reusable. Only the same Core Identity + Brand pair is
  // unique, so keep existing Brand Products out of this create flow.
  const configuredBrandIds = new Set<number>([
    ...((activeCoreProduct as any)?.configuredBrandIds ?? []),
    ...brandConfigs.map((bc) => bc.brandId),
  ]);
  const availableBrands = allBrands.filter(
    (b: any) => b.isActive !== false && !configuredBrandIds.has(b.id),
  );

  const handleError = (error: Error) => {
    toast.error(
      error.message ||
        `An unexpected error occurred while ${isEdit ? "updating" : "creating"} the product.`,
    );
  };

  const createMutation = useMutation({
    ...orpc.product.create.mutationOptions(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
        queryClient.invalidateQueries({
          queryKey: orpc.product.getAdminWebViewProducts.key(),
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.adminCoreProduct.getAll.key(),
        }),
      ]);
      toast.success("Product created successfully");
      router.push(listHref);
    },
    onError: handleError,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) =>
      editAdapter
        ? editAdapter.onUpdate(payload)
        : orpc.product.update.call(payload),
    onSuccess: async () => {
      if (editAdapter) {
        await editAdapter.onUpdated?.();
      } else {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
          queryClient.invalidateQueries({
            queryKey: orpc.product.getAdminWebViewProducts.key(),
          }),
        ]);
      }
      toast.success("Product updated successfully");
      router.push(listHref);
    },
    onError: handleError,
  });

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    isLoadingLockedCoreProduct;
  const initialExpiryEnabled =
    (product as any)?.expiryEnabled ?? activeRuleDefaults.expiryEnabled;

  // Pricing: one row per brand and selected variant.
  const variantName = (variantOptionId: number) =>
    availableVariantOptions.find((option: any) => option.id === variantOptionId)
      ?.name ?? `Variant #${variantOptionId}`;
  const pricingRows: PricingRow[] = brandConfigs.flatMap((config) =>
    config.selectedVariantIds.map((variantOptionId) => ({
      key: `${config.brandId}:${variantOptionId}`,
      brandId: config.brandId,
      brandName: config.brandName,
      variantName: variantName(variantOptionId),
      exchange: isLpgRules,
    })),
  );
  const pricingValues: Record<string, PricingValue> = Object.fromEntries(
    brandConfigs.flatMap((config) =>
      config.selectedVariantIds.map((variantOptionId) => {
        const settings = config.variantSettings[variantOptionId];
        return [
          `${config.brandId}:${variantOptionId}`,
          {
            newPrice: settings?.consumerPrice ?? "",
            exchangePrice: settings?.exchangePrice ?? "",
          },
        ];
      }),
    ),
  );
  const handlePriceChange = (key: string, patch: Partial<PricingValue>) => {
    const [brandId, variantOptionId] = key.split(":").map(Number) as [
      number,
      number,
    ];
    setBrandConfigs((prev) =>
      prev.map((config) => {
        if (config.brandId !== brandId) return config;
        const current =
          config.variantSettings[variantOptionId] ??
          makeDefaultSettings(variantOptionId, brandId);
        return {
          ...config,
          variantSettings: {
            ...config.variantSettings,
            [variantOptionId]: {
              ...current,
              ...(patch.newPrice !== undefined
                ? { consumerPrice: patch.newPrice }
                : {}),
              ...(patch.exchangePrice !== undefined
                ? { exchangePrice: patch.exchangePrice }
                : {}),
            },
          },
        };
      }),
    );
  };
  // Delivery is charged per the selected variants' Type unless changed.
  const suggestedDeliveryUnit = suggestDeliveryCostUnit(
    brandConfigs.flatMap((config) =>
      config.selectedVariantIds.map((variantOptionId) =>
        availableVariantOptions.find(
          (option: any) => option.id === variantOptionId,
        ),
      ),
    ),
  );

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
      trackingType: initialExpiryEnabled
        ? "batch"
        : ((product as any)?.trackingType ?? activeRuleDefaults.trackingType),
      expiryEnabled: initialExpiryEnabled,
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
      conversionEnabled:
        (product as any)?.conversionEnabled ??
        activeRuleDefaults.conversionEnabled,
      inventoryLooseUnitEnabled:
        (product as any)?.inventoryLooseUnitEnabled ??
        activeRuleDefaults.inventoryLooseUnitEnabled,
      inventoryLooseUnit:
        (product as any)?.inventoryLooseUnit ??
        activeRuleDefaults.inventoryLooseUnit,
      deliveryCostUnit: ((product as any)?.deliveryCostUnit ?? "") as string,
      deliveryCostMethod: initialDeliveryMethod(product as any),
      inventoryUnit: ((product as any)?.inventoryUnit ?? "") as
        | InventoryUnitCode
        | "",
      conversionRule: ((product as any)?.conversionRule ?? "") as string,
      variantAttr1: ((product as any)?.variantAttr1 ?? "") as string,
      variantAttr2: ((product as any)?.variantAttr2 ?? "") as string,
      defaultDeliveryCost: priceInputValue((product as any)?.defaultDeliveryCost),
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
      if (!isEdit && brandConfigs.length !== 1) {
        toast.error("Choose one brand for this product");
        return;
      }

      const vpArray: any[] = [];
      if (usesLpgVariantTable) {
        const invalidSizes = lpgTableRows.flatMap(
          (row) => parseSizeList(row.sizes).invalid,
        );
        if (invalidSizes.length > 0) {
          toast.error(`Not a size in KG: ${invalidSizes.join(", ")}`);
          return;
        }
        if (lpgEntries.length === 0) {
          toast.error("Tick a Type and enter at least one size");
          return;
        }
        const priceError = lpgEntries
          .map((entry) => salePriceError(entry, lpgPrices))
          .find(Boolean);
        if (priceError) {
          toast.error(priceError);
          return;
        }
        let optionIds: Map<string, number>;
        try {
          optionIds = await resolveLpgSizeOptions(lpgEntries);
        } catch (error) {
          toast.error(
            error instanceof Error && error.message
              ? error.message
              : "The sizes could not be saved",
          );
          return;
        }
        const brandId = brandConfigs[0]!.brandId;
        for (const entry of lpgEntries) {
          const priceOf = (type: string) =>
            (lpgPrices[salePriceKey(entry.size.value, type)] ?? "").trim();
          const saleTypePrices = Object.fromEntries(
            entry.types.map((type) => [type, priceOf(type)]),
          );
          const newPrice = entry.types.includes("New") ? priceOf("New") : "";
          // Exchange can be ordered only with both New and Exchange prices.
          const credit = entry.types.includes("Exchange")
            ? exchangeCreditFrom({
                newPrice,
                exchangePrice: priceOf("Exchange"),
              })
            : null;
          vpArray.push({
            variantOptionId: optionIds.get(entry.size.value),
            brandId,
            consumerPrice: newPrice || "0",
            exchangeEnabled: credit !== null,
            exchangeCreditAmount: credit ?? "0",
            saleTypePrices,
          });
        }
      } else {
      if (
        brandConfigs.some((config) => config.selectedVariantIds.length === 0)
      ) {
        toast.error("Select at least one variant for every brand");
        return;
      }
      const pricingError = firstPricingError(pricingRows, pricingValues);
      if (pricingError) {
        toast.error(pricingError);
        return;
      }

      // Build variant prices array from brand configs
      for (const bc of brandConfigs) {
        for (const voId of bc.selectedVariantIds) {
          const settings = bc.variantSettings[voId];
          if (!settings) continue;
          // LPG sells as Exchange and New, but buyers only see Exchange
          // once it has a price (here or later in Price); otherwise it
          // would sell at the full New price with no credit.
          const credit = isLpgRules
            ? exchangeCreditFrom({
                newPrice: settings.consumerPrice,
                exchangePrice: settings.exchangePrice ?? "",
              })
            : null;
          vpArray.push({
            variantOptionId: settings.variantOptionId,
            brandId: bc.brandId,
            consumerPrice: settings.consumerPrice || "0",
            exchangeEnabled: credit !== null,
            exchangeCreditAmount: credit ?? "0",
          });
        }
      }
      }

      const brandIds = brandConfigs.map((bc) => bc.brandId);

      const payload = {
        ...value,
        coreProductId: isStructureLocked ? undefined : selectedCoreProductId,
        newCoreProductName:
          !isStructureLocked && newCoreProductName
            ? newCoreProductName
            : undefined,
        brandIds: isStructureLocked
          ? undefined
          : brandIds.length > 0
            ? brandIds
            : undefined,
        variantPrices: vpArray.length > 0 ? vpArray : undefined,
        deliveryCostUnit: resolveDeliveryUnit(
          value.deliveryCostUnit,
          suggestedDeliveryUnit,
        ),
        defaultDeliveryCost: value.defaultDeliveryCost || null,
        conversionRule: value.conversionEnabled ? value.conversionRule : "",
        ...(usesLpgVariantTable
          ? { variantAttr1: "Type", variantAttr2: "Size" }
          : {}),
      };

      if (isEdit) {
        updateMutation.mutate(payload);
      } else {
        createMutation.mutate(payload);
      }
    },
  });

  // LPG: Variant attribute 1 is Type and 2 is Size, always.
  useEffect(() => {
    if (!usesLpgVariantTable) return;
    if (form.getFieldValue("variantAttr1") !== "Type") {
      form.setFieldValue("variantAttr1", "Type");
    }
    if (form.getFieldValue("variantAttr2") !== "Size") {
      form.setFieldValue("variantAttr2", "Size");
    }
  }, [usesLpgVariantTable, form]);

  /** Variant option id for each Variant Table size, creating missing ones. */
  const resolveLpgSizeOptions = async (entries: SizeSaleTypes[]) => {
    const typeId = (activeCoreProduct as any)?.category?.typeId;
    const categoryId = (activeCoreProduct as any)?.categoryId;
    const ids = new Map<string, number>();
    for (const entry of entries) {
      const existing = availableVariantOptions.find(
        (option: any) =>
          option.isActive !== false &&
          cylinderKgOf(option) === entry.size.value,
      );
      if (existing) {
        ids.set(entry.size.value, existing.id);
        continue;
      }
      const definition = {
        kind: "measurement" as const,
        value: entry.size.value,
        measurementUnit: "KG",
        container: "cylinder",
      };
      if (!editAdapter?.onCreateVariant && (!typeId || !categoryId)) {
        throw new Error("Select the product type and category first");
      }
      const created = editAdapter?.onCreateVariant
        ? await editAdapter.onCreateVariant(definition)
        : await orpc.adminVariantOption.create.call({
            definition,
            typeId,
            categoryId,
            sortOrder: 0,
            reuseExisting: true,
          });
      setCreatedVariants((current) => [...current, created]);
      ids.set(entry.size.value, created.id);
    }
    return ids;
  };

  const applyCoreProductToForm = useCallback(
    (cp: any) => {
      if (cp.id !== selectedCoreProductId) {
        setBrandConfigs([]);
        setActiveBrandId(null);
        setCollapsedBrandIds(new Set());
      }
      setNewCoreProductName(null);
      setPickedCoreProduct(cp);
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
    [form, selectedCoreProductId],
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

  // Picking a sub category starts the core identity over.
  const handleSubcategorySelect = (subCategoryId: number | null) => {
    setSelectedSubCategoryId(subCategoryId);
    setSelectedCoreProductId(null);
    setNewCoreProductName(null);
    form.setFieldValue("subCategoryId", subCategoryId ?? undefined);
    form.setFieldValue("coreProductId", null);
  };

  /** A sub category typed in the search that is not listed is saved now. */
  const handleSubcategoryCreate = async (rawName: string) => {
    const name = rawName.trim();
    if (!selectedCategory || name.length < 2 || creatingSubcategory) {
      return false;
    }
    const slug = generateSlug(name);
    if (!slug) {
      toast.error("Enter a sub category name with letters or numbers");
      return false;
    }
    setCreatingSubcategory(true);
    try {
      const created = await orpc.adminSubcategory.create.call({
        name,
        slug,
        categoryId: selectedCategory,
      });
      if (!created) throw new Error("The sub category could not be added");
      setCreatedSubcategories((current) => [...current, created]);
      handleSubcategorySelect(created.id);
      toast.success(`${created.name} added`);
      await queryClient.invalidateQueries({
        queryKey: orpc.adminSubcategory.getAllGlobal.queryKey(),
      });
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "The sub category could not be added",
      );
      return false;
    } finally {
      setCreatingSubcategory(false);
    }
  };

  const handleCoreProductCreate = (name: string) => {
    if (!selectedCategory) return false;

    const normalizedName = name.trim();
    const slug = generateSlug(normalizedName);
    if (!slug) {
      toast.error("Enter a core identity name with letters or numbers");
      return false;
    }

    setSelectedCoreProductId(null);
    setNewCoreProductName(normalizedName);
    setBrandConfigs([]);
    setActiveBrandId(null);
    setCollapsedBrandIds(new Set());
    form.setFieldValue("name", normalizedName);
    form.setFieldValue("slug", slug);
    form.setFieldValue("image", "");
    form.setFieldValue("categoryId", selectedCategory);
    form.setFieldValue("subCategoryId", selectedSubCategoryId ?? undefined);
    form.setFieldValue("coreProductId", null);
    toast.info(
      `Core identity “${normalizedName}” will be created with this product`,
    );
    return true;
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

  // The client's defaults: a cylinder unit with Type / Size for LPG, pieces
  // otherwise. Saved values win.
  useEffect(() => {
    if (!activeProductType) return;
    const family = isLpgRules ? "lpg" : "other";
    if (clientDefaultsFamily === family) return;
    const saved = isEdit ? (product as any) : undefined;
    if (!saved?.inventoryUnit) {
      form.setFieldValue("inventoryUnit", isLpgRules ? "cyl" : "pcs");
    }
    if (saved?.variantAttr1 == null) {
      form.setFieldValue("variantAttr1", isLpgRules ? "Type" : "");
    }
    if (saved?.variantAttr2 == null) {
      form.setFieldValue("variantAttr2", isLpgRules ? "Size" : "");
    }
    setClientDefaultsFamily(family);
  }, [
    activeProductType,
    clientDefaultsFamily,
    form,
    isEdit,
    isLpgRules,
    product,
  ]);

  // Add a brand configuration
  const handleAddBrand = (brandId: number, created?: any) => {
    const brand = created ?? allBrands.find((b: any) => b.id === brandId);
    if (!brand) return;

    const newConfig: BrandConfig = {
      brandId: brand.id,
      brandName: brand.name,
      brandLogo: brand.logo ?? null,
      selectedVariantIds: [],
      variantSettings: {},
    };

    // Create Product takes one brand: picking another replaces it.
    const singleBrand = isSingleBrandCreation || !isEdit;
    setBrandConfigs((prev) =>
      singleBrand ? [newConfig] : [...prev, newConfig],
    );
    if (singleBrand) setBrandModalOpen(false);
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

  /** "Create brand" in the brand picker: a new global brand. */
  const handleCreateBrand = async (rawName: string) => {
    const name = rawName.trim();
    if (name.length < 2 || creatingBrand) return;
    setCreatingBrand(true);
    try {
      const result = await orpc.brand.create.call({
        name,
        slug: generateSlug(name),
      });
      const created = result.data;
      if (!created) throw new Error("The brand could not be created");
      setCreatedBrands((current) => [...current, created]);
      handleAddBrand(created.id, created);
      setBrandModalOpen(false);
      setBrandSearch("");
      toast.success(`${created.name} added`);
      await queryClient.invalidateQueries({
        queryKey: orpc.brand.getAll.queryKey(),
      });
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "The brand could not be created",
      );
    } finally {
      setCreatingBrand(false);
    }
  };

  /** "+ variant" on a brand: a global variant for this category, selected. */
  const handleCreateVariant = async (definition: NewVariantDefinition) => {
    const brandId = variantDialogBrandId;
    const typeId = (activeCoreProduct as any)?.category?.typeId;
    const categoryId = (activeCoreProduct as any)?.categoryId;
    if (!typeId || !categoryId) {
      throw new Error("Select the product type and category first");
    }
    const created = await orpc.adminVariantOption.create.call({
      definition,
      typeId,
      categoryId,
      sortOrder: 0,
      reuseExisting: true,
    });
    setCreatedVariants((current) => [...current, created]);
    await queryClient.invalidateQueries({
      queryKey: ["adminCatalogApproval", "productFormOptions"],
    });
    if (brandId == null) return;
    const config = brandConfigs.find((item) => item.brandId === brandId);
    if (config && !config.selectedVariantIds.includes(created.id)) {
      handleToggleVariant(brandId, created.id);
    }
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

  const identityDescription = isEdit
    ? "The core product this listing is based on."
    : isCoreIdentityLocked
      ? "This product is based on the selected core identity."
      : hasSelectedCoreIdentity
        ? "The core product this listing is based on."
        : "Choose the core product this listing is based on.";

  return (
    <div className="@container/product-form min-h-screen bg-muted/30">
      {/* Command bar */}
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-[1500px] flex-col items-stretch gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-2.5">
          <div className="flex min-w-0 w-full items-center gap-3 sm:w-auto">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
            >
              <Link href={listHref}>
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
          <div className="flex w-full shrink-0 items-center justify-end gap-1.5 sm:w-auto sm:gap-2">
            {isEdit && product?.id ? (
              <DeleteProductDialog
                productId={product.id}
                productName={product.name}
                force
                compact
                onSuccess={() => router.push(listHref)}
              />
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="max-sm:px-2 max-sm:text-xs"
              onClick={() => router.push(listHref)}
              disabled={isPending}
            >
              Discard
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="max-sm:px-2 max-sm:text-xs"
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
              className="max-sm:px-2 max-sm:text-xs"
              onClick={() => {
                if (editAdapter?.publishOnSave) {
                  form.setFieldValue("status", "active");
                }
                form.handleSubmit();
              }}
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
        <div className="mx-auto max-w-[1500px] px-4 py-6">
          <div className="grid grid-cols-1 gap-6 @5xl/product-form:grid-cols-[minmax(0,1.62fr)_minmax(420px,1fr)] @5xl/product-form:items-start">
            {/* Product details */}
            <div className="min-w-0 space-y-6">
              {/* ── Product Information ── */}
              <FormSection
                variant="card"
                title="Product Information"
                description={identityDescription}
              >
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
                            setNewCoreProductName(null);
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
                            setNewCoreProductName(null);
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
                        <SearchCreateCombobox
                          key={`sub-${selectedCategory ?? "none"}`}
                          noun="sub category"
                          options={filteredSubcategories}
                          selected={filteredSubcategories.find(
                            (sc: any) => sc.id === selectedSubCategoryId,
                          )}
                          disabled={!selectedCategory}
                          disabledLabel="Select a category first"
                          creating={creatingSubcategory}
                          clearLabel="No sub category"
                          onSelect={handleSubcategorySelect}
                          onClear={() => handleSubcategorySelect(null)}
                          onCreate={handleSubcategoryCreate}
                        />
                      </Field>

                      {/* Core identity */}
                      <Field>
                        <FieldLabel>Core identity *</FieldLabel>
                        <SearchCreateCombobox
                          key={`${selectedCategory ?? "none"}-${selectedSubCategoryId ?? "all"}`}
                          noun="core identity"
                          options={coreProducts}
                          selected={
                            hasSelectedCoreIdentity
                              ? (activeCoreProduct as SearchCreateOption)
                              : undefined
                          }
                          disabled={!selectedCategory}
                          disabledLabel="Select a category first"
                          onSelect={handleCoreProductSelect}
                          onCreate={handleCoreProductCreate}
                        />
                      </Field>
                    </div>
                  )}
                  {/* Display name and slug are not shown: they come from the
                      core identity and are kept unique when the product saves. */}
                </div>
              </FormSection>

              {/* ── Brands and variants ── */}
              {(hasSelectedCoreIdentity || isEdit) &&
                (isStructureLocked ? (
                  <FormSection
                    variant="card"
                    title={usesLpgVariantTable ? "Brand" : "Brand and variants"}
                    description={
                      usesLpgVariantTable
                        ? "The brand is fixed for this product. Sizes and prices are set below."
                        : "The brand is fixed for this generated product. Prices are managed in Product Price."
                    }
                  >
                    {brandConfigs.map((bc) =>
                      usesLpgVariantTable ? (
                        <SelectedBrandRow key={bc.brandId} config={bc} />
                      ) : (
                      <BrandConfigCard
                        key={bc.brandId}
                        config={bc}
                        variantOptions={filterVariantsForBrand(availableVariantOptions, EMPTY_VARIANT_FILTER, bc.selectedVariantIds)}
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
                      ),
                    )}
                  </FormSection>
                ) : (
                  <FormSection
                    variant="card"
                    title={usesLpgVariantTable ? "Brand" : "Brand and variants"}
                    description={
                      usesLpgVariantTable
                        ? "Search or add the brand. Sizes are set in the Variant Table."
                        : "Choose one brand and the variants it offers."
                    }
                  >
                    <div className="space-y-3">
                      {brandConfigs.map((bc) =>
                        usesLpgVariantTable ? (
                          <SelectedBrandRow
                            key={bc.brandId}
                            config={bc}
                            onRemove={
                              isEdit
                                ? undefined
                                : () => {
                                    handleRemoveBrand(bc.brandId);
                                    setBrandSearch("");
                                    setBrandModalOpen(true);
                                  }
                            }
                          />
                        ) : (
                        <BrandConfigCard
                          key={bc.brandId}
                          config={bc}
                          variantOptions={filterVariantsForBrand(availableVariantOptions, EMPTY_VARIANT_FILTER, bc.selectedVariantIds)}
                          isExpanded={!collapsedBrandIds.has(bc.brandId)}
                          onToggleExpand={() => toggleBrandExpanded(bc.brandId)}
                          onRemove={() => handleRemoveBrand(bc.brandId)}
                          onToggleVariant={(voId) =>
                            handleToggleVariant(bc.brandId, voId)
                          }
                          onSetVariants={(voIds) =>
                            handleSetVariants(bc.brandId, voIds)
                          }
                          onAddVariant={() =>
                            setVariantDialogBrandId(bc.brandId)
                          }
                        />
                        ),
                      )}

                      {brandConfigs.length === 0 && (
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
                      )}

                      {brandConfigs.length === 0 && (
                        <p className="text-center text-xs text-muted-foreground">
                          {usesLpgVariantTable
                            ? "Add the brand this product is sold under."
                            : "Add a brand to start configuring variants."}
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
                              placeholder="Search or create a brand..."
                              value={brandSearch}
                              onChange={(e) => setBrandSearch(e.target.value)}
                              className="pl-9"
                              autoFocus
                            />
                          </div>
                          <div className="max-h-[300px] overflow-y-auto space-y-1 -mx-1 px-1">
                            {(() => {
                              const typed = brandSearch.trim();
                              if (
                                typed.length < 2 ||
                                allBrands.some(
                                  (b: any) =>
                                    b.name.toLowerCase() ===
                                    typed.toLowerCase(),
                                )
                              )
                                return null;
                              return (
                                <button
                                  type="button"
                                  disabled={creatingBrand}
                                  onClick={() => void handleCreateBrand(typed)}
                                  className="flex w-full items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/80 disabled:opacity-60"
                                >
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                                    {creatingBrand ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Plus className="h-4 w-4" />
                                    )}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium">
                                      Create brand “{typed}”
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                      Adds a new brand to the catalog.
                                    </span>
                                  </span>
                                </button>
                              );
                            })()}
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
                                      : brandSearch.trim().length >= 2
                                        ? "No other brands match."
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
                    <AddVariantDialog
                      open={variantDialogBrandId !== null}
                      onOpenChange={(open) => {
                        if (!open) setVariantDialogBrandId(null);
                      }}
                      family={
                        activeProductType
                          ? (inferProductTypeFamily(
                              activeProductType,
                            ) as VariantProductFamily)
                          : "generic"
                      }
                      scopeLabel="Adds a variant to the catalog for this category. It is selected for this brand."
                      onCreate={handleCreateVariant}
                    />
                  </FormSection>
                ))}

              {/* ── Variant Table (LPG) ── */}
              {(hasSelectedCoreIdentity || isEdit) && usesLpgVariantTable && (
                <FormSection
                  variant="card"
                  title="Variant Table"
                  description="Tick how each size is sold, then list the sizes. Stock is counted per size."
                >
                  <LpgVariantTable
                    typeOptions={lpgTypeOptions}
                    rows={lpgTableRows}
                    onRowsChange={setLpgRows}
                  />
                </FormSection>
              )}

              {/* ── Description ── */}
              {(hasSelectedCoreIdentity || isEdit) && (
                <FormSection
                  variant="card"
                  title="Description"
                  description="How this product appears to customers."
                >
                  <div className="space-y-4">
                    <form.Field name="shortDescription">
                      {(field) => (
                        <Field>
                          <FieldLabel className="flex items-center justify-between">
                            <span>Short description</span>
                            <span className="text-xs font-normal text-muted-foreground tabular-nums">
                              {Math.min(
                                field.state.value.length,
                                SHORT_DESCRIPTION_LIMIT,
                              )}
                              /{SHORT_DESCRIPTION_LIMIT}
                            </span>
                          </FieldLabel>
                          <Textarea
                            rows={2}
                            maxLength={SHORT_DESCRIPTION_LIMIT}
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="Write a concise product summary (maximum 160 characters)"
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

              {/* ── Media ── */}
              <FormSection
                variant="card"
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

              {/* ── Pricing ── */}
              {hasSelectedCoreIdentity && (
                <FormSection
                  variant="card"
                  title="Pricing"
                  description={
                    usesExternalEditAdapter
                      ? "Your selling price. You can also change it later in Price."
                      : "Optional. Sets the admin reference price; you can also set it later in Price."
                  }
                >
                  {usesLpgVariantTable ? (
                    <LpgVariantPricing
                      entries={lpgEntries}
                      prices={lpgPrices}
                      onPriceChange={(key, value) =>
                        setLpgPrices((prices) => ({ ...prices, [key]: value }))
                      }
                    />
                  ) : (
                    <ProductPricingTable
                      rows={pricingRows}
                      values={pricingValues}
                      onChange={handlePriceChange}
                    />
                  )}
                </FormSection>
              )}
            </div>

            {/* Inventory and publishing */}
            <div className="min-w-0 space-y-6">
              {/* ── Inventory & Product Rules (client layout) ── */}
              <FormSection
                variant="card"
                title="Inventory & Product Rules"
                className="p-5 sm:px-5"
              >
                <form.Subscribe selector={(state) => state.values}>
                  {(values) => (
                    <ClientRulesGrid
                      values={clientRuleValues(values)}
                      onChange={(patch) => {
                        for (const [key, value] of Object.entries(patch)) {
                          form.setFieldValue(key as any, value as any);
                        }
                      }}
                      attributes={variantAttributes}
                      attributesLocked={usesLpgVariantTable}
                    />
                  )}
                </form.Subscribe>
              </FormSection>

              {/* ── Delivery Cost Configuration ── */}
              <FormSection
                variant="card"
                title="Delivery Cost Configuration"
                className="p-5 sm:px-5"
              >
                <form.Subscribe selector={(state) => state.values}>
                  {(values) => {
                    const method = isDeliveryCostMethod(
                      values.deliveryCostMethod,
                    )
                      ? values.deliveryCostMethod
                      : "free";
                    return (
                      <div className="space-y-3">
                        <Field>
                          <FieldLabel>Delivery cost method</FieldLabel>
                          <DeliveryMethodSelect
                            value={method}
                            className="h-9 w-full"
                            onChange={(next) =>
                              form.setFieldValue(
                                "deliveryCostMethod",
                                next as DeliveryCostMethod,
                              )
                            }
                          />
                        </Field>
                        <Field>
                          <FieldLabel>Default delivery cost (৳)</FieldLabel>
                          <Input
                            inputMode="decimal"
                            placeholder="Enter default cost"
                            value={values.defaultDeliveryCost ?? ""}
                            onChange={(event) => {
                              const next = event.target.value.trim();
                              if (/^\d{0,8}(\.\d{0,2})?$/.test(next)) {
                                form.setFieldValue("defaultDeliveryCost", next);
                              }
                            }}
                          />
                        </Field>
                        <p className="text-xs text-muted-foreground">
                          {DELIVERY_COST_METHODS[method].help}
                        </p>
                      </div>
                    );
                  }}
                </form.Subscribe>
              </FormSection>

              <FormSection
                variant="card"
                title="Publishing"
                className="p-5 sm:px-5"
              >
                <div className="space-y-4">
                  <form.Field name="status">
                    {(field) => (
                      <div className="space-y-1.5">
                        <FieldLabel className="text-xs text-muted-foreground">
                          Status
                        </FieldLabel>
                        <Select
                          value={field.state.value}
                          onValueChange={(v) =>
                            v && field.handleChange(v as any)
                          }
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
                          onValueChange={(v) =>
                            v && field.handleChange(v as any)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="public">Public</SelectItem>
                            <SelectItem value="private">Private</SelectItem>
                            <SelectItem value="unlisted">Unlisted</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {VISIBILITY_HELP[field.state.value] ??
                            VISIBILITY_HELP.public}
                        </p>
                      </div>
                    )}
                  </form.Field>

                  {!usesExternalEditAdapter && (
                    <>
                      <Separator />
                      <form.Field name="isFeatured">
                        {(field) => (
                          <FeaturedCheckbox
                            checked={field.state.value}
                            onChange={field.handleChange}
                          />
                        )}
                      </form.Field>
                    </>
                  )}
                </div>
              </FormSection>

              {/* ── Final action ── */}
              <div className="rounded-xl border bg-card p-4">
                <FinalActions
                  cancelHref={listHref}
                  onSaveDraft={() => {
                    form.setFieldValue("status", "draft");
                    form.handleSubmit();
                  }}
                  onPublish={() => {
                    if (editAdapter?.publishOnSave) {
                      form.setFieldValue("status", "active");
                    }
                    form.handleSubmit();
                  }}
                  publishLabel={isEdit ? "Save changes" : "Publish product"}
                  pending={isPending}
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

const SHORT_DESCRIPTION_LIMIT = 160;

/**
 * LPG Variant Table state for a saved product. Sizes saved before the
 * table read as New (and Exchange when it was on).
 */
function initialLpgTable(product: any): {
  rows: VariantTableRow[];
  prices: Record<string, string>;
} {
  const rowCount = DEFAULT_LPG_TYPE_OPTIONS.length;
  const prices: Record<string, string> = {};
  const entries: SizeSaleTypes[] = [];
  const saved = Array.isArray(product?.variantPrices)
    ? product.variantPrices
    : [];
  for (const vp of saved) {
    if (product?.status !== "inactive" && vp.isActive === false) continue;
    const kg = vp.variantOption ? cylinderKgOf(vp.variantOption) : null;
    if (!kg || entries.some((entry) => entry.size.value === kg)) continue;
    const saleTypes: Record<string, string> =
      vp.saleTypePrices && typeof vp.saleTypePrices === "object"
        ? vp.saleTypePrices
        : {
            New: priceInputValue(vp.consumerPrice),
            ...(vp.exchangeEnabled
              ? {
                  Exchange: exchangePriceFrom(
                    vp.consumerPrice,
                    vp.exchangeCreditAmount,
                  ),
                }
              : {}),
          };
    const types = Object.keys(saleTypes);
    if (types.length === 0) continue;
    entries.push({ size: { value: kg, label: `${kg} KG` }, types });
    for (const [type, price] of Object.entries(saleTypes)) {
      prices[salePriceKey(kg, type)] = price ?? "";
    }
  }
  return {
    rows:
      entries.length > 0
        ? rowsFromSizeSaleTypes(entries, DEFAULT_LPG_TYPE_OPTIONS, rowCount)
        : emptyVariantTableRows(rowCount),
    prices,
  };
}

/**
 * Edit shows the Variant Table only when every saved variant is a cylinder
 * size in KG, once. Otherwise saving would drop a variant the table can't
 * show, so the per-brand variant list stays.
 */
function savedVariantsFitLpgTable(product: any) {
  const saved = Array.isArray(product?.variantPrices)
    ? product.variantPrices
    : [];
  const seen = new Set<string>();
  for (const vp of saved) {
    if (product?.status !== "inactive" && vp.isActive === false) continue;
    const kg = vp.variantOption ? cylinderKgOf(vp.variantOption) : null;
    if (!kg || seen.has(kg)) return false;
    seen.add(kg);
  }
  return true;
}

/** Delivery Cost Counting: the saved method, else the one its unit implies. */
function initialDeliveryMethod(product: any): DeliveryCostMethod {
  return isDeliveryCostMethod(product?.deliveryCostMethod)
    ? product.deliveryCostMethod
    : (deliveryMethodFromUnit(product?.deliveryCostUnit) ?? "free");
}

/** The form's rule fields in the client's grid shape. */
function clientRuleValues(values: any): ClientRuleValues {
  return {
    variantAttr1: values.variantAttr1 ?? "",
    variantAttr2: values.variantAttr2 ?? "",
    inventoryUnit: values.inventoryUnit ?? "",
    inventoryLooseUnitEnabled: Boolean(values.inventoryLooseUnitEnabled),
    inventoryLooseUnit: values.inventoryLooseUnit ?? "",
    conversionEnabled: Boolean(values.conversionEnabled),
    conversionRule: values.conversionRule ?? "",
    returnPolicyEnabled: Boolean(values.returnPolicyEnabled),
    isReturnablePack: Boolean(values.isReturnablePack),
    defaultPackDepositAmount: String(values.defaultPackDepositAmount ?? ""),
    trackingType: values.trackingType ?? "none",
    damageControlEnabled: Boolean(values.damageControlEnabled),
    expiryEnabled: Boolean(values.expiryEnabled),
    minimumOrderEnabled: Boolean(values.minimumOrderEnabled),
    minimumOrderQty: String(values.minimumOrderQty ?? ""),
    deliveryCostMethod: values.deliveryCostMethod ?? "free",
  };
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
    exchangeEnabled: false,
    exchangeCreditAmount: "0",
    exchangePrice: "",
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

/** LPG products: the one brand, without variant chips (sizes live in the Variant Table). */
function SelectedBrandRow({
  config,
  onRemove,
}: {
  config: BrandConfig;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
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
      <p className="min-w-0 flex-1 truncate text-sm font-semibold">
        {config.brandName}
      </p>
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground"
          onClick={onRemove}
        >
          Change
        </Button>
      )}
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
  onAddVariant,
}: {
  /** Opens "+ variant"; hidden when the brand's structure is locked. */
  onAddVariant?: () => void;
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
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                <span>No variants yet for this product.</span>
                {onAddVariant && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7"
                    onClick={onAddVariant}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add variant
                  </Button>
                )}
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
                        <span>{v.name}</span>
                      </button>
                    );
                  })}
                  {onAddVariant && (
                    <button
                      type="button"
                      onClick={onAddVariant}
                      className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary/5"
                      aria-label={`Add a new variant for ${config.brandName}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Variant</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
