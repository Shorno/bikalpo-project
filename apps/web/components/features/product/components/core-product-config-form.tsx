"use client";

import { resolveSingleBrandVariantDefaults } from "@bikalpo-project/db/brand-creation";
import { inferProductTypeFamily } from "@bikalpo-project/db/fulfillment";
import {
  DELIVERY_COST_METHODS,
  deliveryMethodFromUnit,
  isDeliveryCostMethod,
} from "@bikalpo-project/db/product-client-options";
import { suggestDeliveryCostUnit } from "@bikalpo-project/db/product-delivery";
import {
  getVariantDefinition,
  type VariantDefinition,
} from "@bikalpo-project/db/variant-definition";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Loader2,
  Plus,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import AdditionalImagesUploader from "@/components/AdditionalImagesUploader";
import ImageUploader from "@/components/ImageUploader";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  type CoreProductConfigValues,
  coreProductConfigSchema,
} from "@/schema/core-product-config.schema";
import { orpc } from "@/utils/orpc";
import {
  exchangeCreditFrom,
  exchangePriceFrom,
  priceInputValue,
  resolveDeliveryUnit,
} from "./product-delivery-pricing";
import {
  ClientRulesGrid,
  FeaturedCheckbox,
  type ClientRuleValues,
  DeliveryMethodSelect,
  VISIBILITY_HELP,
} from "./product-rules-grid";
import {
  EMPTY_VARIANT_MATRIX,
  type MatrixVariant,
  matrixFromVariants,
  matrixVariants,
  sameDefinition,
  type VariantMatrix,
  VariantPricing,
  VariantTable,
} from "./product-variant-matrix";

const PRODUCTS_BASE = "/dashboard/admin/products";
const SHORT_DESCRIPTION_LIMIT = 160;

export type PublishStatus = "active" | "draft" | "inactive";

/** What a save sends: the form values plus Publishing for the saved brand. */
export type CoreProductConfigSubmit = CoreProductConfigValues & {
  publish?: { brandId: number; status: PublishStatus; featured?: boolean };
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
    variantAliases?: Record<number, string>;
    onVariantAliasChange?: (variantOptionId: number, alias: string) => void;
    /** "+ Add brand" with a new name; sellers get a store-only brand. */
    onCreateBrand?: (name: string) => Promise<BrandOption>;
    /** Variants the matrix needs that do not exist yet; store-only for sellers. */
    onCreateVariant?: (definition: VariantDefinition) => Promise<VariantOption>;
    variantScopeLabel?: string;
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
    exchangeEnabled?: boolean;
    exchangeCreditAmount?: string | null;
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

type BrandVariant = CoreProductConfigValues["brands"][number]["variants"][number];

export default function CoreProductConfigForm({
  coreProductId,
  adapter,
}: CoreProductConfigFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const seededDefaultsSignature = useRef<string | null>(null);
  // Brands/variants created here show at once, before the lists refetch.
  const [createdBrands, setCreatedBrands] = useState<BrandOption[]>([]);
  const [createdVariants, setCreatedVariants] = useState<VariantOption[]>([]);
  const [creatingBrand, setCreatingBrand] = useState(false);
  const [saving, setSaving] = useState(false);
  // The one brand this form edits (the client's single Brand field).
  const [brandId, setBrandId] = useState<number | null>(null);
  const [brandInput, setBrandInput] = useState("");
  const [matrix, setMatrix] = useState<VariantMatrix>(EMPTY_VARIANT_MATRIX);
  const [status, setStatus] = useState<PublishStatus>("active");
  const [featured, setFeatured] = useState(false);

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
  const attributesQuery = useQuery(orpc.variantAttribute.list.queryOptions());
  const attributes = (attributesQuery.data ?? []) as Array<{
    name: string;
    options: string[];
  }>;

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
  const loadedVariants =
    adapter?.variantOptions ??
    ((catalogOptionsQuery.data?.variantOptions ?? []) as VariantOption[]);
  const knownVariants = useMemo(
    () => [
      ...loadedVariants,
      ...createdVariants.filter(
        (created) => !loadedVariants.some((variant) => variant.id === created.id),
      ),
    ],
    [loadedVariants, createdVariants],
  );
  const availableVariants = useMemo(
    () => filterVariantsForCore(core, knownVariants),
    [core, knownVariants],
  );
  const productFamily = core?.category?.type
    ? inferProductTypeFamily(core.category.type)
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
                  retailPrice: priceInputValue(option.consumerPrice),
                  exchangePrice: option.exchangeEnabled
                    ? exchangePriceFrom(
                        option.consumerPrice,
                        option.exchangeCreditAmount,
                      )
                    : "",
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
      productFamily,
    ],
  );

  const form = useForm({ defaultValues });

  useEffect(() => {
    if (!configuration) return;
    const signature = JSON.stringify(defaultValues);
    if (seededDefaultsSignature.current === signature) return;
    if (seededDefaultsSignature.current !== null && form.state.isTouched)
      return;
    form.reset(defaultValues);
    seededDefaultsSignature.current = signature;
  }, [configuration, defaultValues, form]);

  const configureMutation = useMutation({
    mutationFn: (input: {
      coreProductId: number;
      expectedVersion: number | null;
      details: CoreProductConfigValues["template"];
      brands: CoreProductConfigValues["brands"];
      publish: CoreProductConfigSubmit["publish"];
    }) =>
      adapter
        ? adapter.onConfigure({
            template: input.details,
            brands: input.brands,
            publish: input.publish,
          })
        : orpc.adminProductConfig.configure.call(input),
    onSuccess: async (_result, input) => {
      toast.success(
        input.publish?.status === "draft"
          ? "Draft saved"
          : "Product published successfully",
      );
      if (adapter) {
        await adapter.onSaved?.();
        return;
      }
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
      if (isSingleMode) router.push(`${PRODUCTS_BASE}/core/${coreProductId}`);
    },
    onError: (error) => {
      toast.error(error.message || "Could not save product changes");
    },
  });

  const optionOf = (variantOptionId: number) =>
    knownVariants.find((option) => option.id === variantOptionId);

  /** Saved variants of a brand, as the matrix shows them. */
  const matrixForBrand = (variants: BrandVariant[]) =>
    matrixFromVariants(
      variants.map((variant) => ({
        option: optionOf(variant.variantOptionId),
        newPrice: variant.retailPrice ?? "",
        exchangePrice: variant.exchangePrice ?? "",
      })),
    );

  /** The two Variant Attributes for a brand that has none saved. */
  const attributesFor = (variants: BrandVariant[]) => {
    const template = form.state.values.template;
    if (template.variantAttr1 && template.variantAttr2) return null;
    const definitions = variants
      .map((variant) => getVariantDefinition(optionOf(variant.variantOptionId)))
      .filter(Boolean) as VariantDefinition[];
    if (definitions.length === 0) return null;
    const combo = definitions.find(
      (definition) =>
        definition.kind === "attribute" && definition.attribute.includes(" / "),
    );
    if (combo && combo.kind === "attribute") {
      const [first, second] = combo.attribute.split(" / ");
      return { variantAttr1: first ?? "", variantAttr2: second ?? "" };
    }
    const measured = definitions.find(
      (definition) => definition.kind === "measurement",
    );
    const unit =
      measured?.kind === "measurement"
        ? measured.measurementUnit.toLowerCase()
        : "";
    return {
      variantAttr1: "Type",
      variantAttr2:
        productFamily === "lpg" || !measured
          ? "Size"
          : unit === "l" || unit === "ml" || unit.startsWith("lit")
            ? "Capacity"
            : "Weight",
    };
  };

  const selectBrand = (id: number) => {
    const current = form.state.values.brands;
    let variants = current.find((brand) => brand.brandId === id)?.variants;
    if (!variants) {
      const existing = existingByBrandId.get(id);
      const previous = existing?.variantOptions
        .filter((option) => option.isActive)
        .map((option) => ({
          variantOptionId: option.variantOptionId,
          consumerPrice: option.consumerPrice || "0",
        }));
      if (previous && previous.length > 0) {
        variants = previous;
      } else {
        const preset = resolveSingleBrandVariantDefaults({
          brandId: id,
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
        variants = preset.variantOptionIds.map((variantOptionId) => ({
          variantOptionId,
          consumerPrice: "0",
        }));
      }
      form.setFieldValue("brands", [
        ...(isSingleMode ? [] : current),
        { brandId: id, variants },
      ]);
    }
    const attributesPatch = attributesFor(variants);
    if (attributesPatch) {
      form.setFieldValue("template.variantAttr1", attributesPatch.variantAttr1);
      form.setFieldValue("template.variantAttr2", attributesPatch.variantAttr2);
    }
    setMatrix(matrixForBrand(variants));
    const existing = existingByBrandId.get(id);
    setStatus(
      existing && ["active", "draft", "inactive"].includes(existing.status)
        ? (existing.status as PublishStatus)
        : "active",
    );
    setFeatured(Boolean(existing?.isFeatured));
    setBrandId(id);
    setBrandInput("");
  };

  /** Remove clears the field; a brand added here (not saved yet) is dropped. */
  const clearBrand = () => {
    if (brandId !== null && !existingByBrandId.has(brandId)) {
      form.setFieldValue(
        "brands",
        form.state.values.brands.filter((brand) => brand.brandId !== brandId),
      );
    }
    setBrandId(null);
    setMatrix(EMPTY_VARIANT_MATRIX);
  };

  const createBrand = async (name: string) => {
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
      selectBrand(created.id);
      toast.success("Brand saved");
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

  /** "+ Add brand": pick a listed brand, or create the typed one. */
  const saveBrandInput = (allowCreate: boolean) => {
    const name = brandInput.trim();
    if (!name || creatingBrand) return;
    const match = allBrands.find(
      (brand) =>
        brand.isActive !== false &&
        brand.name.toLowerCase() === name.toLowerCase(),
    );
    if (match) {
      if (isSingleMode && existingByBrandId.has(match.id)) {
        toast.error(`${match.name} is already added for this product`);
        return;
      }
      selectBrand(match.id);
      return;
    }
    if (!allowCreate) return;
    if (name.length < 2) {
      toast.error("Enter a brand name");
      return;
    }
    void createBrand(name);
  };

  /** An existing variant option with this structure, or a new one. */
  const resolveVariantOption = async (
    definition: VariantDefinition,
  ): Promise<VariantOption> => {
    const found = availableVariants.find((option) =>
      sameDefinition(option, definition),
    );
    if (found) return found;
    let created: VariantOption;
    if (adapter?.onCreateVariant) {
      created = await adapter.onCreateVariant(definition);
    } else {
      const typeId = core?.category?.typeId;
      if (!typeId) throw new Error("This core product has no Product Type");
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

  const save = async (mode: "draft" | "publish") => {
    if (saving || configureMutation.isPending) return;
    const template = form.state.values.template;
    if (!template.name.trim()) {
      toast.error("Enter a product name before saving");
      return;
    }
    if (brandId === null) {
      toast.error("No brand selected. Add one brand to continue.");
      return;
    }
    const brandVariants =
      form.state.values.brands.find((brand) => brand.brandId === brandId)
        ?.variants ?? [];
    const unresolved = brandVariants.filter(
      (variant) => !getVariantDefinition(optionOf(variant.variantOptionId)),
    );
    if (unresolved.length > 0) {
      toast.error(
        adapter
          ? "Ask Admin to review this brand's older variants before saving."
          : "Review this brand's older variants in Variant Setup before saving.",
      );
      return;
    }
    const { variants: wanted, error } = matrixVariants(matrix, {
      attr1: template.variantAttr1,
      attr2: template.variantAttr2,
      inventoryUnit: template.inventoryUnit,
      defaultContainer: productFamily === "lpg" ? "cylinder" : "packet",
    });
    if (error) {
      toast.error(error);
      return;
    }
    if (wanted.length === 0) {
      toast.error("Generate at least one variant before publishing");
      return;
    }

    setSaving(true);
    try {
      const resolved: Array<{ option: VariantOption; cell: MatrixVariant }> = [];
      for (const cell of wanted) {
        resolved.push({
          option: await resolveVariantOption(cell.definition),
          cell,
        });
      }
      const ids = resolved.map((entry) => entry.option.id);
      const duplicate = resolved.find(
        (entry, index) => ids.indexOf(entry.option.id) !== index,
      );
      if (duplicate) {
        toast.error(`${duplicate.cell.label} is listed twice`);
        return;
      }
      const saved = new Map(
        brandVariants.map((variant) => [variant.variantOptionId, variant]),
      );
      const variants: BrandVariant[] = resolved.map(({ option, cell }) => {
        const previous = saved.get(option.id);
        const credit = exchangeCreditFrom({
          newPrice: cell.newPrice,
          exchangePrice: cell.exchangePrice,
        });
        return {
          variantOptionId: option.id,
          // Admin: the reference price; an empty cell keeps the saved one.
          consumerPrice: adapter
            ? "0"
            : priceInputValue(cell.newPrice) ||
              priceInputValue(previous?.consumerPrice) ||
              "0",
          retailPrice: cell.newPrice,
          exchangePrice: cell.exchangePrice,
          exchangeEnabled: credit !== null,
          exchangeCreditAmount: credit ?? "0",
        };
      });
      const brands = [
        ...(isSingleMode
          ? []
          : form.state.values.brands.filter(
              (brand) => brand.brandId !== brandId,
            )),
        { brandId, variants },
      ];
      const details = {
        ...mergeTemplateDetails(template, defaultValues.template, core, productFamily),
        deliveryCostUnit:
          resolveDeliveryUnit(
            template.deliveryCostUnit,
            suggestDeliveryCostUnit(
              resolved.map((entry) => entry.option),
            ),
          ) ?? "",
      };
      const parsed = coreProductConfigSchema.safeParse({
        template: details,
        brands,
      });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Review the product");
        return;
      }
      configureMutation.mutate({
        coreProductId,
        expectedVersion: configuration?.template?.version ?? null,
        details: parsed.data.template,
        brands: parsed.data.brands,
        publish: {
          brandId,
          status: mode === "draft" ? "draft" : status,
          ...(adapter ? {} : { featured }),
        },
      });
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "A variant could not be created",
      );
    } finally {
      setSaving(false);
    }
  };

  if (
    adapter?.isLoading ||
    (!adapter && (configQuery.isLoading || brandsQuery.isLoading))
  ) {
    return <EditorLoading />;
  }

  if (adapter?.isError || (!adapter && configQuery.isError) || !core) {
    return <EditorError />;
  }

  const listHref = adapter?.listHref ?? PRODUCTS_BASE;
  const productEditHref =
    adapter?.productEditHref ??
    ((productId: number) => `${PRODUCTS_BASE}/${productId}/edit`);
  const selectedBrand = allBrands.find((brand) => brand.id === brandId);
  const editingProduct =
    brandId !== null ? existingByBrandId.get(brandId) : undefined;
  const pending = saving || configureMutation.isPending;
  const brandOptions = allBrands.filter(
    (brand) =>
      brand.isActive !== false &&
      (!isSingleMode || !existingByBrandId.has(brand.id)),
  );

  return (
    <form.Subscribe selector={(state) => state.values}>
      {(values) => {
        const template = values.template;
        const brandVariants =
          values.brands.find((brand) => brand.brandId === brandId)?.variants ??
          [];
        const blockedVariants = brandVariants
          .filter(
            (variant) =>
              !getVariantDefinition(optionOf(variant.variantOptionId)),
          )
          .map(
            (variant) =>
              editingProduct?.variantOptions.find(
                (option) => option.variantOptionId === variant.variantOptionId,
              )?.variantOptionName ?? `Variant #${variant.variantOptionId}`,
          );
        const firstOptions =
          attributes.find(
            (attribute) => attribute.name === template.variantAttr1,
          )?.options ?? [];
        const ruleValues: ClientRuleValues = {
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
        const setRules = (patch: Partial<ClientRuleValues>) => {
          for (const [key, value] of Object.entries(patch)) {
            form.setFieldValue(`template.${key}` as any, value as any);
          }
        };
        const method = isDeliveryCostMethod(template.deliveryCostMethod)
          ? template.deliveryCostMethod
          : "free";
        const shortDescription = template.shortDescription ?? "";

        return (
          <div className="min-h-screen bg-muted/30">
            <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="mt-0.5 h-8 w-8 shrink-0"
                  >
                    <Link href={listHref} aria-label="Products list">
                      <ArrowLeft className="h-4 w-4" />
                    </Link>
                  </Button>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      Products / {editingProduct ? "Edit product" : "New product"}
                    </p>
                    <h1 className="flex items-center gap-2 text-xl font-semibold">
                      <span className="truncate">
                        {editingProduct ? editingProduct.productName : "New product"}
                      </span>
                      <StatusPill status={status} />
                    </h1>
                  </div>
                </div>
                <HeaderActions
                  listHref={listHref}
                  pending={pending}
                  onDraft={() => void save("draft")}
                  onPublish={() => void save("publish")}
                />
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void save("publish");
                }}
                className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1.62fr)_minmax(420px,1fr)] lg:items-start"
              >
                <div className="grid min-w-0 gap-4">
                  <Card title="Product Information">
                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>
                          Type <Required />
                        </FieldLabel>
                        <Input value={core.category?.type?.name ?? ""} disabled />
                      </Field>
                      <Field>
                        <FieldLabel>
                          Category <Required />
                        </FieldLabel>
                        <Input value={core.category?.name ?? ""} disabled />
                      </Field>
                      <Field>
                        <FieldLabel>Sub category</FieldLabel>
                        <Input value={core.subCategory?.name ?? ""} disabled />
                      </Field>
                      <Field>
                        <FieldLabel>
                          Product name <Required />
                        </FieldLabel>
                        <Input
                          value={template.name}
                          maxLength={120}
                          onChange={(event) =>
                            form.setFieldValue("template.name", event.target.value)
                          }
                          placeholder="Select or type product name"
                        />
                      </Field>
                    </div>
                  </Card>

                  <Card title="Brand">
                    <BrandField
                      value={brandInput}
                      onChange={setBrandInput}
                      options={brandOptions.map((brand) => brand.name)}
                      onSave={saveBrandInput}
                      busy={creatingBrand}
                    />
                    <div className="mt-2.5">
                      {selectedBrand ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-[13px] font-medium text-primary">
                            {selectedBrand.name}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={clearBrand}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <Empty>No brand selected. Add one brand to continue.</Empty>
                      )}
                    </div>
                    {editingProduct && (
                      <Link
                        href={productEditHref(editingProduct.productId)}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Open saved product
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    )}
                  </Card>

                  <Card title="Description">
                    <Field>
                      <FieldLabel className="flex items-center justify-between">
                        <span>Short description</span>
                        <span className="text-xs font-normal text-muted-foreground tabular-nums">
                          {Math.min(shortDescription.length, SHORT_DESCRIPTION_LIMIT)}/
                          {SHORT_DESCRIPTION_LIMIT}
                        </span>
                      </FieldLabel>
                      <Textarea
                        rows={2}
                        maxLength={SHORT_DESCRIPTION_LIMIT}
                        value={shortDescription}
                        onChange={(event) =>
                          form.setFieldValue(
                            "template.shortDescription",
                            event.target.value,
                          )
                        }
                        placeholder="Write a concise product summary (maximum 160 characters)"
                      />
                    </Field>
                    <Field className="mt-3.5">
                      <FieldLabel>Full description</FieldLabel>
                      <RichTextEditor
                        value={template.description ?? ""}
                        onChange={(value: string) =>
                          form.setFieldValue("template.description", value)
                        }
                        placeholder="Describe product features, usage, specifications and benefits..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Recommended: 50–1,000 words. Basic formatting toolbar
                        included.
                      </p>
                    </Field>
                  </Card>

                  <Card title="Media">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field>
                        <FieldLabel>Thumbnail / main image</FieldLabel>
                        <ImageUploader
                          value={template.image}
                          onChange={(value: string) =>
                            form.setFieldValue("template.image", value)
                          }
                          folder="products"
                          maxSizeMB={5}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Gallery (up to 6 images)</FieldLabel>
                        <AdditionalImagesUploader
                          value={template.additionalImages}
                          onChange={(value: string[]) =>
                            form.setFieldValue(
                              "template.additionalImages",
                              value.slice(0, 6),
                            )
                          }
                          folder="products/additional"
                          maxSizeMB={5}
                        />
                      </Field>
                    </div>
                    <Field className="mt-3.5">
                      <FieldLabel>Video URL</FieldLabel>
                      <Input
                        value={template.videoUrl ?? ""}
                        onChange={(event) =>
                          form.setFieldValue("template.videoUrl", event.target.value)
                        }
                        placeholder="https://youtube.com/watch?v=..."
                      />
                    </Field>
                  </Card>

                  <Card
                    title="Variant Table"
                    action={
                      !isSingleMode &&
                      adapter?.presetBrands &&
                      brandId !== null ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            const preset = adapter.presetBrands?.find(
                              (brand) => brand.brandId === brandId,
                            );
                            if (!preset) {
                              toast.error("Admin has no preset for this brand");
                              return;
                            }
                            setMatrix(matrixForBrand(preset.variants));
                            toast.success("Admin preset loaded. Publish to apply it.");
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {adapter.reloadPresetLabel ?? "Reload preset"}
                        </Button>
                      ) : undefined
                    }
                  >
                    {blockedVariants.length > 0 && (
                      <div className="mb-3 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="min-w-0 space-y-1 text-xs">
                          <p className="font-semibold">
                            Variant definition required
                          </p>
                          <p>
                            {adapter
                              ? "Admin must review these older variants before this product can be saved: "
                              : "Review these older variants in Variant Setup before saving: "}
                            {blockedVariants.join(", ")}
                          </p>
                          {!adapter && (
                            <Link
                              href="/dashboard/admin/variant-options"
                              className="inline-flex items-center gap-1 font-medium underline"
                            >
                              Review variants
                              <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                    <VariantTable
                      attr1={template.variantAttr1 ?? ""}
                      attr2={template.variantAttr2 ?? ""}
                      options={firstOptions}
                      matrix={matrix}
                      onChange={setMatrix}
                    />
                  </Card>

                  <Card title="Variant Pricing">
                    <VariantPricing
                      attr2={template.variantAttr2 ?? ""}
                      matrix={matrix}
                      onChange={setMatrix}
                    />
                  </Card>

                  {adapter?.onVariantAliasChange && brandVariants.length > 0 && (
                    <Card
                      title="Warehouse variant labels"
                      description="Optional display-only aliases for this warehouse."
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        {brandVariants.map((variant) => {
                          const option = optionOf(variant.variantOptionId);
                          if (!option) return null;
                          return (
                            <Field key={variant.variantOptionId}>
                              <FieldLabel>{option.name}</FieldLabel>
                              <Input
                                value={
                                  adapter.variantAliases?.[
                                    variant.variantOptionId
                                  ] ?? ""
                                }
                                onChange={(event) =>
                                  adapter.onVariantAliasChange?.(
                                    variant.variantOptionId,
                                    event.target.value,
                                  )
                                }
                                placeholder="Use admin canonical label"
                              />
                            </Field>
                          );
                        })}
                      </div>
                    </Card>
                  )}
                </div>

                <aside className="grid min-w-0 gap-4 lg:sticky lg:top-4">
                  <Card title="Inventory & Product Rules">
                    <ClientRulesGrid
                      values={ruleValues}
                      onChange={setRules}
                      attributes={attributes}
                    />
                  </Card>

                  <Card title="Delivery Cost Configuration">
                    <Field>
                      <FieldLabel>Delivery cost method</FieldLabel>
                      <DeliveryMethodSelect
                        value={method}
                        className="h-9 w-full"
                        onChange={(value) =>
                          form.setFieldValue("template.deliveryCostMethod", value as any)
                        }
                      />
                    </Field>
                    <Field className="mt-3">
                      <FieldLabel>Default delivery cost (৳)</FieldLabel>
                      <Input
                        inputMode="decimal"
                        placeholder="Enter default cost"
                        value={template.defaultDeliveryCost ?? ""}
                        onChange={(event) => {
                          const next = event.target.value.trim();
                          if (/^\d{0,8}(\.\d{0,2})?$/.test(next)) {
                            form.setFieldValue("template.defaultDeliveryCost", next);
                          }
                        }}
                      />
                    </Field>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {DELIVERY_COST_METHODS[method].help}
                    </p>
                  </Card>

                  <Card title="Publishing">
                    <Field>
                      <FieldLabel>Status</FieldLabel>
                      <Select
                        value={status}
                        onValueChange={(value) =>
                          value && setStatus(value as PublishStatus)
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
                    <Field className="mt-3">
                      <FieldLabel>Visibility</FieldLabel>
                      <Select
                        value={template.visibility || "public"}
                        onValueChange={(value) =>
                          value &&
                          form.setFieldValue("template.visibility", value as any)
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
                        {VISIBILITY_HELP[template.visibility || "public"]}
                      </p>
                    </Field>
                    {!adapter && (
                      <>
                        <div className="my-4 border-t" />
                        <FeaturedCheckbox checked={featured} onChange={setFeatured} />
                      </>
                    )}
                  </Card>
                </aside>
              </form>
            </div>
          </div>
        );
      }}
    </form.Subscribe>
  );
}


function Card({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-[14px] border bg-card p-5 shadow-xs">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-[15px] font-semibold leading-tight">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Required() {
  return <span className="text-destructive">*</span>;
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: PublishStatus }) {
  const styles: Record<PublishStatus, string> = {
    active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    draft: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    inactive: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
        styles[status],
      )}
    >
      {status}
    </span>
  );
}

function HeaderActions({
  listHref,
  pending,
  onDraft,
  onPublish,
}: {
  listHref: string;
  pending: boolean;
  onDraft: () => void;
  onPublish: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button type="button" variant="outline" size="sm" asChild disabled={pending}>
        <Link href={listHref}>Discard</Link>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onDraft}
        disabled={pending}
      >
        Save draft
      </Button>
      <Button type="button" size="sm" onClick={onPublish} disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Publish
      </Button>
    </div>
  );
}

function BrandField({
  value,
  onChange,
  options,
  onSave,
  busy,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  onSave: (allowCreate: boolean) => void;
  busy: boolean;
}) {
  const listId = useId();
  return (
    <div className="flex gap-2">
      <Input
        list={listId}
        value={value}
        placeholder="Search or type brand name"
        onChange={(event) => onChange(event.target.value)}
        // Picking a listed brand selects it; a new name needs "+ Add brand".
        onBlur={() => onSave(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSave(true);
          }
        }}
      />
      <datalist id={listId}>
        {options.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <Button
        type="button"
        variant="outline"
        className="shrink-0"
        disabled={busy}
        onClick={() => onSave(true)}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Add brand
      </Button>
    </div>
  );
}


function EditorLoading() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-muted/30">
      <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div>
          <p className="text-sm font-medium">Loading product</p>
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
  return merged;
}
