"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  Loader2,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import ImageUploader from "@/components/ImageUploader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/utils/orpc";

type DamageType = "physical" | "expired" | "lost";
type DamageMode = "loose" | "pack" | "carton" | "direct";

type DamageSource = {
  sourceKey: string;
  inventoryId: number;
  variantId: number;
  cartonId: number | null;
  cartonCode: string | null;
  stockEntryId: number | null;
  batchNo: string | null;
  expiryDate: string | null;
  sku: string | null;
  productName: string;
  productImage: string | null;
  brandName: string | null;
  variantLabel: string;
  availableQty: number;
  quantityUnit: string;
  allowsDecimal: boolean;
  unitCost: number;
  totalWeightKg: number | null;
};

type SelectedDamageSource = DamageSource & {
  quantity: string;
  note: string;
};

type DraftDamageItem = {
  inventoryId: number;
  cartonId?: number;
  stockEntryId?: number;
  quantity?: number;
  note?: string;
};

const DAMAGE_TYPES: Array<{
  value: DamageType;
  label: string;
  description: string;
}> = [
  {
    value: "physical",
    label: "Physical Damage",
    description: "Broken, crushed, torn, or unusable",
  },
  {
    value: "expired",
    label: "Expired",
    description: "Past the recorded batch expiry date",
  },
  {
    value: "lost",
    label: "Lost / Missing",
    description: "Stock that cannot be physically located",
  },
];

const DAMAGE_MODES: Array<{
  value: DamageMode;
  label: string;
  description: string;
}> = [
  {
    value: "loose",
    label: "Loose",
    description: "Measured stock such as KG or litre",
  },
  {
    value: "pack",
    label: "Pack",
    description: "Packets, sacks, bottles, boxes, and packs",
  },
  {
    value: "carton",
    label: "Carton",
    description: "Select complete physical Carton IDs",
  },
  {
    value: "direct",
    label: "Direct Unit",
    description: "Whole products such as cylinders or drives",
  },
];

function localDate() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
}

export default function CreateWarehouseDamagePage() {
  const router = useRouter();
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [draftId, setDraftId] = useState<number | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftItems, setDraftItems] = useState<DraftDamageItem[]>([]);
  const [damageType, setDamageType] = useState<DamageType | null>(null);
  const [damageMode, setDamageMode] = useState<DamageMode | null>(null);
  const [entryDate, setEntryDate] = useState(localDate);
  const [description, setDescription] = useState("");
  const [proofImages, setProofImages] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedItems, setSelectedItems] = useState<SelectedDamageSource[]>(
    [],
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [prefillStockEntryIds, setPrefillStockEntryIds] = useState<number[]>(
    [],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedDraftId = Number(params.get("draftId"));
    if (Number.isInteger(requestedDraftId) && requestedDraftId > 0) {
      setDraftId(requestedDraftId);
    }
    if (params.get("type") === "expired") setDamageType("expired");
    const ids = (
      params.get("stockEntryIds") ??
      params.get("stockEntryId") ??
      ""
    )
      .split(",")
      .map(Number)
      .filter((value) => Number.isInteger(value) && value > 0);
    setPrefillStockEntryIds(ids);
  }, []);
  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      250,
    );
    return () => window.clearTimeout(timeout);
  }, [search]);

  const draftQuery = useQuery({
    ...orpc.warehouseDamage.getById.queryOptions({
      input: { id: draftId ?? 1 },
    }),
    enabled: Boolean(draftId),
  });

  useEffect(() => {
    const draft = draftQuery.data;
    if (!draft || draftLoaded) return;
    if (draft.status !== "draft" || !draft.draftPayload) {
      toast.error("This damage entry is no longer an editable draft");
      router.push("/warehouse/dashboard/damage");
      return;
    }
    setRequestKey(draft.requestKey);
    setDamageType(draft.draftPayload.damageType);
    setDamageMode(draft.draftPayload.damageMode);
    setEntryDate(draft.draftPayload.entryDate);
    setDescription(draft.draftPayload.description ?? "");
    setProofImages(draft.draftPayload.proofImages);
    setDraftItems(draft.draftPayload.items);
    setDraftLoaded(true);
  }, [draftLoaded, draftQuery.data, router]);

  const sourceQuery = useQuery({
    ...orpc.warehouseDamage.searchSources.queryOptions({
      input: {
        mode: damageMode ?? "pack",
        damageType: damageType ?? undefined,
        search: debouncedSearch || undefined,
        inventoryIds: draftItems.length
          ? draftItems.map((item) => item.inventoryId)
          : undefined,
        cartonIds: draftItems.length
          ? draftItems.flatMap((item) => (item.cartonId ? [item.cartonId] : []))
          : undefined,
        stockEntryIds:
          draftItems.length || prefillStockEntryIds.length
            ? [
                ...draftItems.flatMap((item) =>
                  item.stockEntryId ? [item.stockEntryId] : [],
                ),
                ...prefillStockEntryIds,
              ]
            : undefined,
        limit: 250,
      },
    }),
    enabled: Boolean(damageMode && damageType),
  });

  const postMutation = useMutation(
    orpc.warehouseDamage.post.mutationOptions({
      onSuccess: (result) => {
        toast.success(`${result.entryNo} posted successfully`);
        router.push(`/warehouse/dashboard/damage/${result.entryId}`);
      },
      onError: (error) =>
        toast.error(error.message || "Could not post damage entry"),
    }),
  );
  const createDraftMutation = useMutation(
    orpc.warehouseDamage.saveDraft.mutationOptions({
      onSuccess: (result) => {
        toast.success(`${result.entryNo} saved as draft`);
        router.push(`/warehouse/dashboard/damage/${result.entryId}`);
      },
      onError: (error) =>
        toast.error(error.message || "Could not save damage draft"),
    }),
  );
  const updateDraftMutation = useMutation(
    orpc.warehouseDamage.updateDraft.mutationOptions({
      onSuccess: (result) => {
        toast.success("Damage draft updated");
        router.push(`/warehouse/dashboard/damage/${result.entryId}`);
      },
      onError: (error) =>
        toast.error(error.message || "Could not update damage draft"),
    }),
  );

  const availableSources = (
    (sourceQuery.data?.sources ?? []) as DamageSource[]
  ).filter(
    (source) =>
      !selectedItems.some((item) => item.sourceKey === source.sourceKey),
  );

  useEffect(() => {
    if (!prefillStockEntryIds.length || !sourceQuery.data?.sources?.length)
      return;
    const matching = (sourceQuery.data.sources as DamageSource[]).filter(
      (source) =>
        source.stockEntryId &&
        prefillStockEntryIds.includes(source.stockEntryId) &&
        !selectedItems.some((item) => item.sourceKey === source.sourceKey),
    );
    if (!matching.length) return;
    setSelectedItems((current) => [
      ...current,
      ...matching.map((source) => ({ ...source, quantity: "", note: "" })),
    ]);
    setPrefillStockEntryIds([]);
  }, [prefillStockEntryIds, selectedItems, sourceQuery.data?.sources]);

  useEffect(() => {
    if (!draftItems.length || !sourceQuery.data?.sources?.length) return;
    const sources = sourceQuery.data.sources as DamageSource[];
    const restored = draftItems.flatMap((draftItem) => {
      const source = sources.find((candidate) =>
        draftItem.cartonId
          ? candidate.cartonId === draftItem.cartonId
          : draftItem.stockEntryId
            ? candidate.stockEntryId === draftItem.stockEntryId
            : candidate.inventoryId === draftItem.inventoryId,
      );
      return source
        ? [
            {
              ...source,
              quantity:
                damageMode === "carton"
                  ? String(source.availableQty)
                  : String(draftItem.quantity ?? ""),
              note: draftItem.note ?? "",
            },
          ]
        : [];
    });
    setSelectedItems(restored);
    setDraftItems([]);
    if (restored.length !== draftItems.length) {
      toast.error(
        "Some draft sources are no longer eligible and must be selected again",
      );
    }
  }, [damageMode, draftItems, sourceQuery.data?.sources]);

  const calculatedItems = useMemo(
    () =>
      selectedItems.map((item) => {
        const quantity =
          damageMode === "carton"
            ? item.availableQty
            : Number(item.quantity || 0);
        return {
          ...item,
          quantityValue: quantity,
          lossValue: quantity * item.unitCost,
        };
      }),
    [damageMode, selectedItems],
  );
  const totalLoss = calculatedItems.reduce(
    (sum, item) => sum + item.lossValue,
    0,
  );
  const selectedCartonCount =
    damageMode === "carton" ? selectedItems.length : 0;
  const groupedQuantities = useMemo(() => {
    const groups = new Map<string, number>();
    for (const item of calculatedItems) {
      groups.set(
        item.quantityUnit,
        (groups.get(item.quantityUnit) ?? 0) + item.quantityValue,
      );
    }
    return Array.from(groups, ([unit, quantity]) => ({ unit, quantity }));
  }, [calculatedItems]);

  const invalidQuantity = calculatedItems.some(
    (item) => item.quantityValue <= 0 || item.quantityValue > item.availableQty,
  );
  const canSubmit = Boolean(
    requestKey &&
      damageType &&
      damageMode &&
      selectedItems.length > 0 &&
      !invalidQuantity &&
      !postMutation.isPending,
  );

  const addSource = (source: DamageSource) => {
    setSelectedItems((current) => [
      ...current,
      {
        ...source,
        quantity: damageMode === "carton" ? String(source.availableQty) : "",
        note: "",
      },
    ]);
  };

  const selectDamageType = (value: DamageType) => {
    setDamageType(value);
    if (value === "expired" && damageMode === "carton") {
      setDamageMode(null);
    }
    setSelectedItems([]);
    setSearch("");
    setDebouncedSearch("");
  };

  const selectDamageMode = (value: DamageMode) => {
    setDamageMode(value);
    setSelectedItems([]);
    setSearch("");
    setDebouncedSearch("");
  };

  const updateSelected = (
    sourceKey: string,
    field: "quantity" | "note",
    value: string,
  ) => {
    setSelectedItems((current) =>
      current.map((item) =>
        item.sourceKey === sourceKey ? { ...item, [field]: value } : item,
      ),
    );
  };

  const buildPayload = () => {
    if (!canSubmit || !damageType || !damageMode) return null;
    return {
      damageType,
      damageMode,
      description: description.trim() || undefined,
      proofImages,
      entryDate,
      items: calculatedItems.map((item) => ({
        inventoryId: item.inventoryId,
        cartonId: item.cartonId ?? undefined,
        stockEntryId: item.stockEntryId ?? undefined,
        quantity: damageMode === "carton" ? undefined : item.quantityValue,
        note: item.note.trim() || undefined,
      })),
    };
  };

  const submit = () => {
    const payload = buildPayload();
    if (!payload) return;
    postMutation.mutate({
      requestKey,
      draftId: draftId ?? undefined,
      ...payload,
    });
  };

  const saveDraft = () => {
    const payload = buildPayload();
    if (!payload) return;
    if (draftId) {
      updateDraftMutation.mutate({ id: draftId, ...payload });
      return;
    }
    createDraftMutation.mutate({ requestKey, ...payload });
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 pb-12">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-0.5">
            <Link
              href="/warehouse/dashboard/damage"
              aria-label="Back to damage management"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-600">
              Warehouse write-off
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
              {draftId ? "Edit Damage Draft" : "Add Damage Entry"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Select the exact stock source, capture proof, and post the loss
              once.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          <ShieldCheck className="h-4 w-4" /> Atomic inventory update
        </div>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">
                1
              </span>
              <div>
                <h2 className="font-bold text-slate-950">Damage information</h2>
                <p className="text-xs text-slate-500">
                  Choose why and how this stock is recorded.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <Label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Damage type
                </Label>
                <div className="grid gap-2 md:grid-cols-3">
                  {DAMAGE_TYPES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => selectDamageType(item.value)}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        damageType === item.value
                          ? "border-red-500 bg-red-50 shadow-sm ring-2 ring-red-100"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-sm font-bold text-slate-900">
                        {item.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {item.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Entry mode
                </Label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {DAMAGE_MODES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      disabled={
                        damageType === "expired" && item.value === "carton"
                      }
                      onClick={() => selectDamageMode(item.value)}
                      title={
                        damageType === "expired" && item.value === "carton"
                          ? "Expired cartons need exact purchase-batch traceability"
                          : undefined
                      }
                      className={`rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-400 ${
                        damageMode === item.value
                          ? "border-slate-950 bg-slate-950 text-white shadow-md"
                          : "border-slate-200 bg-white hover:border-slate-400"
                      }`}
                    >
                      <span className="text-sm font-bold">{item.label}</span>
                      <span
                        className={`mt-1 block text-[11px] leading-4 ${damageMode === item.value ? "text-slate-300" : "text-slate-500"}`}
                      >
                        {damageType === "expired" && item.value === "carton"
                          ? "Unavailable until cartons carry batch provenance"
                          : item.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="entry-date">Occurrence date</Label>
                  <div className="relative mt-2">
                    <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="entry-date"
                      type="date"
                      value={entryDate}
                      max={localDate()}
                      onChange={(event) => setEntryDate(event.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">
                    Reference / short description
                  </Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="e.g. Rack B stacking collapse"
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">
                2
              </span>
              <div>
                <h2 className="font-bold text-slate-950">
                  Select damaged stock
                </h2>
                <p className="text-xs text-slate-500">
                  {damageMode === "carton"
                    ? "Choose complete, active physical cartons."
                    : damageType === "expired"
                      ? "Choose an expired batch and enter its damaged quantity."
                      : "Only unpacked stock is eligible for this mode."}
                </p>
              </div>
            </div>

            {!damageType || !damageMode ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                Choose a damage type and entry mode first.
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={
                      damageMode === "carton"
                        ? "Search Carton ID, SKU, or product"
                        : damageType === "expired"
                          ? "Search batch, SKU, or product"
                          : "Search SKU, product, or brand"
                    }
                    className="pl-9"
                  />
                </div>

                <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-slate-200">
                  {sourceQuery.isLoading ? (
                    <div className="flex h-28 items-center justify-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading
                      eligible stock…
                    </div>
                  ) : sourceQuery.isError ? (
                    <div className="flex h-28 items-center justify-center text-sm text-red-600">
                      Could not load eligible stock.
                    </div>
                  ) : availableSources.length === 0 ? (
                    <div className="flex h-28 items-center justify-center text-sm text-slate-500">
                      No eligible stock found for this mode.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {availableSources.map((source) => (
                        <div
                          key={source.sourceKey}
                          className="flex items-center gap-3 p-3 hover:bg-slate-50"
                        >
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                            {source.productImage ? (
                              <Image
                                src={source.productImage}
                                alt=""
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            ) : (
                              <Package className="absolute left-2.5 top-2.5 h-5 w-5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="truncate text-sm font-bold text-slate-900">
                                {source.productName}
                              </p>
                              {source.cartonCode && (
                                <Badge
                                  variant="outline"
                                  className="font-mono text-[10px]"
                                >
                                  {source.cartonCode}
                                </Badge>
                              )}
                              {source.batchNo && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  Batch {source.batchNo}
                                </Badge>
                              )}
                            </div>
                            <p className="truncate text-xs text-slate-500">
                              {[
                                source.sku,
                                source.brandName,
                                source.variantLabel,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          <div className="hidden text-right sm:block">
                            <p className="text-xs font-bold text-slate-800">
                              {source.cartonCode
                                ? "1 carton"
                                : `${formatQuantity(source.availableQty)} ${source.quantityUnit}`}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {source.cartonCode
                                ? `${formatQuantity(source.availableQty)} ${source.quantityUnit}${source.totalWeightKg ? ` · ${formatQuantity(source.totalWeightKg)} KG` : ""}`
                                : `৳ ${source.unitCost.toLocaleString("en-IN")} cost/${source.quantityUnit}`}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1 font-bold"
                            onClick={() => addSource(source)}
                          >
                            <Plus className="h-3.5 w-3.5" /> Add
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {selectedItems.length > 0 && (
              <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-950 text-[10px] uppercase tracking-wider text-slate-300">
                    <tr>
                      <th className="px-3 py-3">Product / Source</th>
                      <th className="px-3 py-3">Variant</th>
                      <th className="px-3 py-3 text-right">Available</th>
                      <th className="px-3 py-3">Damage qty</th>
                      <th className="px-3 py-3 text-right">Cost</th>
                      <th className="px-3 py-3 text-right">Loss</th>
                      <th className="w-10 px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {calculatedItems.map((item) => {
                      const invalid =
                        item.quantityValue <= 0 ||
                        item.quantityValue > item.availableQty;
                      return (
                        <tr
                          key={item.sourceKey}
                          className={invalid ? "bg-red-50/60" : "bg-white"}
                        >
                          <td className="px-3 py-3">
                            <p className="font-bold text-slate-900">
                              {item.productName}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {item.cartonCode ??
                                (item.batchNo
                                  ? `Batch ${item.batchNo}`
                                  : (item.sku ?? "—"))}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-600">
                            {[item.brandName, item.variantLabel]
                              .filter(Boolean)
                              .join(" · ")}
                          </td>
                          <td className="px-3 py-3 text-right font-semibold tabular-nums">
                            {item.cartonCode ? (
                              <>
                                <span>1 carton</span>
                                <span className="block text-[10px] font-medium text-slate-500">
                                  {formatQuantity(item.availableQty)}{" "}
                                  {item.quantityUnit}
                                </span>
                              </>
                            ) : (
                              <span>
                                {formatQuantity(item.availableQty)}{" "}
                                {item.quantityUnit}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {damageMode === "carton" ? (
                              <div className="font-bold tabular-nums">
                                <span>1 carton</span>
                                <span className="block text-[10px] font-medium text-slate-500">
                                  {formatQuantity(item.availableQty)}{" "}
                                  {item.quantityUnit}
                                </span>
                              </div>
                            ) : (
                              <div>
                                <Input
                                  type="number"
                                  min="0"
                                  max={item.availableQty}
                                  step={item.allowsDecimal ? "0.01" : "1"}
                                  value={item.quantity}
                                  onChange={(event) =>
                                    updateSelected(
                                      item.sourceKey,
                                      "quantity",
                                      event.target.value,
                                    )
                                  }
                                  className={`h-9 w-28 ${invalid ? "border-red-400" : ""}`}
                                  placeholder="0"
                                />
                                {invalid && (
                                  <p className="mt-1 text-[10px] text-red-600">
                                    Enter 1–{formatQuantity(item.availableQty)}
                                  </p>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right text-xs tabular-nums text-slate-600">
                            ৳{" "}
                            {item.unitCost.toLocaleString("en-IN", {
                              maximumFractionDigits: 4,
                            })}
                          </td>
                          <td className="px-3 py-3 text-right font-black tabular-nums text-red-700">
                            ৳{" "}
                            {item.lossValue.toLocaleString("en-IN", {
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              onClick={() =>
                                setSelectedItems((current) =>
                                  current.filter(
                                    (selected) =>
                                      selected.sourceKey !== item.sourceKey,
                                  ),
                                )
                              }
                              aria-label={`Remove ${item.productName}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">
                3
              </span>
              <div>
                <h2 className="font-bold text-slate-950">
                  Proof & detailed note
                </h2>
                <p className="text-xs text-slate-500">
                  Add up to eight warehouse incident photos.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {proofImages.map((url, index) => (
                <ImageUploader
                  key={`${url}-${index}`}
                  value={url}
                  folder="warehouse-damage-proof"
                  className="min-h-40"
                  onChange={(nextUrl) =>
                    setProofImages((current) =>
                      nextUrl
                        ? current.map((item, itemIndex) =>
                            itemIndex === index ? nextUrl : item,
                          )
                        : current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                />
              ))}
              {proofImages.length < 8 && (
                <ImageUploader
                  value=""
                  folder="warehouse-damage-proof"
                  className="min-h-40"
                  onChange={(url) =>
                    url && setProofImages((current) => [...current, url])
                  }
                />
              )}
            </div>
            <div className="mt-4">
              <Label htmlFor="details">Damage details</Label>
              <Textarea
                id="details"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the damage, cause, location, and handling action…"
                className="mt-2 min-h-28"
                maxLength={2000}
              />
            </div>
          </section>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-5">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
            <div className="bg-slate-950 px-5 py-4 text-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-300">
                Live entry summary
              </p>
              <h2 className="mt-1 text-lg font-black">Damage posting</h2>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Type
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {DAMAGE_TYPES.find((item) => item.value === damageType)
                      ?.label ?? "Not selected"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Mode
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {DAMAGE_MODES.find((item) => item.value === damageMode)
                      ?.label ?? "Not selected"}
                  </p>
                </div>
              </div>

              <div className="border-y border-slate-100 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Selected sources
                  </span>
                  <span className="font-black text-slate-950">
                    {selectedItems.length}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {selectedCartonCount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Cartons</span>
                      <span className="font-bold tabular-nums text-red-700">
                        {selectedCartonCount}
                      </span>
                    </div>
                  )}
                  {groupedQuantities.length ? (
                    groupedQuantities.map((item) => (
                      <div
                        key={item.unit}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="capitalize text-slate-500">
                          {item.unit}
                        </span>
                        <span className="font-bold tabular-nums text-slate-900">
                          {formatQuantity(item.quantity)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">
                      No quantities entered yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-600">
                  <CircleDollarSign className="h-4 w-4" /> Total acquisition
                  loss
                </div>
                <p className="mt-2 text-3xl font-black tracking-tight text-red-800">
                  ৳{" "}
                  {totalLoss.toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              {calculatedItems.some((item) => item.unitCost === 0) && (
                <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Some legacy stock has no acquisition cost. Its loss will be
                  recorded as zero instead of using a selling price.
                </div>
              )}

              <Button
                type="button"
                className="h-11 w-full gap-2 bg-red-600 font-black text-white hover:bg-red-700"
                disabled={!canSubmit}
                onClick={() => setConfirmOpen(true)}
              >
                {postMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ClipboardCheck className="h-4 w-4" />
                )}
                Submit Damage Entry
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                disabled={
                  !canSubmit ||
                  createDraftMutation.isPending ||
                  updateDraftMutation.isPending ||
                  postMutation.isPending
                }
                onClick={saveDraft}
              >
                {createDraftMutation.isPending ||
                updateDraftMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                {draftId ? "Save Draft Changes" : "Save as Draft"}
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full gap-2"
                disabled={postMutation.isPending}
              >
                <Link href="/warehouse/dashboard/damage">
                  <X className="h-4 w-4" /> Cancel
                </Link>
              </Button>
            </div>
          </section>

          <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(145deg,#f8fafc,#fff)] p-4 text-xs leading-5 text-slate-600">
            <div className="mb-2 flex items-center gap-2 font-bold text-slate-900">
              <Boxes className="h-4 w-4" /> Stock behavior
            </div>
            Carton entries remove the complete physical carton. Loose, pack, and
            direct entries only use unpacked stock and never silently consume
            carton contents.
          </div>
        </aside>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post this damage entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately deduct the selected stock and preserve the
              entry as immutable audit evidence. Corrections require a recorded
              reversal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Selected sources</span>
              <span className="font-bold text-slate-900">
                {selectedItems.length}
              </span>
            </div>
            {selectedCartonCount > 0 && (
              <div className="mt-2 flex justify-between gap-4">
                <span className="text-slate-500">Physical cartons</span>
                <span className="font-bold text-slate-900">
                  {selectedCartonCount}
                </span>
              </div>
            )}
            <div className="mt-2 flex justify-between gap-4 border-t border-slate-200 pt-2">
              <span className="text-slate-500">Acquisition loss</span>
              <span className="font-black text-red-700">
                ৳{" "}
                {totalLoss.toLocaleString("en-IN", {
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={postMutation.isPending}>
              Review entry
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={postMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              {postMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Post and deduct stock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
