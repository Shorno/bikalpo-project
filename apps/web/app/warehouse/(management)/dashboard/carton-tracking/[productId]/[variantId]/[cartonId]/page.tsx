"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRightLeft,
  BoxesIcon,
  Calendar,
  Hash,
  Layers,
  MapPin,
  Package,
  QrCode,
  Scale,
  SquareSlash,
  Trash2,
  Weight,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; label: string }> = {
    active: {
      bg: "bg-emerald-100 text-emerald-700 border-emerald-200",
      label: "● Active",
    },
    broken: {
      bg: "bg-red-100 text-red-700 border-red-200",
      label: "⊘ Broken",
    },
    dispatched: {
      bg: "bg-blue-100 text-blue-700 border-blue-200",
      label: "↗ Dispatched",
    },
    sold: {
      bg: "bg-gray-100 text-gray-600 border-gray-200",
      label: "○ Empty/Sold",
    },
  };
  const c = config[status] || config.active;
  return (
    <span
      className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-lg border ${c.bg}`}
    >
      {c.label}
    </span>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="p-2 bg-gray-50 rounded-lg shrink-0">
        <Icon size={16} className="text-gray-500" />
      </div>
      <p className="text-sm text-gray-500 w-32 shrink-0">{label}</p>
      <p
        className={`text-sm font-semibold text-gray-900 flex-1 ${mono ? "font-mono" : ""}`}
      >
        {value ?? "—"}
      </p>
    </div>
  );
}

export default function CartonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const productId = Number(params.productId);
  const variantId = Number(params.variantId);
  const cartonId = Number(params.cartonId);

  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showBreakDialog, setShowBreakDialog] = useState(false);
  const [showEmptyDialog, setShowEmptyDialog] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");

  // ── Fetch carton detail ──
  const { data, isLoading } = useQuery({
    queryKey: ["warehouse", "getCartonById", cartonId],
    queryFn: () =>
      (orpc.warehouse as any).getCartonById.call({ id: cartonId }),
    enabled: !!cartonId,
  });

  // ── Fetch storage areas for transfer ──
  const { data: areasData } = useQuery({
    queryKey: ["warehouse", "getStorageAreas"],
    queryFn: () => (orpc.warehouse as any).getStorageAreas.call({}),
  });

  const cartonData = data?.carton;
  const storageAreas = areasData?.areas ?? [];
  const isActive = cartonData?.status === "active";

  // ── Mutations ──
  const transferMutation = useMutation({
    mutationFn: () =>
      (orpc.warehouse as any).transferCarton.call({
        cartonId,
        newStorageAreaId: Number(selectedAreaId),
      }),
    onSuccess: (res: any) => {
      toast.success(res.message || "Carton transferred successfully");
      queryClient.invalidateQueries({
        queryKey: ["warehouse", "getCartonById"],
      });
      setShowTransferDialog(false);
    },
    onError: (err: any) => toast.error(err.message || "Transfer failed"),
  });

  const breakMutation = useMutation({
    mutationFn: () =>
      (orpc.warehouse as any).breakCarton.call({ cartonId }),
    onSuccess: () => {
      toast.success("Carton broken — stock returned to loose inventory");
      queryClient.invalidateQueries({
        queryKey: ["warehouse"],
      });
      setShowBreakDialog(false);
      router.push(
        `/warehouse/dashboard/carton-tracking/${productId}/${variantId}`,
      );
    },
    onError: (err: any) => toast.error(err.message || "Break failed"),
  });

  const emptyMutation = useMutation({
    mutationFn: () =>
      (orpc.warehouse as any).markCartonEmpty.call({ cartonId }),
    onSuccess: () => {
      toast.success("Carton marked as empty");
      queryClient.invalidateQueries({
        queryKey: ["warehouse"],
      });
      setShowEmptyDialog(false);
      router.push(
        `/warehouse/dashboard/carton-tracking/${productId}/${variantId}`,
      );
    },
    onError: (err: any) => toast.error(err.message || "Operation failed"),
  });

  if (isLoading || !cartonData) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-8 h-8 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-4" />
        <p className="text-sm text-muted-foreground">Loading carton…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-3">
        <Link
          href={`/warehouse/dashboard/carton-tracking/${productId}/${variantId}`}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg hover:bg-amber-50"
          >
            <ArrowLeft size={18} />
          </Button>
        </Link>
        <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
          <Link
            href="/warehouse/dashboard/carton-tracking"
            className="hover:text-amber-600 transition-colors"
          >
            Carton Tracking
          </Link>
          <span>/</span>
          <Link
            href={`/warehouse/dashboard/carton-tracking/${productId}`}
            className="hover:text-amber-600 transition-colors"
          >
            {cartonData.variant?.product?.name || "Product"}
          </Link>
          <span>/</span>
          <Link
            href={`/warehouse/dashboard/carton-tracking/${productId}/${variantId}`}
            className="hover:text-amber-600 transition-colors"
          >
            {cartonData.variant?.unitLabel || "Variant"}
          </Link>
          <span>/</span>
          <span className="font-mono font-semibold text-gray-900">
            {cartonData.cartonId}
          </span>
        </div>
      </div>

      {/* ── Detail Card ── */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 px-6 py-5 border-b border-amber-200/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white rounded-xl border border-amber-200/60 shadow-sm">
                <BoxesIcon size={24} className="text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 font-mono">
                  {cartonData.cartonId}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {cartonData.variant?.product?.name} ·{" "}
                  {cartonData.variant?.brand?.name || ""}{" "}
                  {cartonData.variant?.unitLabel}
                </p>
              </div>
            </div>
            <StatusBadge status={cartonData.status} />
          </div>
        </div>

        {/* Composition Banner */}
        <div className="px-6 py-4 bg-amber-50/60 border-b border-amber-200/40">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1.5">Inside</p>
          <p className="text-sm font-semibold text-gray-900">
            • {cartonData.variant?.brand?.name || ""} {cartonData.variant?.product?.name} {cartonData.variant?.unitLabel} × {cartonData.totalPacks}
          </p>
          <p className="text-sm font-bold text-amber-800 mt-1.5">
            Carton Setup: [{cartonData.totalWeightKg} KG ({cartonData.variant?.weightKg || "—"} KG × {cartonData.totalPacks} pcs)]
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <InfoRow
            icon={Hash}
            label="Carton ID"
            value={cartonData.cartonId}
            mono
          />
          <InfoRow
            icon={Hash}
            label="SKU"
            value={cartonData.variant?.sku}
            mono
          />
          <InfoRow
            icon={Package}
            label="Product"
            value={cartonData.variant?.product?.name}
          />
          <InfoRow
            icon={Layers}
            label="Variant"
            value={`${cartonData.variant?.brand?.name || ""} ${cartonData.variant?.unitLabel || ""}`}
          />
          <InfoRow
            icon={Weight}
            label="Carton Weight"
            value={`${cartonData.totalWeightKg} KG`}
          />
          <InfoRow
            icon={Scale}
            label="Total Quantity"
            value={`${cartonData.totalPacks} pcs`}
          />
          <InfoRow
            icon={Scale}
            label="Remaining"
            value={`${cartonData.totalPacks} pcs`}
          />
          <InfoRow
            icon={MapPin}
            label="Location"
            value={cartonData.storageArea?.name}
          />
          <InfoRow
            icon={QrCode}
            label="Barcode"
            value={cartonData.barcode}
            mono
          />
          <InfoRow
            icon={Calendar}
            label="Created"
            value={
              cartonData.createdAt
                ? new Date(cartonData.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : null
            }
          />
          {cartonData.cartonPrice && (
            <InfoRow
              icon={Scale}
              label="Carton Price"
              value={`৳${Number(cartonData.cartonPrice).toLocaleString()}`}
            />
          )}
          {cartonData.deliveryCostPerUnit && (
            <InfoRow
              icon={Scale}
              label="Delivery Cost"
              value={`৳${Number(cartonData.deliveryCostPerUnit).toLocaleString()}`}
            />
          )}
          {cartonData.note && (
            <InfoRow icon={Hash} label="Note" value={cartonData.note} />
          )}
          {cartonData.brokenAt && (
            <InfoRow
              icon={Calendar}
              label="Broken At"
              value={new Date(cartonData.brokenAt).toLocaleDateString()}
            />
          )}
        </div>

        {/* Actions */}
        {isActive && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="gap-2 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
              onClick={() => setShowTransferDialog(true)}
            >
              <ArrowRightLeft size={14} />
              Transfer Carton
            </Button>
            <Button
              variant="outline"
              className="gap-2 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
              onClick={() => setShowBreakDialog(true)}
            >
              <SquareSlash size={14} />
              Break Carton
            </Button>
            <Button
              variant="outline"
              className="gap-2 hover:bg-gray-100"
              onClick={() => setShowEmptyDialog(true)}
            >
              <Trash2 size={14} />
              Mark as Empty
            </Button>
          </div>
        )}
      </div>

      {/* ── Transfer Dialog ── */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Carton</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            Move <span className="font-mono font-bold">{cartonData.cartonId}</span> to a
            different storage area.
          </p>
          <Select value={selectedAreaId} onValueChange={setSelectedAreaId}>
            <SelectTrigger>
              <SelectValue placeholder="Select storage area" />
            </SelectTrigger>
            <SelectContent>
              {storageAreas.map((a: any) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTransferDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!selectedAreaId || transferMutation.isPending}
              onClick={() => transferMutation.mutate()}
            >
              {transferMutation.isPending ? "Transferring…" : "Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Break Carton Dialog ── */}
      <Dialog open={showBreakDialog} onOpenChange={setShowBreakDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">
              Break Carton
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            This will decompose{" "}
            <span className="font-mono font-bold">{cartonData.cartonId}</span>{" "}
            back into{" "}
            <span className="font-bold">{cartonData.totalPacks} loose packs</span>. This
            action <strong>cannot be undone</strong>.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBreakDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={breakMutation.isPending}
              onClick={() => breakMutation.mutate()}
            >
              {breakMutation.isPending ? "Breaking…" : "Break Carton"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Mark Empty Dialog ── */}
      <Dialog open={showEmptyDialog} onOpenChange={setShowEmptyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Empty</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Mark{" "}
            <span className="font-mono font-bold">{cartonData.cartonId}</span>{" "}
            as empty/sold. This will deduct{" "}
            <span className="font-bold">{cartonData.totalPacks} units</span>{" "}
            from your available inventory.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEmptyDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-gray-800 hover:bg-gray-900 text-white"
              disabled={emptyMutation.isPending}
              onClick={() => emptyMutation.mutate()}
            >
              {emptyMutation.isPending ? "Processing…" : "Mark Empty"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
