"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRightLeft,
  BoxesIcon,
  Calendar,
  ChevronDown,
  ChevronRight,
  Hash,
  Layers,
  MapPin,
  Package,
  Pencil,
  QrCode,
  Scale,
  SquareSlash,
  Trash2,
  Weight,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orpc } from "@/utils/orpc";
import { toast } from "sonner";

// ─── Status Badge ──────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; label: string }> = {
    active: { bg: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "● Active" },
    broken: { bg: "bg-red-100 text-red-700 border-red-200", label: "⊘ Broken" },
    dispatched: { bg: "bg-blue-100 text-blue-700 border-blue-200", label: "↗ Dispatched" },
    sold: { bg: "bg-gray-100 text-gray-600 border-gray-200", label: "○ Sold" },
  };
  const c = config[status] || config.active;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide rounded-md border ${c.bg}`}>
      {c.label}
    </span>
  );
}

// ─── Info Row (for modal) ──────────────────────────────────────

function InfoRow({ icon: Icon, label, value, mono }: {
  icon: React.ElementType; label: string; value: string | number | null | undefined; mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className="p-1.5 bg-gray-50 rounded-lg shrink-0"><Icon size={14} className="text-gray-500" /></div>
      <p className="text-sm text-gray-500 w-28 shrink-0">{label}</p>
      <p className={`text-sm font-semibold text-gray-900 flex-1 ${mono ? "font-mono" : ""}`}>{value ?? "—"}</p>
    </div>
  );
}

// ─── Expandable Variant Row with inline cartons ────────────────

function VariantSection({ variant, productId }: { variant: any; productId: number }) {
  const [expanded, setExpanded] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>("active");
  const [selectedCartonId, setSelectedCartonId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["warehouse", "getCartons", variant.variantId, statusFilter],
    queryFn: () =>
      (orpc.warehouse as any).getCartons.call({
        variantId: variant.variantId,
        status: statusFilter,
        page: 1,
        limit: 100,
      }),
    enabled: expanded,
  });

  const cartons = data?.cartons ?? [];
  const statusOptions = [
    { label: "Active", value: "active" },
    { label: "Broken", value: "broken" },
    { label: "Dispatched", value: "dispatched" },
  ];

  return (
    <>
      {/* Variant header row */}
      <tr
        className="hover:bg-amber-50/30 transition-colors cursor-pointer group"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown size={16} className="text-amber-600 shrink-0" />
            ) : (
              <ChevronRight size={16} className="text-gray-400 group-hover:text-amber-500 shrink-0" />
            )}
            <div className="p-2 bg-amber-50 rounded-lg">
              <BoxesIcon size={16} className="text-amber-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{variant.variantLabel}</p>
              <p className="text-[11px] text-gray-400">{variant.weightKg} KG · SKU: {variant.sku}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3.5 text-center">
          <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-md">
            {variant.brandName}
          </span>
        </td>
        <td className="px-4 py-3.5 text-center font-bold text-gray-900 tabular-nums">
          {variant.activeCartons}
        </td>
        <td className="px-4 py-3.5 text-center font-semibold text-emerald-600 tabular-nums">
          {variant.packType === "loose"
            ? "—"
            : `${variant.totalPacks.toLocaleString()} pcs`}
        </td>
      </tr>

      {/* Expanded carton list */}
      {expanded && (
        <tr>
          <td colSpan={4} className="p-0">
            <div className="bg-gray-50/80 border-t border-b border-gray-200 px-6 py-4">
              {/* Status filter pills */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Filter:</span>
                {statusOptions.map((opt) => (
                  <button
                    key={opt.label}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                      statusFilter === opt.value
                        ? "bg-amber-600 text-white border-amber-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:bg-amber-50"
                    }`}
                    onClick={() => setStatusFilter(opt.value as any)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
                </div>
              ) : cartons.length === 0 ? (
                <div className="text-center py-6 text-sm text-gray-400">
                  No {statusFilter || "active"} cartons found
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Carton ID</th>
                        <th className="text-center px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Weight</th>
                        <th className="text-center px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Qty</th>
                        <th className="text-center px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Location</th>
                        <th className="text-center px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="text-center px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {cartons.map((c: any) => (
                        <tr key={c.id} className="hover:bg-amber-50/30 transition-colors">
                          <td className="px-4 py-2.5">
                            <span className="font-mono font-semibold text-amber-700 text-xs bg-amber-50 px-2 py-1 rounded-md border border-amber-200/60">
                              {c.cartonId}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center font-semibold text-gray-700 tabular-nums text-xs">
                            {c.totalWeightKg} KG
                          </td>
                          <td className="px-4 py-2.5 text-center font-bold text-gray-900 tabular-nums text-xs">
                            {variant.packType === "loose"
                              ? <span className="text-gray-400 font-normal">—</span>
                              : <>{c.totalPacks} <span className="text-gray-400 font-normal">pcs</span></>}
                          </td>
                          <td className="px-4 py-2.5 text-center text-xs text-gray-600">
                            {c.storageArea?.name || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <StatusBadge status={c.status} />
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 gap-1 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700"
                              onClick={() => setSelectedCartonId(c.id)}
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}

      {/* Carton Detail Modal */}
      {selectedCartonId && (
        <CartonDetailModal
          cartonId={selectedCartonId}
          productId={productId}
          onClose={() => setSelectedCartonId(null)}
        />
      )}
    </>
  );
}

// ─── Carton Detail Modal ───────────────────────────────────────

function CartonDetailModal({ cartonId, productId, onClose }: {
  cartonId: number; productId: number; onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showTransfer, setShowTransfer] = useState(false);
  const [showBreak, setShowBreak] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);
  const [showEditPrice, setShowEditPrice] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDeliveryCost, setEditDeliveryCost] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["warehouse", "getCartonById", cartonId],
    queryFn: () => (orpc.warehouse as any).getCartonById.call({ id: cartonId }),
    enabled: !!cartonId,
  });

  const { data: areasData } = useQuery({
    queryKey: ["warehouse", "getStorageAreas"],
    queryFn: () => (orpc.warehouse as any).getStorageAreas.call({}),
  });

  const c = data?.carton;
  const areas = areasData?.areas ?? [];
  const isActive = c?.status === "active";

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["warehouse"] });
  };

  const transferMutation = useMutation({
    mutationFn: () => (orpc.warehouse as any).transferCarton.call({ cartonId, newStorageAreaId: Number(selectedAreaId) }),
    onSuccess: (res: any) => { toast.success(res.message || "Transferred"); invalidateAll(); setShowTransfer(false); },
    onError: (err: any) => toast.error(err.message || "Failed"),
  });

  const breakMutation = useMutation({
    mutationFn: () => (orpc.warehouse as any).breakCarton.call({ cartonId }),
    onSuccess: () => { toast.success("Carton broken — stock returned"); invalidateAll(); onClose(); },
    onError: (err: any) => toast.error(err.message || "Failed"),
  });

  const emptyMutation = useMutation({
    mutationFn: () => (orpc.warehouse as any).markCartonEmpty.call({ cartonId }),
    onSuccess: () => { toast.success("Carton marked empty"); invalidateAll(); onClose(); },
    onError: (err: any) => toast.error(err.message || "Failed"),
  });

  const updatePriceMutation = useMutation({
    mutationFn: () =>
      (orpc.warehouse as any).updateCartonPrice.call({
        cartonId,
        cartonPrice: editPrice || undefined,
        deliveryCostPerUnit: editDeliveryCost || undefined,
      }),
    onSuccess: () => {
      toast.success("Carton price updated");
      invalidateAll();
      setShowEditPrice(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to update price"),
  });

  return (
    <>
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          {isLoading || !c ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-2 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 px-6 py-4 border-b border-amber-200/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white rounded-xl border border-amber-200/60 shadow-sm">
                      <BoxesIcon size={20} className="text-amber-600" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900 font-mono">{c.cartonId}</h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {c.variant?.product?.name} · {c.variant?.brand?.name || ""} {c.variant?.unitLabel}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              </div>

              {/* Composition */}
              <div className="px-6 py-3 bg-amber-50/60 border-b border-amber-200/40">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Inside</p>
                <p className="text-sm font-semibold text-gray-900">
                  • {c.variant?.brand?.name || ""} {c.variant?.product?.name} {c.variant?.unitLabel} × {c.totalPacks}
                </p>
                <p className="text-xs font-bold text-amber-800 mt-1">
                  [{c.totalWeightKg} KG — {c.totalPacks} pcs]
                </p>
              </div>

              {/* Detail rows */}
              <div className="px-6 py-3 max-h-[40vh] overflow-y-auto">
                <InfoRow icon={Hash} label="Carton ID" value={c.cartonId} mono />
                <InfoRow icon={Hash} label="SKU" value={c.variant?.sku} mono />
                <InfoRow icon={Package} label="Product" value={c.variant?.product?.name} />
                <InfoRow icon={Layers} label="Variant" value={`${c.variant?.brand?.name || ""} ${c.variant?.unitLabel || ""}`} />
                <InfoRow icon={Weight} label="Weight" value={`${c.totalWeightKg} KG`} />
                <InfoRow icon={Scale} label="Quantity" value={`${c.totalPacks} pcs`} />
                <InfoRow icon={MapPin} label="Location" value={c.storageArea?.name} />
                <InfoRow icon={QrCode} label="Barcode" value={c.barcode} mono />
                <InfoRow icon={Calendar} label="Created" value={c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null} />
                {c.cartonPrice && <InfoRow icon={Scale} label="Price" value={`৳${Number(c.cartonPrice).toLocaleString()}`} />}
                {c.note && <InfoRow icon={Hash} label="Note" value={c.note} />}
                {c.brokenAt && <InfoRow icon={Calendar} label="Broken At" value={new Date(c.brokenAt).toLocaleDateString()} />}
              </div>

              {/* Actions */}
              {isActive && (
                <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700" onClick={() => { setEditPrice(c.cartonPrice ? String(c.cartonPrice) : ""); setEditDeliveryCost(c.deliveryCostPerUnit ? String(c.deliveryCostPerUnit) : ""); setShowEditPrice(true); }}>
                    <Pencil size={13} /> Edit Price
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700" onClick={() => setShowTransfer(true)}>
                    <ArrowRightLeft size={13} /> Transfer
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs hover:bg-red-50 hover:border-red-300 hover:text-red-700" onClick={() => setShowBreak(true)}>
                    <SquareSlash size={13} /> Break
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs hover:bg-gray-100" onClick={() => setShowEmpty(true)}>
                    <Trash2 size={13} /> Mark Empty
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Sub-dialogs for actions */}
      <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transfer Carton</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500">Move <span className="font-mono font-bold">{c?.cartonId}</span> to a different storage area.</p>
          <Select value={selectedAreaId} onValueChange={setSelectedAreaId}>
            <SelectTrigger><SelectValue placeholder="Select storage area" /></SelectTrigger>
            <SelectContent>{areas.map((a: any) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransfer(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" disabled={!selectedAreaId || transferMutation.isPending} onClick={() => transferMutation.mutate()}>
              {transferMutation.isPending ? "Transferring…" : "Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBreak} onOpenChange={setShowBreak}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-red-600">Break Carton</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">
            This will decompose <span className="font-mono font-bold">{c?.cartonId}</span> back into <span className="font-bold">{c?.totalPacks} loose packs</span>. This action <strong>cannot be undone</strong>.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBreak(false)}>Cancel</Button>
            <Button variant="destructive" disabled={breakMutation.isPending} onClick={() => breakMutation.mutate()}>
              {breakMutation.isPending ? "Breaking…" : "Break Carton"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEmpty} onOpenChange={setShowEmpty}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark as Empty</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">
            Mark <span className="font-mono font-bold">{c?.cartonId}</span> as empty/sold. This will deduct <span className="font-bold">{c?.totalPacks} units</span> from inventory.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmpty(false)}>Cancel</Button>
            <Button className="bg-gray-800 hover:bg-gray-900 text-white" disabled={emptyMutation.isPending} onClick={() => emptyMutation.mutate()}>
              {emptyMutation.isPending ? "Processing…" : "Mark Empty"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditPrice} onOpenChange={setShowEditPrice}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Carton Price</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500 mb-1">
            Update pricing for <span className="font-mono font-bold text-gray-700">{c?.cartonId}</span>
          </p>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-2 block">Carton Price (৳)</Label>
              <Input
                type="number"
                placeholder="Enter carton price"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="h-11 bg-gray-50 border-gray-200"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-2 block">Delivery Cost (৳)</Label>
              <Input
                type="number"
                placeholder="Enter delivery cost"
                value={editDeliveryCost}
                onChange={(e) => setEditDeliveryCost(e.target.value)}
                className="h-11 bg-gray-50 border-gray-200"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditPrice(false)}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={updatePriceMutation.isPending || (!editPrice && !editDeliveryCost)}
              onClick={() => updatePriceMutation.mutate()}
            >
              {updatePriceMutation.isPending ? "Saving…" : "Save Price"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────

export default function CartonVariantBreakdownPage() {
  const params = useParams();
  const productId = Number(params.productId);

  const { data, isLoading } = useQuery({
    queryKey: ["warehouse", "getCartonTrackingVariants", productId],
    queryFn: () =>
      (orpc.warehouse as any).getCartonTrackingVariants.call({ productId }),
    enabled: !!productId,
  });

  const product = data?.product ?? { productName: "Loading...", productImage: "" };
  const variants = data?.variants ?? [];

  const totalCartons = variants.reduce((s: number, v: any) => s + v.activeCartons, 0);
  const totalPacks = variants.reduce((s: number, v: any) => s + v.totalPacks, 0);

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb + Header ── */}
      <div className="flex items-center gap-3">
        <Link href="/warehouse/dashboard/carton-tracking">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-amber-50">
            <ArrowLeft size={18} />
          </Button>
        </Link>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/warehouse/dashboard/carton-tracking" className="hover:text-amber-600 transition-colors">
            Carton Tracking
          </Link>
          <span>/</span>
          <span className="font-semibold text-gray-900">{product.productName}</span>
        </div>
      </div>

      {/* ── Product Info Card ── */}
      <div className="flex items-center gap-4 p-5 bg-gradient-to-r from-amber-50/80 to-orange-50/40 border border-amber-200/60 rounded-2xl">
        <div className="shrink-0 w-14 h-14 rounded-xl bg-white border border-amber-200/60 flex items-center justify-center overflow-hidden shadow-sm">
          {product.productImage ? (
            <Image
              src={product.productImage}
              alt={product.productName}
              width={56}
              height={56}
              className="w-14 h-14 object-cover"
              unoptimized={product.productImage?.startsWith("http")}
            />
          ) : (
            <Package size={24} className="text-amber-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-900">{product.productName}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {variants.length} variant{variants.length !== 1 ? "s" : ""} ·{" "}
            {totalCartons} active carton{totalCartons !== 1 ? "s" : ""} ·{" "}
            {totalPacks.toLocaleString()} pcs
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <div className="text-center px-4 py-2 bg-white/80 rounded-xl border">
            <p className="text-xl font-extrabold text-amber-700 tabular-nums">{totalCartons}</p>
            <p className="text-[10px] font-semibold text-gray-500 uppercase">Cartons</p>
          </div>
          <div className="text-center px-4 py-2 bg-white/80 rounded-xl border">
            <p className="text-xl font-extrabold text-emerald-700 tabular-nums">{totalPacks.toLocaleString()}</p>
            <p className="text-[10px] font-semibold text-gray-500 uppercase">Units</p>
          </div>
        </div>
      </div>

      {/* ── Variant Breakdown (Expandable) ── */}
      <div>
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Layers size={14} />
          Variant Breakdown — Click to expand
        </p>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 border rounded-xl bg-gray-50/50">
            <div className="w-8 h-8 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">Loading variants…</p>
          </div>
        ) : variants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed rounded-xl bg-gray-50/50">
            <BoxesIcon className="text-gray-300 mb-3" size={40} />
            <p className="text-gray-500 font-medium">No cartons for this product</p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100/80 border-b border-gray-200">
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Variant</th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Brand</th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Cartons</th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Units</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {variants.map((v: any) => (
                  <VariantSection key={v.variantId} variant={v} productId={productId} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
