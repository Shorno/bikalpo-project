"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileImage,
  History,
  Loader2,
  MapPin,
  PackageX,
  Pencil,
  RotateCcw,
  ShieldAlert,
  Trash2,
  UserRound,
  Warehouse,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/utils/orpc";

const TYPE_LABELS: Record<string, string> = {
  physical: "Physical Damage",
  expired: "Expired",
  lost: "Lost / Missing",
};

const MODE_LABELS: Record<string, string> = {
  loose: "Loose Entry",
  pack: "Pack Entry",
  carton: "Carton Entry",
  direct: "Direct Unit Entry",
};

function displayDate(value: string | Date) {
  return new Date(
    value instanceof Date ? value : `${value}T00:00:00`,
  ).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatQty(value: number) {
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
}

export default function WarehouseDamageDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reversalReason, setReversalReason] = useState("");
  const [draftPostOpen, setDraftPostOpen] = useState(false);
  const [draftDeleteOpen, setDraftDeleteOpen] = useState(false);

  const detailQuery = useQuery({
    ...orpc.warehouseDamage.getById.queryOptions({ input: { id } }),
    enabled: Number.isInteger(id) && id > 0,
  });
  const entry = detailQuery.data;

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpc.warehouseDamage.getById.key(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.warehouseDamage.list.key(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.warehouseDamage.summary.key(),
      }),
    ]);
  };

  const reverseMutation = useMutation(
    orpc.warehouseDamage.reverse.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        setReverseOpen(false);
        setReversalReason("");
        toast.success("Damage entry reversed and stock restored");
      },
      onError: (error) =>
        toast.error(error.message || "Could not reverse entry"),
    }),
  );
  const postDraftMutation = useMutation(
    orpc.warehouseDamage.post.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        setDraftPostOpen(false);
        toast.success("Damage draft posted and stock deducted");
      },
      onError: (error) =>
        toast.error(error.message || "Could not post damage draft"),
    }),
  );
  const deleteDraftMutation = useMutation(
    orpc.warehouseDamage.deleteDraft.mutationOptions({
      onSuccess: () => {
        toast.success("Damage draft deleted");
        router.push("/warehouse/dashboard/damage");
      },
      onError: (error) =>
        toast.error(error.message || "Could not delete damage draft"),
    }),
  );

  const quantityGroups = useMemo(() => {
    const groups = new Map<string, number>();
    for (const item of entry?.items ?? []) {
      groups.set(
        item.quantityUnit,
        (groups.get(item.quantityUnit) ?? 0) + item.quantity,
      );
    }
    return Array.from(groups, ([unit, quantity]) => ({ unit, quantity }));
  }, [entry]);
  const cartonCount = (entry?.items ?? []).reduce(
    (total, item) => total + item.cartonCount,
    0,
  );

  if (detailQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading damage entry…
      </div>
    );
  }

  if (detailQuery.isError || !entry) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <div>
          <h1 className="text-xl font-black text-slate-950">
            Damage entry not found
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            It may have moved or belong to another warehouse.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/warehouse/dashboard/damage">Back to Damage</Link>
        </Button>
      </div>
    );
  }

  if (entry.status === "draft" && entry.draftPayload) {
    const draft = entry.draftPayload;
    const warehouseName =
      entry.warehouse?.warehouseName || entry.warehouse?.name || "Warehouse";
    return (
      <div className="mx-auto max-w-5xl space-y-6 pb-12">
        <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <Button asChild variant="ghost" size="icon">
              <Link
                href="/warehouse/dashboard/damage"
                aria-label="Back to damage management"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600">
                Editable damage draft
              </p>
              <div className="mt-1 flex items-center gap-3">
                <h1 className="font-mono text-2xl font-black text-slate-950">
                  {entry.entryNo}
                </h1>
                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                  Draft
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link
                href={`/warehouse/dashboard/damage/create?draftId=${entry.id}`}
              >
                <Pencil className="h-4 w-4" /> Edit Entry
              </Link>
            </Button>
            <Button
              className="gap-2 bg-red-600 hover:bg-red-700"
              onClick={() => setDraftPostOpen(true)}
            >
              <ClipboardCheck className="h-4 w-4" /> Submit Damage Entry
            </Button>
          </div>
        </header>

        <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5">
          <p className="font-bold text-blue-950">
            No stock has been deducted yet.
          </p>
          <p className="mt-1 text-sm text-blue-800">
            Edit or delete this draft freely. Posting will revalidate current
            inventory and then make the evidence immutable.
          </p>
        </section>

        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Warehouse
            </p>
            <p className="mt-2 font-bold text-slate-900">{warehouseName}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Type / mode
            </p>
            <p className="mt-2 font-bold text-slate-900">
              {TYPE_LABELS[draft.damageType]}
            </p>
            <p className="text-xs text-slate-500">
              {MODE_LABELS[draft.damageMode]}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Occurrence date
            </p>
            <p className="mt-2 font-bold text-slate-900">
              {displayDate(draft.entryDate)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Selected sources
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {draft.items.length}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-black text-slate-950">Draft notes & proof</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {draft.description || "No damage description recorded yet."}
          </p>
          <p className="mt-4 text-xs font-bold text-slate-500">
            {draft.proofImages.length} proof image
            {draft.proofImages.length === 1 ? "" : "s"} attached
          </p>
        </section>

        <div className="flex justify-end">
          <Button
            variant="outline"
            className="gap-2 border-red-200 text-red-700 hover:bg-red-50"
            onClick={() => setDraftDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" /> Delete Draft
          </Button>
        </div>

        <AlertDialog open={draftPostOpen} onOpenChange={setDraftPostOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Post {entry.entryNo}?</AlertDialogTitle>
              <AlertDialogDescription>
                Current stock will be revalidated and deducted. The posted
                evidence can only be corrected by an audited reversal.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={postDraftMutation.isPending}>
                Keep draft
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                disabled={postDraftMutation.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  postDraftMutation.mutate({
                    requestKey: entry.requestKey,
                    draftId: entry.id,
                    ...draft,
                  });
                }}
              >
                {postDraftMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Post and deduct stock
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={draftDeleteOpen} onOpenChange={setDraftDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the unposted draft. Warehouse stock is not
                affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteDraftMutation.isPending}>
                Keep draft
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                disabled={deleteDraftMutation.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  deleteDraftMutation.mutate({ id: entry.id });
                }}
              >
                {deleteDraftMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Delete draft
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  const isReversed = entry.status === "reversed";
  const warehouseName =
    entry.warehouse?.warehouseName || entry.warehouse?.name || "Warehouse";

  return (
    <div className="mx-auto max-w-[1380px] space-y-6 pb-12">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-1">
            <Link
              href="/warehouse/dashboard/damage"
              aria-label="Back to damage management"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-600">
              Damage entry detail
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-2xl font-black tracking-tight text-slate-950">
                {entry.entryNo}
              </h1>
              <Badge
                variant="outline"
                className={
                  isReversed
                    ? "border-slate-300 bg-slate-100 text-slate-600"
                    : "border-red-200 bg-red-50 text-red-700"
                }
              >
                {isReversed ? "Reversed" : "Posted"}
              </Badge>
            </div>
          </div>
        </div>
        {!isReversed && (
          <Button
            variant="outline"
            className="gap-2 border-red-200 text-red-700 hover:bg-red-50"
            onClick={() => setReverseOpen(true)}
          >
            <RotateCcw className="h-4 w-4" /> Reverse Entry
          </Button>
        )}
      </header>

      {isReversed && (
        <section className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
          <ShieldAlert className="h-6 w-6 shrink-0 text-amber-700" />
          <div>
            <p className="font-bold text-amber-950">
              This posting was reversed on{" "}
              {entry.reversedAt ? displayDate(entry.reversedAt) : "—"}.
            </p>
            <p className="mt-0.5 text-sm text-amber-800">
              {entry.reversalReason || "No reversal reason was recorded."}
            </p>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-xl shadow-slate-200/60">
        <div className="grid divide-y divide-slate-800 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-[1.2fr_.8fr_.8fr_.9fr]">
          <div className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Warehouse
            </p>
            <p className="mt-2 flex items-center gap-2 text-lg font-black">
              <Warehouse className="h-5 w-5 text-red-400" /> {warehouseName}
            </p>
            {entry.warehouse?.warehouseAddress && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                <MapPin className="h-3.5 w-3.5" />{" "}
                {entry.warehouse.warehouseAddress}
              </p>
            )}
          </div>
          <div className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Entry by
            </p>
            <p className="mt-2 flex items-center gap-2 font-bold">
              <UserRound className="h-4 w-4 text-red-400" />{" "}
              {entry.createdByName}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Posted {displayDate(entry.createdAt)}
            </p>
          </div>
          <div className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Occurrence date
            </p>
            <p className="mt-2 flex items-center gap-2 font-bold">
              <CalendarDays className="h-4 w-4 text-red-400" />{" "}
              {displayDate(entry.entryDate)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {TYPE_LABELS[entry.damageType]}
            </p>
          </div>
          <div className="bg-red-500/10 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-300">
              Total acquisition loss
            </p>
            <p className="mt-2 text-3xl font-black text-red-300">
              ৳{" "}
              {entry.totalLossValue.toLocaleString("en-IN", {
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="mt-1 text-xs text-red-200/70">
              Cost captured when posted
            </p>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="flex items-center gap-2 font-black text-slate-950">
                  <Boxes className="h-5 w-5 text-red-600" /> Damage breakdown
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Immutable source, quantity, and cost snapshots.
                </p>
              </div>
              <Badge
                variant="outline"
                className="w-fit border-slate-300 bg-slate-50 text-slate-700"
              >
                {MODE_LABELS[entry.damageMode]}
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">SKU / Source</th>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">Brand & variant</th>
                    <th className="px-5 py-3 text-right">Quantity</th>
                    <th className="px-5 py-3 text-right">Unit cost</th>
                    <th className="px-5 py-3 text-right">Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entry.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-4">
                        <p className="font-mono text-xs font-bold text-slate-800">
                          {item.skuSnapshot || "—"}
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-red-600">
                          {item.carton?.cartonId ??
                            item.stockEntry?.batchNo ??
                            item.sourceLabelSnapshot ??
                            "Unpacked stock"}
                        </p>
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-900">
                        {item.productNameSnapshot}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-600">
                        {[item.brandNameSnapshot, item.variantLabelSnapshot]
                          .filter(Boolean)
                          .join(" · ")}
                      </td>
                      <td className="px-5 py-4 text-right font-black tabular-nums text-slate-900">
                        {item.cartonCount ? (
                          <>
                            <span>1 carton</span>
                            <span className="mt-1 block text-[11px] font-medium text-slate-500">
                              {formatQty(item.quantity)} {item.quantityUnit}
                              {item.sourceTotalWeightKg
                                ? ` · ${formatQty(item.sourceTotalWeightKg)} KG`
                                : ""}
                            </span>
                          </>
                        ) : (
                          <span>
                            {formatQty(item.quantity)} {item.quantityUnit}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-slate-600">
                        ৳{" "}
                        {item.unitCost.toLocaleString("en-IN", {
                          maximumFractionDigits: 4,
                        })}
                      </td>
                      <td className="px-5 py-4 text-right font-black tabular-nums text-red-700">
                        ৳{" "}
                        {item.totalValue.toLocaleString("en-IN", {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4">
              <div className="flex flex-wrap gap-2">
                {cartonCount > 0 && (
                  <span className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">
                    {cartonCount} {cartonCount === 1 ? "carton" : "cartons"}
                  </span>
                )}
                {quantityGroups.map((item) => (
                  <span
                    key={item.unit}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
                  >
                    {formatQty(item.quantity)} {item.unit}
                  </span>
                ))}
              </div>
              <p className="text-sm font-black text-slate-950">
                Total loss:{" "}
                <span className="text-red-700">
                  ৳{" "}
                  {entry.totalLossValue.toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  })}
                </span>
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-black text-slate-950">
              <FileImage className="h-5 w-5 text-red-600" /> Damage proof
            </h2>
            {entry.proofImages.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {entry.proofImages.map((url, index) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                  >
                    <Image
                      src={url}
                      alt={`Damage proof ${index + 1}`}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </a>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-10 text-center text-sm text-slate-500">
                No proof image was uploaded.
              </div>
            )}
          </section>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Description
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {entry.description || "No damage description was recorded."}
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              <History className="h-4 w-4" /> Audit timeline
            </h2>
            <div className="mt-5 space-y-5 border-l border-slate-200 pl-5">
              {entry.movements.length ? (
                entry.movements.map((movement) => (
                  <div key={movement.id} className="relative">
                    {movement.movementKind === "reversal" ? (
                      <RotateCcw className="absolute -left-[31px] top-0 h-5 w-5 bg-white text-amber-600" />
                    ) : (
                      <CheckCircle2 className="absolute -left-[31px] top-0 h-5 w-5 bg-white text-emerald-600" />
                    )}
                    <p className="text-sm font-bold text-slate-900">
                      {movement.movementKind === "reversal"
                        ? "Stock restored"
                        : "Damage deducted"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {movement.quantityDelta > 0 ? "+" : ""}
                      {formatQty(movement.quantityDelta)}{" "}
                      {movement.quantityUnit} · {movement.actorName}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Approved {displayDate(movement.approvedAt)} by Warehouse
                      Owner
                    </p>
                    {movement.reason && (
                      <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs leading-5 text-slate-600">
                        {movement.reason}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="relative">
                  <CheckCircle2 className="absolute -left-[31px] top-0 h-5 w-5 bg-white text-emerald-600" />
                  <p className="text-sm font-bold text-slate-900">
                    Damage posted
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {displayDate(entry.createdAt)} by {entry.createdByName}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-red-700">
              <PackageX className="h-4 w-4" /> Inventory effect
            </div>
            <p className="mt-2 text-sm leading-6 text-red-900/80">
              {isReversed
                ? "The compensating reversal restored this stock."
                : entry.damageMode === "carton"
                  ? "Selected physical cartons were removed from available and in-carton stock."
                  : "The recorded quantity was removed from unpacked available stock."}
            </p>
          </section>
        </aside>
      </div>

      <AlertDialog open={reverseOpen} onOpenChange={setReverseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverse {entry.entryNo}?</AlertDialogTitle>
            <AlertDialogDescription>
              This creates an audited compensating movement and restores the
              exact stock. The original record remains visible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label htmlFor="reversal-reason">Reversal reason</Label>
            <Textarea
              id="reversal-reason"
              value={reversalReason}
              onChange={(event) => setReversalReason(event.target.value)}
              placeholder="Explain why this posted entry must be reversed…"
              className="mt-2"
              maxLength={500}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep entry</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={
                reversalReason.trim().length < 3 || reverseMutation.isPending
              }
              onClick={(event) => {
                event.preventDefault();
                reverseMutation.mutate({ id, reason: reversalReason.trim() });
              }}
            >
              {reverseMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}{" "}
              Reverse and restore stock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
