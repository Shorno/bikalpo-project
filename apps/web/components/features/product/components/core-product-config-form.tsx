"use client";

import {
  resolveSingleBrandVariantDefaults,
  validateBrandCreationSubmission,
} from "@bikalpo-project/db/brand-creation";
import {
  inferProductTypeFamily,
} from "@bikalpo-project/db/fulfillment";
import {
  DELIVERY_COST_METHODS,
  deliveryMethodFromUnit,
  isDeliveryCostMethod,
} from "@bikalpo-project/db/product-client-options";
import { suggestDeliveryCostUnit } from "@bikalpo-project/db/product-delivery";
import {
  getVariantDefinition,
  type VariantProductFamily,
} from "@bikalpo-project/db/variant-definition";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
import { Field, FieldLabel } from "@/components/ui/field";
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
import { Textarea } from "@/components/ui/textarea";
import {
  type CoreProductConfigValues,
  coreProductConfigSchema,
} from "@/schema/core-product-config.schema";
import { orpc } from "@/utils/orpc";
import {
  AddVariantDialog,
  type NewVariantDefinition,
} from "./add-variant-dialog";
import { LpgVariantPricing, LpgVariantTable } from "./lpg-variant-table";
import {
  cylinderKgOf,
  DEFAULT_LPG_TYPE_OPTIONS,
  emptyVariantTableRows,
  type LpgTable,
  lpgTableError,
  lpgTableFromSizes,
  saleTypePricesFor,
  sizeSaleTypes,
} from "./lpg-variant-table-model";
import {
  exchangeCreditFrom,
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
import {
  ProductIdentityFields,
  ProductEditorSection,
} from "./product-editor-ui";

const PRODUCTS_BASE = "/dashboard/admin/products";
const SHORT_DESCRIPTION_LIMIT = 160;

export type PublishStatus = "active" | "draft" | "inactive";

/**
 * What a save sends: the form values plus Publishing. Without a brandId,
 * Status and Featured apply to every brand in the save.
 */
export type CoreProductConfigSubmit = CoreProductConfigValues & {
  publish?: { brandId?: number; status?: PublishStatus; featured?: boolean };
};

type CoreProductConfigFormProps = {
  coreProductId: number;
  adapter?: {
    configuration?: CoreProductConfiguration;
    brands: BrandOption[];
    variantOptions: VariantOption[];
    isLoading?: boolean;
    isError?: boolean;
    listHref: string;
    productEditHref: (productId: number) => string;
    onConfigure: (values: CoreProductConfigSubmit) => Promise<unknown>;
    onSaved?: () => void | Promise<void>;
    initialBrands?: CoreProductConfigValues["brands"];
    presetBrands?: CoreProductConfigValues["brands"];
    reloadPresetLabel?: string;
    /** "Create brand" in the brand picker; sellers get a store-only brand. */
    onCreateBrand?: (name: string) => Promise<BrandOption>;
    /** "+ variant" on a brand; sellers get a store-only variant. */
    onCreateVariant?: (
      definition: NewVariantDefinition,
    ) => Promise<VariantOption>;
    /** Shown in the variant dialog: who will see a new variant. */
    variantScopeLabel?: string;
    /**
     * LPG products use the client's Type × Size Variant Table instead of
     * variant chips (retailer and wholesaler catalog Add).
     */
    lpgVariantTable?: boolean;
    /**
     * Product Information body. Catalog Add passes editable Type / Category
     * / Sub category / Core identity pickers; without it they show locked.
     */
    renderIdentity?: (core: any) => ReactNode;
  };
};

function slugifyBrandName(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "brand"
  );
}

type BrandOption = {
  id: number;
  name: string;
  logo?: string | null;
  isActive?: boolean;
};

type VariantOption = {
  id: number;
  name: string;
  unit?: string | null;
  size?: string | null;
  variantType?: string | null;
  typeId?: number | null;
  categoryId?: number | null;
  definitionKind?: string | null;
  definition?: Record<string, unknown> | null;
  needsReview?: boolean;
  isActive?: boolean;
};

type SelectedVariant = {
  variantOptionId: number;
  consumerPrice: string;
  retailPrice?: string;
  exchangePrice?: string;
};

type ExistingBrandProduct = {
  brandId: number;
  brandName: string;
  brandLogo?: string | null;
  productId: number;
  productName: string;
  productSlug?: string;
  productImage?: string | null;
  status: string;
  isFeatured?: boolean;
  variantOptions: Array<{
    variantOptionId: number;
    consumerPrice: string;
    isActive: boolean;
    variantOptionName?: string | null;
    requiresDefinitionReview?: boolean;
  }>;
};

type CoreProductConfiguration = {
  core: any;
  template?: {
    version: number | null;
    details: CoreProductConfigValues["template"];
  };
  brands: ExistingBrandProduct[];
};

export default function CoreProductConfigForm({
  coreProductId,
  adapter,
}: CoreProductConfigFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const seededDefaultsSignature = useRef<string | null>(null);
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const [collapsedBrands, setCollapsedBrands] = useState<Set<number>>(
    () => new Set(),
  );
  const [saved, setSaved] = useState(false);
  const [singleSaveVersion, setSingleSaveVersion] = useState(0);
  // Brands/variants created here show at once, before the lists refetch.
  const [createdBrands, setCreatedBrands] = useState<BrandOption[]>([]);
  const [createdVariants, setCreatedVariants] = useState<VariantOption[]>([]);
  const [creatingBrand, setCreatingBrand] = useState(false);
  const [variantDialogBrandId, setVariantDialogBrandId] = useState<
    number | null
  >(null);

  const configQuery = useQuery({
    ...orpc.adminProductConfig.get.queryOptions({ input: { coreProductId } }),
    enabled: !adapter,
  });
  const brandsQuery = useQuery({
    ...orpc.brand.getAll.queryOptions(),
    enabled: !adapter,
  });
  const catalogOptionsQuery = useQuery({
    queryKey: ["adminCatalogApproval", "coreProductConfigOptions"],
    queryFn: () => orpc.adminCatalogApproval.getRequestOptions.call({}),
    enabled: !adapter,
  });

  const configuration = (adapter?.configuration ?? configQuery.data) as
    | CoreProductConfiguration
    | undefined;
  const core = configuration?.core;
  const isSingleMode = core?.brandCreationMode === "single";
  const existingBrands: ExistingBrandProduct[] = configuration?.brands ?? [];
  const loadedBrands =
    adapter?.brands ??
    ((Array.isArray(brandsQuery.data)
      ? brandsQuery.data
      : []) as BrandOption[]);
  const allBrands = [
    ...loadedBrands,
    ...createdBrands.filter(
      (created) => !loadedBrands.some((brand) => brand.id === created.id),
    ),
  ];
  const availableVariants = useMemo(() => {
    const loaded =
      adapter?.variantOptions ??
      ((catalogOptionsQuery.data?.variantOptions ?? []) as VariantOption[]);
    return filterVariantsForCore(core, [
      ...loaded,
      ...createdVariants.filter(
        (created) => !loaded.some((variant) => variant.id === created.id),
      ),
    ]);
  }, [
    adapter?.variantOptions,
    catalogOptionsQuery.data?.variantOptions,
    core,
    createdVariants,
  ]);
  const productFamily: VariantProductFamily = core?.category?.type
    ? (inferProductTypeFamily(core.category.type) as VariantProductFamily)
    : "generic";
  const existingByBrandId = useMemo(
    () => new Map(existingBrands.map((brand) => [brand.brandId, brand])),
    [existingBrands],
  );
  const defaultValues = useMemo<CoreProductConfigValues>(
    () => ({
      template: normalizeTemplateDetails(
        configuration?.template?.details,
        core,
        productFamily,
      ),
      brands: isSingleMode
        ? []
        : (adapter?.initialBrands ??
          configuration?.brands
            .filter((brand) => brand.status !== "inactive")
            .map((brand) => ({
              brandId: brand.brandId,
              variants: brand.variantOptions
                .filter((option) => option.isActive)
                .map((option) => ({
                  variantOptionId: option.variantOptionId,
                  consumerPrice: option.consumerPrice || "0",
                })),
            })) ??
          []),
    }),
    [
      adapter?.initialBrands,
      configuration?.brands,
      configuration?.template,
      core,
      isSingleMode,
    ],
  );

  const configureMutation = useMutation({
    mutationFn: (input: {
      coreProductId: number;
      expectedVersion: number | null;
      details: CoreProductConfigValues["template"];
      brands: CoreProductConfigValues["brands"];
      publish?: CoreProductConfigSubmit["publish"];
    }) =>
      adapter
        ? adapter.onConfigure({
            template: input.details,
            brands: input.brands,
            publish: input.publish,
          })
        : orpc.adminProductConfig.configure.call(input),
    onSuccess: async () => {
      setSaved(true);
      toast.success("Shared template and brand products updated");
      if (adapter) {
        await adapter.onSaved?.();
      } else {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.adminProductConfig.get.queryKey({
              input: { coreProductId },
            }),
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.adminCoreProduct.getAll.queryKey({ input: {} }),
          }),
        ]);
        if (isSingleMode) {
          router.push(`${PRODUCTS_BASE}/core/${coreProductId}`);
        }
      }
      if (isSingleMode) {
        setSingleSaveVersion((version) => version + 1);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Could not save product changes");
    },
  });

  // Inventory & Product Rules: the client's "Variant Attribute" choices.
  const attributesQuery = useQuery(orpc.variantAttribute.list.queryOptions());
  const variantAttributes = (attributesQuery.data ?? []) as Array<{
    name: string;
    options?: unknown;
  }>;

  // LPG Variant Table (retailer and wholesaler Add): one table per brand.
  const lpgTypeOptions = useMemo(() => {
    const typeAttribute = variantAttributes.find(
      (attribute) => attribute.name === "Type",
    );
    const options = Array.isArray(typeAttribute?.options)
      ? (typeAttribute.options as string[]).filter(Boolean)
      : [];
    return options.length > 0 ? options : [...DEFAULT_LPG_TYPE_OPTIONS];
  }, [variantAttributes]);
  const kgOfOption = (variantOptionId: number) => {
    const option = availableVariants.find(
      (item) => item.id === variantOptionId,
    );
    return option ? cylinderKgOf(option) : null;
  };
  // Saved variants that are not one KG cylinder size each would be dropped
  // by the table, so those products keep the variant chips.
  const usesLpgTable =
    Boolean(adapter?.lpgVariantTable) &&
    productFamily === "lpg" &&
    defaultValues.brands.every((brand) => {
      const kgs = brand.variants.map((variant) =>
        kgOfOption(variant.variantOptionId),
      );
      return kgs.every(Boolean) && new Set(kgs).size === kgs.length;
    });
  const [lpgTables, setLpgTables] = useState<Record<number, LpgTable>>({});
  /** A brand's table: edited, else read from its saved or preset sizes. */
  const lpgTableOf = (brand: CoreProductConfigValues["brands"][number]) => {
    const edited = lpgTables[brand.brandId];
    if (edited) return edited;
    const saved = brand.variants.flatMap((variant) => {
      const kg = kgOfOption(variant.variantOptionId);
      if (!kg) return [];
      // Sizes saved before the table read as New (and Exchange if priced).
      const saleTypePrices = variant.saleTypePrices ?? {
        New: variant.retailPrice ?? "",
        ...(variant.exchangePrice ? { Exchange: variant.exchangePrice } : {}),
      };
      return [{ kg, saleTypePrices }];
    });
    return saved.length > 0
      ? lpgTableFromSizes(saved, lpgTypeOptions)
      : { rows: emptyVariantTableRows(lpgTypeOptions.length), prices: {} };
  };
  const setLpgTable = (
    brand: CoreProductConfigValues["brands"][number],
    patch: Partial<LpgTable>,
  ) => {
    setLpgTables((current) => ({
      ...current,
      [brand.brandId]: { ...lpgTableOf(brand), ...patch },
    }));
    setSaved(false);
  };
  const lpgSizeCount = (brand: CoreProductConfigValues["brands"][number]) =>
    sizeSaleTypes(lpgTableOf(brand).rows, lpgTypeOptions).length;

  /** The brands' tables as variants, creating any size not yet set up. */
  const lpgBrandVariants = async (
    brands: CoreProductConfigValues["brands"],
  ): Promise<CoreProductConfigValues["brands"] | null> => {
    for (const brand of brands) {
      const error = lpgTableError(lpgTableOf(brand), lpgTypeOptions);
      if (error) {
        const name =
          allBrands.find((item) => item.id === brand.brandId)?.name ?? "Brand";
        toast.error(brands.length > 1 ? `${name}: ${error}` : error);
        return null;
      }
    }
    const optionByKg = new Map<string, number>();
    for (const option of availableVariants) {
      const kg = cylinderKgOf(option);
      if (kg && !optionByKg.has(kg)) optionByKg.set(kg, option.id);
    }
    const result: CoreProductConfigValues["brands"] = [];
    for (const brand of brands) {
      const table = lpgTableOf(brand);
      const variants: CoreProductConfigValues["brands"][number]["variants"] =
        [];
      for (const entry of sizeSaleTypes(table.rows, lpgTypeOptions)) {
        let optionId = optionByKg.get(entry.size.value);
        if (optionId == null) {
          const created = await createSizeOption(entry.size.value);
          optionId = created.id;
          optionByKg.set(entry.size.value, optionId);
        }
        const saleTypePrices = saleTypePricesFor(entry, table.prices);
        const newPrice = saleTypePrices.New ?? "";
        // Exchange can be ordered only with both New and Exchange prices.
        const credit =
          "Exchange" in saleTypePrices
            ? exchangeCreditFrom({
                newPrice,
                exchangePrice: saleTypePrices.Exchange ?? "",
              })
            : null;
        variants.push({
          variantOptionId: optionId,
          consumerPrice: "0",
          retailPrice: newPrice,
          exchangePrice: saleTypePrices.Exchange ?? "",
          exchangeEnabled: credit !== null,
          exchangeCreditAmount: credit ?? "0",
          saleTypePrices,
        });
      }
      result.push({ ...brand, variants });
    }
    return result;
  };
  /** A KG cylinder size the table needs but no variant option has yet. */
  const createSizeOption = async (kg: string) => {
    const definition: NewVariantDefinition = {
      kind: "measurement",
      value: kg,
      measurementUnit: "KG",
      container: "cylinder",
    } as NewVariantDefinition;
    let created: VariantOption;
    if (adapter?.onCreateVariant) {
      created = await adapter.onCreateVariant(definition);
    } else {
      const typeId = core?.category?.typeId;
      if (!typeId || !core) throw new Error("This product has no Product Type");
      created = (await orpc.adminVariantOption.create.call({
        definition,
        typeId,
        categoryId: core.categoryId,
        sortOrder: 0,
        reuseExisting: true,
      })) as VariantOption;
    }
    setCreatedVariants((current) => [...current, created]);
    return created;
  };
  const [lpgSaving, setLpgSaving] = useState(false);
  const submitLpgChanges = async (status?: PublishStatus) => {
    if (lpgSaving) return;
    const submission = validateBrandCreationSubmission(
      isSingleMode ? "single" : "batch",
      form.state.values.brands.length,
    );
    if (!submission.valid) {
      toast.error(submission.message);
      return;
    }
    let brands: CoreProductConfigValues["brands"] | null;
    setLpgSaving(true);
    try {
      brands = await lpgBrandVariants(form.state.values.brands);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "The sizes could not be saved",
      );
      return;
    } finally {
      setLpgSaving(false);
    }
    if (brands) submitChanges(status, brands);
  };
  const saveChanges = (status?: PublishStatus) =>
    usesLpgTable ? void submitLpgChanges(status) : submitChanges(status);
  // Publishing: Status and (admin) Featured. Featured is sent only once it
  // is changed, so a save never clears another brand's Featured.
  const [publishStatus, setPublishStatus] = useState<PublishStatus | null>(
    null,
  );
  const [featuredChoice, setFeaturedChoice] = useState<boolean | null>(null);
  const isCylinderVariant = (variantOptionId: number) => {
    const definition = getVariantDefinition(
      availableVariants.find((option) => option.id === variantOptionId),
    );
    return (
      definition?.kind === "measurement" && definition.container === "cylinder"
    );
  };
  /** Pricing rows and values for the selected brands and variants. */
  const buildPricing = (brands: CoreProductConfigValues["brands"]) => {
    const rows: PricingRow[] = [];
    const values: Record<string, PricingValue> = {};
    for (const brand of brands) {
      const brandName =
        allBrands.find((item) => item.id === brand.brandId)?.name ??
        `Brand #${brand.brandId}`;
      for (const variant of brand.variants) {
        const key = `${brand.brandId}:${variant.variantOptionId}`;
        rows.push({
          key,
          brandId: brand.brandId,
          brandName,
          variantName:
            availableVariants.find(
              (option) => option.id === variant.variantOptionId,
            )?.name ?? `Variant #${variant.variantOptionId}`,
          exchange: isCylinderVariant(variant.variantOptionId),
        });
        values[key] = {
          newPrice: variant.retailPrice ?? "",
          exchangePrice: variant.exchangePrice ?? "",
        };
      }
    }
    return { rows, values };
  };
  const suggestDeliveryUnit = (brands: CoreProductConfigValues["brands"]) =>
    suggestDeliveryCostUnit(
      brands.flatMap((brand) =>
        brand.variants.map((variant) =>
          availableVariants.find(
            (option) => option.id === variant.variantOptionId,
          ),
        ),
      ),
    );

  const form = useForm({
    defaultValues,
    validators: {
      // Zod defaults make its input type wider than the fully initialized form.
      // @ts-expect-error TanStack Form validates the runtime value correctly.
      onSubmit: coreProductConfigSchema,
    },
    onSubmit: async ({ value }) => {
      const submission = validateBrandCreationSubmission(
        isSingleMode ? "single" : "batch",
        value.brands.length,
      );
      if (!submission.valid) {
        toast.error(submission.message);
        return;
      }
      if (adapter) {
        const pricing = buildPricing(value.brands);
        const pricingError = firstPricingError(pricing.rows, pricing.values);
        if (pricingError) {
          toast.error(pricingError);
          return;
        }
      }
      const normalizedTemplate = mergeTemplateDetails(
        value.template,
        defaultValues.template,
        core,
        productFamily,
      );
      normalizedTemplate.deliveryCostUnit =
        resolveDeliveryUnit(
          value.template.deliveryCostUnit,
          suggestDeliveryUnit(value.brands),
        ) ?? "";
      configureMutation.mutate({
        coreProductId,
        expectedVersion: configuration?.template?.version ?? null,
        details: normalizedTemplate,
        brands: value.brands.map((brand) => ({
          ...brand,
          variants: brand.variants.map((variant) => {
            // Exchange credit = New minus Exchange, only for cylinders.
            const credit = isCylinderVariant(variant.variantOptionId)
              ? exchangeCreditFrom({
                  newPrice: variant.retailPrice ?? "",
                  exchangePrice: variant.exchangePrice ?? "",
                })
              : null;
            return {
              ...variant,
              exchangeEnabled: credit !== null,
              exchangeCreditAmount: credit ?? "0",
            };
          }),
        })),
      });
    },
  });

  useEffect(() => {
    if (singleSaveVersion === 0) return;
    form.setFieldValue("brands", []);
  }, [form, singleSaveVersion]);

  useEffect(() => {
    if (!configuration) return;
    const signature = JSON.stringify(defaultValues);
    if (seededDefaultsSignature.current === signature) return;
    if (seededDefaultsSignature.current !== null && form.state.isTouched)
      return;
    form.reset(defaultValues);
    seededDefaultsSignature.current = signature;
  }, [configuration, defaultValues, form]);

  const toggleCollapsed = (brandId: number) => {
    setCollapsedBrands((current) => {
      const next = new Set(current);
      if (next.has(brandId)) next.delete(brandId);
      else next.add(brandId);
      return next;
    });
  };

  const addBrand = (brandId: number) => {
    const current = form.state.values.brands;
    if (current.some((brand) => brand.brandId === brandId)) return;

    const existing = existingByBrandId.get(brandId);
    const previousVariants = existing?.variantOptions
      .filter((option) => option.isActive)
      .map((option) => ({
        variantOptionId: option.variantOptionId,
        consumerPrice: option.consumerPrice || "0",
      }));
    const singleDefaults = resolveSingleBrandVariantDefaults({
      brandId,
      compatibleVariantOptionIds: availableVariants.map(
        (variant) => variant.id,
      ),
      adminPresetBrands:
        adapter?.presetBrands?.map((brand) => ({
          brandId: brand.brandId,
          variantOptionIds: brand.variants.map(
            (variant) => variant.variantOptionId,
          ),
        })) ?? [],
    });
    const presetBrand = adapter?.presetBrands?.find(
      (brand) => brand.brandId === brandId,
    );
    const singleVariants = singleDefaults.variantOptionIds.map(
      (variantOptionId) =>
        presetBrand?.variants.find(
          (variant) => variant.variantOptionId === variantOptionId,
        ) ?? { variantOptionId, consumerPrice: "0" },
    );

    form.setFieldValue("brands", [
      ...(isSingleMode ? [] : current),
      {
        brandId,
        variants: isSingleMode
          ? singleVariants
          : previousVariants && previousVariants.length > 0
            ? previousVariants
            : availableVariants.map((variant) => ({
                variantOptionId: variant.id,
                consumerPrice: "0",
              })),
      },
    ]);
    setBrandDialogOpen(false);
    setBrandSearch("");
    setSaved(false);
  };

  const removeBrand = (brandId: number) => {
    form.setFieldValue(
      "brands",
      form.state.values.brands.filter((brand) => brand.brandId !== brandId),
    );
    setSaved(false);
  };

  const toggleVariant = (brandId: number, variantOptionId: number) => {
    form.setFieldValue(
      "brands",
      form.state.values.brands.map((brand) => {
        if (brand.brandId !== brandId) return brand;
        const selected = brand.variants.some(
          (variant) => variant.variantOptionId === variantOptionId,
        );
        return {
          ...brand,
          variants: selected
            ? brand.variants.filter(
                (variant) => variant.variantOptionId !== variantOptionId,
              )
            : [...brand.variants, { variantOptionId, consumerPrice: "0" }],
        };
      }),
    );
    setSaved(false);
  };

  const createBrand = async (rawName: string) => {
    const name = rawName.trim();
    if (name.length < 2 || creatingBrand) return;
    setCreatingBrand(true);
    try {
      const created: BrandOption = adapter?.onCreateBrand
        ? await adapter.onCreateBrand(name)
        : await orpc.brand.create
            .call({ name, slug: slugifyBrandName(name) })
            .then((result) => result.data as BrandOption);
      setCreatedBrands((current) => [...current, created]);
      if (!adapter) {
        await queryClient.invalidateQueries({
          queryKey: orpc.brand.getAll.queryKey(),
        });
      }
      addBrand(created.id);
      toast.success(`${created.name} added`);
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

  const createVariantForBrand = async (definition: NewVariantDefinition) => {
    const brandId = variantDialogBrandId;
    const typeId = core?.category?.typeId;
    let created: VariantOption;
    if (adapter?.onCreateVariant) {
      created = await adapter.onCreateVariant(definition);
    } else {
      if (!typeId) throw new Error("This core product has no Product Type");
      created = (await orpc.adminVariantOption.create.call({
        definition,
        typeId,
        categoryId: core.categoryId,
        sortOrder: 0,
        reuseExisting: true,
      })) as VariantOption;
      await queryClient.invalidateQueries({
        queryKey: ["adminCatalogApproval", "coreProductConfigOptions"],
      });
    }
    setCreatedVariants((current) => [...current, created]);
    if (brandId != null) {
      const brand = form.state.values.brands.find(
        (item) => item.brandId === brandId,
      );
      if (
        brand &&
        !brand.variants.some((item) => item.variantOptionId === created.id)
      ) {
        toggleVariant(brandId, created.id);
      }
    }
  };

  const setBrandVariants = (brandId: number, variantOptionIds: number[]) => {
    form.setFieldValue(
      "brands",
      form.state.values.brands.map((brand) =>
        brand.brandId === brandId
          ? {
              ...brand,
              variants: variantOptionIds.map(
                (variantOptionId) =>
                  brand.variants.find(
                    (variant) => variant.variantOptionId === variantOptionId,
                  ) ?? { variantOptionId, consumerPrice: "0" },
              ),
            }
          : brand,
      ),
    );
    setSaved(false);
  };

  /**
   * Saves the form. `lpgBrands` are the Variant Table's brands, already
   * checked and turned into variants by submitLpgChanges.
   */
  const submitChanges = (
    status?: PublishStatus,
    lpgBrands?: CoreProductConfigValues["brands"],
  ) => {
    const submission = validateBrandCreationSubmission(
      isSingleMode ? "single" : "batch",
      form.state.values.brands.length,
    );
    if (!submission.valid) {
      toast.error(submission.message);
      return;
    }
    const allowedVariantIds = new Set(
      availableVariants.map((variant) => variant.id),
    );
    const unavailableSelection = !lpgBrands && form.state.values.brands.some((brand) =>
      brand.variants.some(
        (variant) => !allowedVariantIds.has(variant.variantOptionId),
      ),
    );
    if (unavailableSelection) {
      toast.error(
        adapter
          ? "Ask Admin to review the selected legacy variants, or remove them before saving."
          : "Review the selected legacy variants in Variant Setup before saving.",
      );
      return;
    }
    if (adapter && !lpgBrands) {
      const pricing = buildPricing(form.state.values.brands);
      const pricingError = firstPricingError(pricing.rows, pricing.values);
      if (pricingError) {
        toast.error(pricingError);
        return;
      }
    }
    const normalizedValues = {
      ...form.state.values,
      brands: lpgBrands ?? form.state.values.brands,
      template: {
        ...mergeTemplateDetails(
          form.state.values.template,
          defaultValues.template,
          core,
          productFamily,
        ),
        // LPG: Variant attribute 1 is Type and 2 is Size, always.
        ...(lpgBrands ? { variantAttr1: "Type", variantAttr2: "Size" } : {}),
        deliveryCostUnit:
          resolveDeliveryUnit(
            form.state.values.template.deliveryCostUnit,
            suggestDeliveryUnit(lpgBrands ?? form.state.values.brands),
          ) ?? "",
      },
    };
    const result = coreProductConfigSchema.safeParse(normalizedValues);
    if (!result.success) {
      toast.error(
        result.error.issues[0]?.message ?? "Review the brand products",
      );
      return;
    }
    configureMutation.mutate({
      coreProductId,
      expectedVersion: configuration?.template?.version ?? null,
      details: result.data.template,
      brands: result.data.brands.map((brand) => ({
        ...brand,
        variants: brand.variants.map((variant) => {
          // The Variant Table already set Exchange from its prices.
          if (lpgBrands) return variant;
          // Exchange credit = New minus Exchange, only for cylinders.
          const credit = isCylinderVariant(variant.variantOptionId)
            ? exchangeCreditFrom({
                newPrice: variant.retailPrice ?? "",
                exchangePrice: variant.exchangePrice ?? "",
              })
            : null;
          return {
            ...variant,
            exchangeEnabled: credit !== null,
            exchangeCreditAmount: credit ?? "0",
          };
        }),
      })),
      publish: {
        status: status ?? currentStatus(),
        ...(!adapter && featuredChoice !== null
          ? { featured: featuredChoice }
          : {}),
      },
    });
  };

  /** Status shown in Publishing: the one brand's saved status, else Active. */
  function currentStatus(): PublishStatus {
    if (publishStatus) return publishStatus;
    const selected = form.state.values.brands;
    const saved =
      selected.length === 1
        ? existingByBrandId.get(selected[0]!.brandId)?.status
        : undefined;
    return saved === "draft" || saved === "inactive" ? saved : "active";
  }
  function currentFeatured() {
    if (featuredChoice !== null) return featuredChoice;
    const selected = form.state.values.brands;
    return selected.length === 1
      ? Boolean(existingByBrandId.get(selected[0]!.brandId)?.isFeatured)
      : false;
  }

  if (
    adapter?.isLoading ||
    (!adapter && (configQuery.isLoading || brandsQuery.isLoading))
  ) {
    return <EditorLoading />;
  }

  if (adapter?.isError || (!adapter && configQuery.isError) || !core) {
    return <EditorError />;
  }

  return (
    <form.Subscribe selector={(state) => state.values.brands}>
      {(selectedBrands) => {
        const selectedBrandIds = new Set(
          selectedBrands.map((brand) => brand.brandId),
        );
        const availableVariantIds = new Set(
          availableVariants.map((variant) => variant.id),
        );
        const unavailableVariantIds = [
          ...new Set(
            selectedBrands.flatMap((brand) =>
              brand.variants
                .map((variant) => variant.variantOptionId)
                .filter((variantId) => !availableVariantIds.has(variantId)),
            ),
          ),
        ];
        // The Variant Table rebuilds the variants from its sizes on save.
        const hasUnavailableVariants =
          !usesLpgTable && unavailableVariantIds.length > 0;
        const singleBrandEmpty =
          selectedBrands.length !== 1 ||
          (usesLpgTable
            ? lpgSizeCount(selectedBrands[0]!) === 0
            : selectedBrands[0]?.variants.length === 0);
        const presetBrandIds = new Set(
          adapter?.presetBrands?.map((brand) => brand.brandId) ?? [],
        );
        const addableBrands = allBrands
          .filter(
            (brand) =>
              brand.isActive !== false &&
              !selectedBrandIds.has(brand.id) &&
              (!isSingleMode || !existingByBrandId.has(brand.id)) &&
              brand.name.toLowerCase().includes(brandSearch.toLowerCase()),
          )
          .sort((left, right) => {
            if (!isSingleMode) return 0;
            return (
              Number(presetBrandIds.has(right.id)) -
                Number(presetBrandIds.has(left.id)) ||
              left.name.localeCompare(right.name)
            );
          });
        const pendingDeactivations = isSingleMode
          ? []
          : existingBrands.filter(
              (brand) =>
                brand.status !== "inactive" &&
                !selectedBrandIds.has(brand.brandId),
            );
        const pendingCreations = selectedBrands.filter(
          (brand) => !existingByBrandId.has(brand.brandId),
        ).length;
        const pendingReactivations = selectedBrands.filter(
          (brand) =>
            existingByBrandId.get(brand.brandId)?.status === "inactive",
        ).length;
        const listHref = adapter?.listHref ?? PRODUCTS_BASE;
        const productEditHref =
          adapter?.productEditHref ??
          ((productId: number) => `${PRODUCTS_BASE}/${productId}/edit`);
        const pricing = buildPricing(selectedBrands);
        const suggestedDeliveryUnit = suggestDeliveryUnit(selectedBrands);
        const setVariantPrice = (key: string, patch: Partial<PricingValue>) => {
          const [brandId, variantOptionId] = key.split(":").map(Number);
          form.setFieldValue(
            "brands",
            form.state.values.brands.map((brand) =>
              brand.brandId !== brandId
                ? brand
                : {
                    ...brand,
                    variants: brand.variants.map((variant) =>
                      variant.variantOptionId !== variantOptionId
                        ? variant
                        : {
                            ...variant,
                            ...(patch.newPrice !== undefined
                              ? { retailPrice: patch.newPrice }
                              : {}),
                            ...(patch.exchangePrice !== undefined
                              ? { exchangePrice: patch.exchangePrice }
                              : {}),
                          },
                    ),
                  },
            ),
          );
          setSaved(false);
        };

        return (
          <div className="min-h-screen bg-muted/30">
            <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                  >
                    <Link href={listHref} aria-label="Back to products">
                      <ArrowLeft className="h-4 w-4" />
                    </Link>
                  </Button>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      Products <span className="opacity-50">/</span>{" "}
                      {isSingleMode ? "Add brand" : "Edit brand products"}
                    </p>
                    <div className="flex items-center gap-2">
                      <h1 className="truncate text-base font-semibold leading-tight">
                        {core.name}
                      </h1>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {isSingleMode
                          ? "One brand per save"
                          : `${selectedBrands.length} brands`}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!isSingleMode && adapter?.presetBrands && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        form.setFieldValue("brands", adapter.presetBrands!);
                        setSaved(false);
                        toast.success(
                          "Current admin preset loaded. Save to apply it.",
                        );
                      }}
                      disabled={configureMutation.isPending || lpgSaving}
                    >
                      <RotateCcw className="h-4 w-4" />
                      {adapter.reloadPresetLabel ?? "Reload preset"}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    asChild
                    disabled={configureMutation.isPending || lpgSaving}
                  >
                    <Link href={listHref}>Discard</Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    // The draft status goes with this save only, so a draft
                    // save that fails does not turn a later Publish into a
                    // draft.
                    onClick={() => saveChanges("draft")}
                    disabled={
                      (configureMutation.isPending || lpgSaving) ||
                      hasUnavailableVariants ||
                      (isSingleMode && singleBrandEmpty)
                    }
                  >
                    Save draft
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => saveChanges()}
                    disabled={
                      (configureMutation.isPending || lpgSaving) ||
                      hasUnavailableVariants ||
                      (isSingleMode && singleBrandEmpty)
                    }
                  >
                    {(configureMutation.isPending || lpgSaving) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Publish
                  </Button>
                </div>
              </div>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                saveChanges();
              }}
            >
              <div className="mx-auto max-w-[1500px] px-4 py-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.62fr)_minmax(420px,1fr)] lg:items-start">
                  <div className="divide-y rounded-xl border bg-card">
                    <ProductEditorSection
                      title="Product Information"
                      description="The core product this listing is based on."
                    >
                      {/* Display name and slug are not shown: like admin
                          Create Product, they come from the core identity. */}
                      {adapter?.renderIdentity ? (
                        adapter.renderIdentity(core)
                      ) : (
                        <ProductIdentityFields
                          type={core.category?.type?.name}
                          category={core.category?.name}
                          subCategory={core.subCategory?.name}
                          coreIdentity={core.name}
                        />
                      )}
                    </ProductEditorSection>

                    <ProductEditorSection
                      title={
                        usesLpgTable
                          ? isSingleMode
                            ? "Brand and Variant Table"
                            : "Brands and Variant Tables"
                          : isSingleMode
                            ? "Brand and variants"
                            : "Brands and variants"
                      }
                      description={
                        usesLpgTable
                          ? "Pick the brand, then tick how each size is sold (New, Exchange, Refill...) and type its sizes in KG."
                          : isSingleMode
                            ? "Choose one new brand. Admin preset variants are editable suggestions for this save."
                            : "Choose each brand's variants. Prices are managed in Product Price."
                      }
                      action={
                        (!isSingleMode || selectedBrands.length === 0) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => setBrandDialogOpen(true)}
                          >
                            <Plus className="h-4 w-4" />
                            Add brand
                          </Button>
                        )
                      }
                    >
                      {hasUnavailableVariants && (
                        <div className="mb-4 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <div className="min-w-0 space-y-1">
                            <p className="text-sm font-semibold">
                              Variant definition required
                            </p>
                            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                              {adapter
                                ? "One or more selected variants must be reviewed by Admin before these products can be saved. Remove them or ask Admin to add a concrete definition."
                                : "One or more selected variants still use the legacy loose setup. Review them in Variant Setup, then return here to save this configuration."}
                            </p>
                            {!adapter && (
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="mt-2 h-7 border-amber-400 bg-white/70 text-amber-950 hover:bg-white dark:bg-transparent dark:text-amber-100"
                              >
                                <Link href="/dashboard/admin/variant-options">
                                  Review variants
                                  <ArrowUpRight className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                      {selectedBrands.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-6 text-center">
                          <p className="text-sm font-medium">
                            No brand selected
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Add a brand to start configuring its variants.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-4"
                            onClick={() => setBrandDialogOpen(true)}
                          >
                            <Plus className="h-4 w-4" />
                            Add brand
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedBrands.map((selectedBrand) => {
                            const brand = allBrands.find(
                              (item) => item.id === selectedBrand.brandId,
                            );
                            if (!brand) return null;
                            const existingBrand = existingByBrandId.get(
                              brand.id,
                            );
                            const blockedVariants = selectedBrand.variants
                              .filter(
                                (variant) =>
                                  !availableVariantIds.has(
                                    variant.variantOptionId,
                                  ),
                              )
                              .map((variant) => ({
                                id: variant.variantOptionId,
                                name:
                                  existingBrand?.variantOptions.find(
                                    (option) =>
                                      option.variantOptionId ===
                                      variant.variantOptionId,
                                  )?.variantOptionName ??
                                  `Variant #${variant.variantOptionId}`,
                              }));

                            return (
                              <BrandEditorCard
                                key={brand.id}
                                brand={brand}
                                existing={existingBrand}
                                selectedVariants={selectedBrand.variants}
                                variants={filterVariantsForBrand(
                                  availableVariants,
                                  EMPTY_VARIANT_FILTER,
                                  selectedBrand.variants.map(
                                    (variant) => variant.variantOptionId,
                                  ),
                                )}
                                blockedVariants={blockedVariants}
                                expanded={!collapsedBrands.has(brand.id)}
                                onToggleExpanded={() =>
                                  toggleCollapsed(brand.id)
                                }
                                onRemove={() => removeBrand(brand.id)}
                                onToggleVariant={(variantId) =>
                                  toggleVariant(brand.id, variantId)
                                }
                                onSetVariants={(variantIds) =>
                                  setBrandVariants(brand.id, variantIds)
                                }
                                onAddVariant={() =>
                                  setVariantDialogBrandId(brand.id)
                                }
                                summary={
                                  usesLpgTable
                                    ? `${lpgSizeCount(selectedBrand)} size${
                                        lpgSizeCount(selectedBrand) === 1
                                          ? ""
                                          : "s"
                                      } in the Variant Table`
                                    : undefined
                                }
                                body={
                                  usesLpgTable ? (
                                    <LpgVariantTable
                                      typeOptions={lpgTypeOptions}
                                      rows={lpgTableOf(selectedBrand).rows}
                                      onRowsChange={(rows) =>
                                        setLpgTable(selectedBrand, { rows })
                                      }
                                    />
                                  ) : undefined
                                }
                              />
                            );
                          })}
                        </div>
                      )}
                    </ProductEditorSection>

                    <SharedTemplateEditor
                      form={form}
                      defaults={defaultValues.template}
                      part="content"
                    />

                    {adapter && (
                      <ProductEditorSection
                        title="Pricing"
                        description="Optional. Sets your selling price; you can also set it later in Pricing."
                      >
                        {usesLpgTable ? (
                          <div className="space-y-5">
                            {selectedBrands.map((selectedBrand) => {
                              const table = lpgTableOf(selectedBrand);
                              return (
                                <div key={selectedBrand.brandId}>
                                  {selectedBrands.length > 1 && (
                                    <h3 className="mb-2 text-sm font-medium">
                                      {allBrands.find(
                                        (item) =>
                                          item.id === selectedBrand.brandId,
                                      )?.name ?? "Brand"}
                                    </h3>
                                  )}
                                  <LpgVariantPricing
                                    entries={sizeSaleTypes(
                                      table.rows,
                                      lpgTypeOptions,
                                    )}
                                    prices={table.prices}
                                    onPriceChange={(key, value) =>
                                      setLpgTable(selectedBrand, {
                                        prices: { ...table.prices, [key]: value },
                                      })
                                    }
                                  />
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <ProductPricingTable
                            rows={pricing.rows}
                            values={pricing.values}
                            onChange={setVariantPrice}
                          />
                        )}
                      </ProductEditorSection>
                    )}
                  </div>

                  <aside className="space-y-4">
                    <ProductEditorSection
                      variant="card"
                      title="Inventory & Product Rules"
                      className="px-4 py-5 sm:px-5"
                    >
                      <form.Subscribe
                        selector={(state) => state.values.template}
                      >
                        {(template) => (
                          <ClientRulesGrid
                            values={clientRuleValues(template)}
                            onChange={(patch) => {
                              for (const [key, value] of Object.entries(
                                patch,
                              )) {
                                form.setFieldValue(
                                  `template.${key}` as any,
                                  value as any,
                                );
                              }
                              setSaved(false);
                            }}
                            attributes={variantAttributes}
                            attributesLocked={usesLpgTable}
                          />
                        )}
                      </form.Subscribe>
                    </ProductEditorSection>

                    <ProductEditorSection
                      variant="card"
                      title="Delivery Cost Configuration"
                      className="px-4 py-5 sm:px-5"
                    >
                      <form.Subscribe
                        selector={(state) => state.values.template}
                      >
                        {(template) => {
                          const method = isDeliveryCostMethod(
                            template.deliveryCostMethod,
                          )
                            ? template.deliveryCostMethod
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
                                      "template.deliveryCostMethod",
                                      next as any,
                                    )
                                  }
                                />
                              </Field>
                              <Field>
                                <FieldLabel>
                                  Default delivery cost (৳)
                                </FieldLabel>
                                <Input
                                  inputMode="decimal"
                                  placeholder="Enter default cost"
                                  value={template.defaultDeliveryCost ?? ""}
                                  onChange={(event) => {
                                    const next = event.target.value.trim();
                                    if (/^\d{0,8}(\.\d{0,2})?$/.test(next)) {
                                      form.setFieldValue(
                                        "template.defaultDeliveryCost",
                                        next,
                                      );
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
                    </ProductEditorSection>

                    <ProductEditorSection
                      variant="card"
                      title="Publishing"
                      className="px-4 py-5 sm:px-5"
                    >
                      <div className="space-y-4">
                        <Field>
                          <FieldLabel>Status</FieldLabel>
                          <Select
                            value={currentStatus()}
                            onValueChange={(value) =>
                              value && setPublishStatus(value as PublishStatus)
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <form.Field name="template.visibility">
                          {(field) => (
                            <Field>
                              <FieldLabel>Visibility</FieldLabel>
                              <Select
                                value={
                                  field.state.value ||
                                  defaultValues.template.visibility
                                }
                                onValueChange={(value) =>
                                  value &&
                                  field.handleChange(
                                    value as "public" | "private" | "unlisted",
                                  )
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="public">Public</SelectItem>
                                  <SelectItem value="private">
                                    Private
                                  </SelectItem>
                                  <SelectItem value="unlisted">
                                    Unlisted
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                {VISIBILITY_HELP[field.state.value || "public"] ??
                                  VISIBILITY_HELP.public}
                              </p>
                            </Field>
                          )}
                        </form.Field>
                        {!adapter && (
                          <>
                            <Separator />
                            <FeaturedCheckbox
                              checked={currentFeatured()}
                              onChange={setFeaturedChoice}
                            />
                          </>
                        )}
                      </div>
                    </ProductEditorSection>
                    <div className="rounded-xl border bg-card p-4">
                      <FinalActions
                        cancelHref={listHref}
                        onSaveDraft={() => {
                          setPublishStatus("draft");
                          saveChanges("draft");
                        }}
                        onPublish={() => saveChanges()}
                        publishLabel="Publish"
                        pending={configureMutation.isPending || lpgSaving}
                        disabled={
                          hasUnavailableVariants ||
                          (isSingleMode && singleBrandEmpty)
                        }
                      />
                    </div>
                    <div className="rounded-xl border bg-card">
                      <div className="border-b px-4 py-3">
                        <h2 className="text-sm font-semibold">Changes</h2>
                      </div>
                      <div className="space-y-3 p-4">
                        <ImpactRow
                          label="New products"
                          value={pendingCreations}
                        />
                        <ImpactRow
                          label="Will reactivate"
                          value={pendingReactivations}
                        />
                        <ImpactRow
                          label="Will deactivate"
                          value={pendingDeactivations.length}
                        />

                        {pendingDeactivations.length > 0 && (
                          <div className="border-t pt-3">
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              Removed brands keep their product data and can be
                              reactivated later.
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {pendingDeactivations.map((brand) => (
                                <span
                                  key={brand.brandId}
                                  className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400"
                                >
                                  {brand.brandName}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {existingBrands.length > 0 && !isSingleMode && (
                      <div className="rounded-xl border bg-card">
                        <div className="border-b px-4 py-3">
                          <h2 className="text-sm font-semibold">
                            Generated products
                          </h2>
                        </div>
                        <div className="space-y-1 p-2">
                          {existingBrands.map((brand) => (
                            <Link
                              key={brand.productId}
                              href={productEditHref(brand.productId)}
                              className="group flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {brand.productName}
                                </p>
                                <p className="text-xs capitalize text-muted-foreground">
                                  {brand.status}
                                </p>
                              </div>
                              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {saved && (
                      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                        <p className="text-sm">Changes saved successfully.</p>
                      </div>
                    )}
                  </aside>
                </div>
              </div>
            </form>

            <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Select brand</DialogTitle>
                  <DialogDescription>
                    {isSingleMode
                      ? "Choose one brand that has not been configured yet."
                      : "New brands create products; removed brands reuse their existing product."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={brandSearch}
                      onChange={(event) => setBrandSearch(event.target.value)}
                      placeholder="Search or create a brand..."
                      className="pl-9"
                      autoFocus
                    />
                  </div>
                  <div className="-mx-1 max-h-[300px] space-y-1 overflow-y-auto px-1">
                    {(() => {
                      const typed = brandSearch.trim();
                      const exists = allBrands.some(
                        (brand) =>
                          brand.name.toLowerCase() === typed.toLowerCase(),
                      );
                      if (typed.length < 2 || exists) return null;
                      return (
                        <button
                          type="button"
                          disabled={creatingBrand}
                          onClick={() => void createBrand(typed)}
                          className="flex w-full items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-left transition-colors hover:bg-muted/80 disabled:opacity-60"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            {creatingBrand ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              Create brand “{typed}”
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {adapter
                                ? "Only your store will see this brand."
                                : "Adds a new brand to the catalog."}
                            </p>
                          </div>
                        </button>
                      );
                    })()}
                    {addableBrands.length > 0 ? (
                      addableBrands.map((brand) => {
                        const existing = existingByBrandId.get(brand.id);
                        const isAdminPreset = presetBrandIds.has(brand.id);
                        return (
                          <button
                            key={brand.id}
                            type="button"
                            onClick={() => addBrand(brand.id)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/80"
                          >
                            <BrandMark brand={brand} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {brand.name}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                <span>
                                  {existing?.status === "inactive"
                                    ? "Reactivate existing product"
                                    : "Create independent product"}
                                </span>
                                {isAdminPreset && (
                                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                                    Admin preset
                                  </span>
                                )}
                              </div>
                            </div>
                            {existing?.status === "inactive" && (
                              <RotateCcw className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        {brandSearch.trim().length >= 2
                          ? "No other matching brands."
                          : "No matching brands are available. Type a name to create one."}
                      </p>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <AddVariantDialog
              open={variantDialogBrandId !== null}
              onOpenChange={(open) => {
                if (!open) setVariantDialogBrandId(null);
              }}
              family={productFamily}
              scopeLabel={
                adapter?.variantScopeLabel ??
                "Adds a variant for this core product's category. It is selected for this brand."
              }
              onCreate={createVariantForBrand}
            />
          </div>
        );
      }}
    </form.Subscribe>
  );
}

function BrandEditorCard({
  brand,
  existing,
  selectedVariants,
  variants,
  blockedVariants,
  expanded,
  onToggleExpanded,
  onRemove,
  onToggleVariant,
  onSetVariants,
  onAddVariant,
  body,
  summary,
}: {
  onAddVariant: () => void;
  /** Replaces the variant chips (the LPG Variant Table). */
  body?: ReactNode;
  /** Replaces "N variants selected". */
  summary?: string;
  brand: BrandOption;
  existing?: ExistingBrandProduct;
  selectedVariants: SelectedVariant[];
  variants: VariantOption[];
  blockedVariants: Array<{ id: number; name: string }>;
  expanded: boolean;
  onToggleExpanded: () => void;
  onRemove: () => void;
  onToggleVariant: (variantId: number) => void;
  onSetVariants: (variantIds: number[]) => void;
}) {
  const selectedVariantIds = selectedVariants.map(
    (variant) => variant.variantOptionId,
  );
  const allSelected =
    variants.length > 0 && selectedVariants.length === variants.length;
  const state = !existing
    ? "new"
    : existing.status === "inactive"
      ? "reactivate"
      : "active";

  return (
    <div className="rounded-lg border bg-card">
      <div className="group flex items-center gap-3 p-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={onToggleExpanded}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <BrandMark brand={brand} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold">{brand.name}</p>
              <StatePill state={state} />
            </div>
            <p className="text-xs text-muted-foreground">
              {summary ??
                `${selectedVariants.length} variant${
                  selectedVariants.length === 1 ? "" : "s"
                } selected`}
            </p>
          </div>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive/60 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          aria-label={`Remove ${brand.name}`}
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {expanded && body ? (
        <>
          <Separator />
          <div className="p-3">{body}</div>
        </>
      ) : null}
      {expanded && !body && (
        <>
          <Separator />
          <div className="space-y-3 p-3">
            {blockedVariants.length > 0 && (
              <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                <p className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-100">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Definition required before saving
                </p>
                <div className="flex flex-wrap gap-2">
                  {blockedVariants.map((variant) => (
                    <span
                      key={variant.id}
                      className="rounded-full border border-amber-300 bg-white/70 px-2.5 py-1 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100"
                    >
                      {variant.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {variants.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                <span>No variants yet for this product.</span>
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
                        allSelected
                          ? []
                          : variants.map((variant) => variant.id),
                      )
                    }
                  >
                    {allSelected ? "Clear all" : "Select all"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {variants.map((variant) => {
                    const selected = selectedVariantIds.includes(variant.id);
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => onToggleVariant(variant.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                          selected
                            ? "border-primary bg-primary/10 font-medium text-primary"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {selected && <Check className="h-3.5 w-3.5" />}
                        <span>{variant.name}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={onAddVariant}
                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary/5"
                    aria-label={`Add a new variant for ${brand.name}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Variant</span>
                  </button>
                </div>
              </>
            )}

            {selectedVariants.length === 0 && (
              <p className="text-xs font-medium text-destructive">
                Select at least one variant before saving.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function BrandMark({ brand }: { brand: BrandOption }) {
  if (brand.logo) {
    return (
      <Image
        src={brand.logo}
        alt={brand.name}
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 rounded-md border object-cover"
      />
    );
  }

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
      {brand.name.charAt(0).toUpperCase()}
    </span>
  );
}

function StatePill({ state }: { state: "new" | "reactivate" | "active" }) {
  const styles = {
    new: "bg-primary/10 text-primary",
    reactivate: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
    active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  };
  const labels = { new: "New", reactivate: "Reactivate", active: "Active" };

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[state]}`}
    >
      {labels[state]}
    </span>
  );
}

function ImpactRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function EditorLoading() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-muted/30">
      <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div>
          <p className="text-sm font-medium">Loading brand products</p>
          <p className="text-xs text-muted-foreground">
            Mapping brands and variant options…
          </p>
        </div>
      </div>
    </div>
  );
}

function EditorError() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center">
        <h1 className="text-base font-semibold">Core product unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          These brand products could not be loaded. They may have been removed.
        </p>
        <Button className="mt-5" variant="outline" size="sm" asChild>
          <Link href={PRODUCTS_BASE}>Back to products</Link>
        </Button>
      </div>
    </div>
  );
}

function filterVariantsForCore(
  core:
    | {
        categoryId: number;
        category?: { typeId?: number | null } | null;
      }
    | undefined,
  variants: VariantOption[],
) {
  if (!core) return [];
  const typeId = core.category?.typeId ?? null;

  return variants
    .filter((variant) => {
      if (
        variant.isActive === false ||
        variant.needsReview ||
        !variant.definition ||
        !variant.definitionKind
      ) {
        return false;
      }
      const isGlobal = variant.typeId == null && variant.categoryId == null;
      const isTypeWide =
        variant.typeId === typeId && variant.categoryId == null;
      const isCategoryScoped =
        variant.typeId === typeId && variant.categoryId === core.categoryId;
      return isGlobal || isTypeWide || isCategoryScoped;
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

/** The Inventory Unit an older product implies from its variants' Type. */
function defaultInventoryUnit(family: string) {
  return family === "lpg" ? "cyl" : "pcs";
}

function normalizeTemplateDetails(
  details: Partial<CoreProductConfigValues["template"]> | undefined,
  core: any,
  family: string,
): CoreProductConfigValues["template"] {
  const expiryEnabled = details?.expiryEnabled ?? false;
  const deliveryCostMethod = isDeliveryCostMethod(details?.deliveryCostMethod)
    ? details.deliveryCostMethod
    : (deliveryMethodFromUnit(details?.deliveryCostUnit) ?? "free");
  return {
    name: details?.name?.trim() || core?.name?.trim() || "Product",
    description: details?.description ?? "",
    shortDescription: details?.shortDescription ?? "",
    videoUrl: details?.videoUrl ?? "",
    image: details?.image || core?.image || "",
    additionalImages: details?.additionalImages ?? [],
    features: details?.features ?? [],
    trackingType: expiryEnabled ? "batch" : details?.trackingType || "none",
    // The client's defaults: Return, Damage and Minimum Order (1) on.
    returnPolicyEnabled: details?.returnPolicyEnabled ?? true,
    expiryEnabled,
    damageControlEnabled: details?.damageControlEnabled ?? true,
    stockTrackingEnabled: details?.stockTrackingEnabled ?? true,
    minimumOrderEnabled: details?.minimumOrderEnabled ?? true,
    minimumOrderQty: String(details?.minimumOrderQty ?? "1"),
    conversionEnabled: details?.conversionEnabled ?? false,
    conversionRule: details?.conversionRule ?? "",
    inventoryLooseUnitEnabled: details?.inventoryLooseUnitEnabled ?? false,
    inventoryLooseUnit: details?.inventoryLooseUnit || "kg",
    inventoryUnit: details?.inventoryUnit || defaultInventoryUnit(family),
    isReturnablePack: details?.isReturnablePack ?? false,
    defaultPackDepositAmount: String(details?.defaultPackDepositAmount ?? "0"),
    deliveryCostUnit: details?.deliveryCostUnit ?? "",
    deliveryCostMethod,
    defaultDeliveryCost: priceInputValue(details?.defaultDeliveryCost),
    variantAttr1:
      details?.variantAttr1 ?? (family === "lpg" ? "Type" : ""),
    variantAttr2:
      details?.variantAttr2 ?? (family === "lpg" ? "Size" : ""),
    visibility: details?.visibility ?? "public",
  } as CoreProductConfigValues["template"];
}

function mergeTemplateDetails(
  current: Partial<CoreProductConfigValues["template"]>,
  defaults: CoreProductConfigValues["template"],
  core: any,
  family: string,
) {
  const merged = normalizeTemplateDetails(
    {
      ...defaults,
      ...current,
      trackingType: current.trackingType || defaults.trackingType,
      inventoryLooseUnit:
        current.inventoryLooseUnit || defaults.inventoryLooseUnit,
    },
    core,
    family,
  );
  // Conversion text is kept only while Conversion is on.
  if (!merged.conversionEnabled) merged.conversionRule = "";
  // The name comes from the core identity (Display name is not shown);
  // the server puts the brand in front.
  if (core?.name?.trim()) merged.name = core.name.trim();
  return merged;
}

/** The template's rule fields in the client's grid shape. */
function clientRuleValues(
  template: CoreProductConfigValues["template"],
): ClientRuleValues {
  return {
    variantAttr1: template.variantAttr1 ?? "",
    variantAttr2: template.variantAttr2 ?? "",
    inventoryUnit: template.inventoryUnit ?? "",
    inventoryLooseUnitEnabled: template.inventoryLooseUnitEnabled,
    inventoryLooseUnit: template.inventoryLooseUnit,
    conversionEnabled: template.conversionEnabled,
    conversionRule: template.conversionRule ?? "",
    returnPolicyEnabled: template.returnPolicyEnabled,
    isReturnablePack: template.isReturnablePack,
    defaultPackDepositAmount: template.defaultPackDepositAmount,
    trackingType: template.trackingType,
    damageControlEnabled: template.damageControlEnabled,
    expiryEnabled: template.expiryEnabled,
    minimumOrderEnabled: template.minimumOrderEnabled,
    minimumOrderQty: template.minimumOrderQty,
    deliveryCostMethod: template.deliveryCostMethod ?? "",
  };
}

function SharedTemplateEditor({
  form,
  part,
}: {
  form: any;
  defaults: CoreProductConfigValues["template"];
  part: "content";
}) {
  return (
    <>
      {part === "content" && (
      <ProductEditorSection
        title="Description"
        description="How this product appears to customers."
      >
        <div className="space-y-4">
          <form.Field name="template.shortDescription">
            {(field: any) => (
              <Field>
                <FieldLabel className="flex items-center justify-between">
                  <span>Short description</span>
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">
                    {Math.min(
                      (field.state.value ?? "").length,
                      SHORT_DESCRIPTION_LIMIT,
                    )}
                    /{SHORT_DESCRIPTION_LIMIT}
                  </span>
                </FieldLabel>
                <Textarea
                  rows={2}
                  maxLength={SHORT_DESCRIPTION_LIMIT}
                  value={field.state.value ?? ""}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Write a concise product summary (maximum 160 characters)"
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="template.description">
            {(field: any) => (
              <Field>
                <FieldLabel>Full description</FieldLabel>
                <RichTextEditor
                  value={field.state.value ?? ""}
                  onChange={field.handleChange}
                  placeholder="Describe product features, usage, specifications and benefits..."
                />
                <p className="text-xs text-muted-foreground">
                  Recommended: 50–1,000 words. Basic formatting toolbar
                  included.
                </p>
              </Field>
            )}
          </form.Field>
        </div>
      </ProductEditorSection>
      )}

      {part === "content" && (
      <>
      <ProductEditorSection
        title="Media"
        description="Images and video for this product."
      >
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <form.Field name="template.image">
              {(field: any) => (
                <Field>
                  <FieldLabel>Thumbnail / main image</FieldLabel>
                  <ImageUploader
                    value={field.state.value}
                    onChange={field.handleChange}
                    folder="products"
                    maxSizeMB={5}
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="template.additionalImages">
              {(field: any) => (
                <Field>
                  <FieldLabel>Gallery (up to 6 images)</FieldLabel>
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
          <form.Field name="template.videoUrl">
            {(field: any) => (
              <Field>
                <FieldLabel>Video URL</FieldLabel>
                <Input
                  value={field.state.value ?? ""}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                />
              </Field>
            )}
          </form.Field>
        </div>
      </ProductEditorSection>
      </>
      )}
    </>
  );
}
