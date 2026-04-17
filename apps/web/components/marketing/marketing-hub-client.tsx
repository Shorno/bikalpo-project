"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowRight,
  Check,
  Clock,
  Eye,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Package,
  Phone,
  Printer,
  Send,
  ShoppingCart,
  Truck,
  X,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { client, orpc } from "@/utils/orpc";

// ── Constants ───────────────────────────────────────────────────────
const ALL_CATEGORIES = [
  { value: "all", label: "All", icon: Package },
  { value: "shop_branding", label: "Shop Branding", icon: Printer },
  { value: "warehouse_branding", label: "Warehouse", icon: Package },
  { value: "product_promotion", label: "Product Promo", icon: ShoppingCart },
  { value: "campaign", label: "Campaign", icon: Send },
];

// Categories hidden from each role
const HIDDEN_CATEGORIES: Record<string, string[]> = {
  shop_owner: ["warehouse_branding"],
  warehouse: ["shop_branding"],
};

const statusConfig: Record<
  string,
  { label: string; dotColor: string; bgColor: string; textColor: string }
> = {
  pending: {
    label: "Pending Review",
    dotColor: "bg-amber-400",
    bgColor: "bg-amber-50",
    textColor: "text-amber-700",
  },
  approved: {
    label: "Approved",
    dotColor: "bg-blue-400",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
  },
  dispatched: {
    label: "Dispatched",
    dotColor: "bg-emerald-400",
    bgColor: "bg-emerald-50",
    textColor: "text-emerald-700",
  },
  delivered: {
    label: "Delivered",
    dotColor: "bg-green-500",
    bgColor: "bg-green-50",
    textColor: "text-green-700",
  },
  rejected: {
    label: "Rejected",
    dotColor: "bg-red-400",
    bgColor: "bg-red-50",
    textColor: "text-red-700",
  },
};

const materialTypeLabels: Record<string, string> = {
  banner: "Banner",
  sticker: "Sticker",
  leaflet: "Leaflet",
  poster: "Poster",
  standee: "Standee",
  qr_sticker: "QR Sticker",
};

type OrderFormState = {
  materialId: string;
  materialTitle: string;
  materialType: string;
  designUrl: string;
  sizeFormat: string;
  quantity: number;
  deliveryType: string;
  paymentType: string;
  deliveryAddress: string;
  deliveryContact: string;
};

// ── Component ───────────────────────────────────────────────────────
export function MarketingHubClient({ userRole }: { userRole: "shop_owner" | "warehouse" }) {
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<"catalog" | "requests">(
    "catalog",
  );
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [orderDialog, setOrderDialog] = useState(false);
  const [trackingId, setTrackingId] = useState<string | null>(null);

  // Filter categories based on role
  const hidden = HIDDEN_CATEGORIES[userRole] ?? [];
  const categories = ALL_CATEGORIES.filter(
    (c) => c.value === "all" || !hidden.includes(c.value),
  );

  const [orderForm, setOrderForm] = useState<OrderFormState>({
    materialId: "",
    materialTitle: "",
    materialType: "",
    designUrl: "",
    sizeFormat: "",
    quantity: 1,
    deliveryType: "courier",
    paymentType: "free",
    deliveryAddress: "",
    deliveryContact: "",
  });

  // ── Data ───────────────────────────────────────────────────────
  const categoryInput =
    selectedCategory === "all"
      ? undefined
      : ({ category: selectedCategory } as any);

  const { data: materialsData, isLoading: materialsLoading } = useQuery({
    ...orpc.marketing.listMaterials.queryOptions({ input: categoryInput }),
  });

  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    ...orpc.marketing.myRequests.queryOptions({ input: undefined }),
  });

  const allMaterials = materialsData?.materials ?? [];
  // Filter out materials from hidden categories
  const materials = allMaterials.filter(
    (mat: any) => !hidden.includes(mat.category ?? ""),
  );
  const myRequests = requestsData?.requests ?? [];

  // Derive counts
  const pendingCount = myRequests.filter(
    (r: any) => r.status === "pending",
  ).length;
  const activeCount = myRequests.filter((r: any) =>
    ["approved", "dispatched"].includes(r.status),
  ).length;
  const deliveredCount = myRequests.filter(
    (r: any) => r.status === "delivered",
  ).length;

  // ── Mutation ───────────────────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: (input: any) => client.marketing.submitRequest(input),
    onSuccess: (data) => {
      toast.success(`Request ${data.requestNumber} submitted!`);
      queryClient.invalidateQueries();
      setOrderDialog(false);
      setActiveView("requests");
    },
    onError: (e) => toast.error(e.message || "Failed to submit"),
  });

  const openOrderDialog = (material: any) => {
    setOrderForm({
      materialId: material.id,
      materialTitle: material.title,
      materialType: material.type,
      designUrl: material.designFileUrl || "",
      sizeFormat: material.sizeFormat || "",
      quantity: 1,
      deliveryType: "courier",
      paymentType: "free",
      deliveryAddress: "",
      deliveryContact: "",
    });
    setOrderDialog(true);
  };

  const handleSubmitRequest = () => {
    if (orderForm.quantity < 1) return toast.error("Minimum quantity is 1");
    submitMutation.mutate({
      materialId: orderForm.materialId,
      quantity: orderForm.quantity,
      deliveryType: orderForm.deliveryType as any,
      paymentType: orderForm.paymentType as any,
      deliveryAddress: orderForm.deliveryAddress || undefined,
      deliveryContact: orderForm.deliveryContact || undefined,
    });
  };

  // Tracking detail
  const selectedTracking = myRequests.find(
    (r: any) => r.id === trackingId,
  ) as any;

  const STATUS_STEPS = [
    { key: "pending", label: "Submitted", icon: Clock },
    { key: "approved", label: "Approved", icon: Check },
    { key: "dispatched", label: "Dispatched", icon: Truck },
    { key: "delivered", label: "Delivered", icon: Package },
  ];
  const STATUS_ORDER: Record<string, number> = {
    pending: 0,
    approved: 1,
    dispatched: 2,
    delivered: 3,
    rejected: -1,
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Marketing Materials
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView("catalog")}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeView === "catalog"
                ? "bg-gray-900 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Catalog
          </button>
          <button
            onClick={() => setActiveView("requests")}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors relative ${
              activeView === "requests"
                ? "bg-gray-900 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            My Requests
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center size-4 rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Quick Stats ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickStat
          icon={<Package className="w-5 h-5 text-blue-600" />}
          label="Available Materials"
          value={materialsLoading ? null : String(materials.length)}
          bg="bg-blue-50"
        />
        <QuickStat
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          label="Pending Requests"
          value={requestsLoading ? null : String(pendingCount)}
          bg="bg-amber-50"
        />
        <QuickStat
          icon={<Truck className="w-5 h-5 text-emerald-600" />}
          label="Active / In Transit"
          value={requestsLoading ? null : String(activeCount)}
          bg="bg-emerald-50"
        />
        <QuickStat
          icon={<Check className="w-5 h-5 text-green-600" />}
          label="Delivered"
          value={requestsLoading ? null : String(deliveredCount)}
          bg="bg-green-50"
        />
      </div>

      {/* ═════════════════════════════════════════════════════════════
          CATALOG VIEW
      ═════════════════════════════════════════════════════════════ */}
      {activeView === "catalog" && (
        <>
          {/* Category Filter */}
          <div className="bg-white rounded-lg border shadow-sm px-4 py-3">
            <div className="flex items-center gap-2 overflow-x-auto">
              {categories.map((cat) => {
                const active = selectedCategory === cat.value;
                return (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(cat.value)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                      active
                        ? "bg-gray-900 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <cat.icon className="w-3.5 h-3.5" />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Material Grid */}
          {materialsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg border shadow-sm overflow-hidden"
                >
                  <Skeleton className="w-full aspect-[16/10]" />
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : materials.length === 0 ? (
            <div className="bg-white rounded-lg border shadow-sm p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <Package className="w-8 h-8 text-gray-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-700 mb-1">
                No Materials Available
              </h2>
              <p className="text-sm text-gray-500 max-w-sm">
                Marketing materials for this category are not available yet.
                Check back later for new designs.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {materials.map((mat: any) => (
                <div
                  key={mat.id}
                  className="bg-white rounded-lg border shadow-sm overflow-hidden group hover:border-gray-300 transition-colors"
                >
                  {/* Design Preview */}
                  <div className="relative w-full aspect-[16/10] bg-gray-50 border-b">
                    {mat.designFileUrl ? (
                      <Image
                        src={mat.designFileUrl}
                        alt={mat.title}
                        fill
                        className="object-contain p-2"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                          <ImageIcon className="w-7 h-7 text-gray-300" />
                        </div>
                      </div>
                    )}
                    {/* Type Badge */}
                    <span className="absolute top-2.5 right-2.5 inline-flex items-center px-2 py-0.5 rounded-md bg-white/90 backdrop-blur border text-xs font-medium text-gray-700 capitalize shadow-sm">
                      {materialTypeLabels[mat.type] || mat.type}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-gray-900 group-hover:text-gray-700">
                        {mat.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        {mat.sizeFormat && (
                          <span className="text-xs text-gray-500">
                            {mat.sizeFormat}
                          </span>
                        )}
                        {mat.sizeFormat && mat.category && (
                          <span className="text-gray-300">·</span>
                        )}
                        <span className="text-xs text-gray-400 capitalize">
                          {(mat.category || "").replace(/_/g, " ")}
                        </span>
                      </div>
                      {mat.description && (
                        <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                          {mat.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                        <Check className="w-3 h-3" />
                        Free
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs font-medium border-gray-300 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-all"
                        onClick={() => openOrderDialog(mat)}
                      >
                        <ShoppingCart className="mr-1.5 w-3.5 h-3.5" />
                        Request
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═════════════════════════════════════════════════════════════
          REQUESTS VIEW
      ═════════════════════════════════════════════════════════════ */}
      {activeView === "requests" && (
        <>
          {requestsLoading ? (
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            </div>
          ) : myRequests.length === 0 ? (
            <div className="bg-white rounded-lg border shadow-sm p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <ShoppingCart className="w-8 h-8 text-gray-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-700 mb-1">
                No Requests Yet
              </h2>
              <p className="text-sm text-gray-500 max-w-sm mb-4">
                Browse the catalog and request marketing materials for your
                business.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setActiveView("catalog")}
              >
                Browse Catalog
                <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <div className="bg-white rounded-lg border shadow-sm divide-y divide-gray-100">
              {/* Table Header */}
              <div className="px-5 py-3 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Your Requests
                </h3>
                <span className="text-xs text-gray-400 ml-auto">
                  {myRequests.length} total
                </span>
              </div>

              {/* Request Cards */}
              {myRequests.map((req: any) => {
                const sc = statusConfig[req.status] ?? statusConfig.pending;
                return (
                  <div
                    key={req.id}
                    className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors"
                  >
                    {/* Material Preview */}
                    <div className="w-12 h-12 rounded-lg border bg-gray-50 overflow-hidden shrink-0 flex items-center justify-center">
                      {req.material?.designFileUrl ? (
                        <Image
                          src={req.material.designFileUrl}
                          alt={req.material?.title || ""}
                          width={48}
                          height={48}
                          className="object-contain"
                        />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-gray-300" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {req.material?.title || "—"}
                        </p>
                        <span className="text-xs text-gray-400 font-mono shrink-0">
                          {req.requestNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>
                          {materialTypeLabels[req.material?.type] ||
                            req.material?.type}
                        </span>
                        <span className="text-gray-300">·</span>
                        <span>{req.quantity} pcs</span>
                        <span className="text-gray-300">·</span>
                        <span className="capitalize">
                          {req.deliveryType.replace(/_/g, " ")}
                        </span>
                        <span className="text-gray-300">·</span>
                        <span>
                          {format(new Date(req.createdAt), "MMM d, yyyy")}
                        </span>
                      </div>
                    </div>

                    {/* Status + Action */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bgColor} ${sc.textColor}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${sc.dotColor}`}
                        />
                        {sc.label}
                      </span>
                      <button
                        onClick={() => setTrackingId(req.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Track
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═════════════════════════════════════════════════════════════
          ORDER DIALOG
      ═════════════════════════════════════════════════════════════ */}
      <Dialog open={orderDialog} onOpenChange={() => setOrderDialog(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Material</DialogTitle>
            <DialogDescription>
              Submit a request for{" "}
              <strong>{orderForm.materialTitle}</strong>
            </DialogDescription>
          </DialogHeader>

          {/* Preview */}
          {orderForm.designUrl && (
            <div className="relative w-full aspect-video rounded-lg overflow-hidden border bg-gray-50">
              <Image
                src={orderForm.designUrl}
                alt="Preview"
                fill
                className="object-contain p-2"
              />
            </div>
          )}

          {/* Material Info Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <span className="text-xs text-gray-500">Type</span>
              <p className="text-sm font-medium text-gray-900 capitalize mt-0.5">
                {materialTypeLabels[orderForm.materialType] ||
                  orderForm.materialType}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <span className="text-xs text-gray-500">Size</span>
              <p className="text-sm font-medium text-gray-900 mt-0.5">
                {orderForm.sizeFormat || "Standard"}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">
                Quantity
              </Label>
              <Input
                type="number"
                min={1}
                value={orderForm.quantity}
                onChange={(e) =>
                  setOrderForm((p) => ({
                    ...p,
                    quantity: parseInt(e.target.value) || 1,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">
                Delivery Method
              </Label>
              <Select
                value={orderForm.deliveryType}
                onValueChange={(v) =>
                  setOrderForm((p) => ({ ...p, deliveryType: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="courier">
                    <span className="flex items-center gap-2">
                      <Truck className="w-3.5 h-3.5 text-gray-400" />
                      Courier Delivery
                    </span>
                  </SelectItem>
                  <SelectItem value="warehouse_pickup">
                    <span className="flex items-center gap-2">
                      <Package className="w-3.5 h-3.5 text-gray-400" />
                      Warehouse Pickup
                    </span>
                  </SelectItem>
                  <SelectItem value="sales_delivery">
                    <span className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      Sales Delivery
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">
                Delivery Address
              </Label>
              <Input
                placeholder="Full address for delivery"
                value={orderForm.deliveryAddress}
                onChange={(e) =>
                  setOrderForm((p) => ({
                    ...p,
                    deliveryAddress: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">
                Contact Number
              </Label>
              <Input
                placeholder="017XXXXXXXX"
                value={orderForm.deliveryContact}
                onChange={(e) =>
                  setOrderForm((p) => ({
                    ...p,
                    deliveryContact: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOrderDialog(false)}
              disabled={submitMutation.isPending}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitRequest}
              disabled={submitMutation.isPending}
              className="text-xs bg-gray-900 hover:bg-gray-800"
            >
              {submitMutation.isPending && (
                <Loader2 className="mr-2 w-3.5 h-3.5 animate-spin" />
              )}
              <Send className="mr-1.5 w-3.5 h-3.5" />
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═════════════════════════════════════════════════════════════
          TRACKING DIALOG
      ═════════════════════════════════════════════════════════════ */}
      <Dialog open={!!trackingId} onOpenChange={() => setTrackingId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-500" />
              {selectedTracking?.requestNumber}
            </DialogTitle>
          </DialogHeader>

          {selectedTracking && (
            <div className="space-y-5">
              {/* Material Info */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg border bg-gray-50 overflow-hidden shrink-0 flex items-center justify-center">
                  {selectedTracking.material?.designFileUrl ? (
                    <Image
                      src={selectedTracking.material.designFileUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="object-contain"
                    />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-gray-300" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedTracking.material?.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {selectedTracking.quantity} pcs ·{" "}
                    {materialTypeLabels[selectedTracking.material?.type] ||
                      selectedTracking.material?.type}
                  </p>
                </div>
              </div>

              {/* Status Pipeline */}
              {selectedTracking.status !== "rejected" ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Status Tracking
                  </p>
                  <div className="space-y-0">
                    {STATUS_STEPS.map((step, idx) => {
                      const currentStep =
                        STATUS_ORDER[selectedTracking.status] ?? -1;
                      const completed = currentStep >= idx;
                      const isLast = idx === STATUS_STEPS.length - 1;
                      return (
                        <div key={step.key} className="flex gap-3">
                          {/* Line + Dot */}
                          <div className="flex flex-col items-center">
                            <div
                              className={`flex items-center justify-center size-7 rounded-full border-2 transition-all ${
                                completed
                                  ? "bg-emerald-500 border-emerald-500 text-white"
                                  : "border-gray-200 bg-white text-gray-400"
                              }`}
                            >
                              {completed ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <step.icon className="w-3.5 h-3.5" />
                              )}
                            </div>
                            {!isLast && (
                              <div
                                className={`w-0.5 h-6 transition-all ${
                                  currentStep > idx
                                    ? "bg-emerald-400"
                                    : "bg-gray-200"
                                }`}
                              />
                            )}
                          </div>
                          {/* Label */}
                          <div className="pt-1">
                            <p
                              className={`text-sm font-medium ${
                                completed
                                  ? "text-gray-900"
                                  : "text-gray-400"
                              }`}
                            >
                              {step.label}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <X className="w-4 h-4 text-red-500" />
                    <p className="text-sm font-semibold text-red-700">
                      Request Rejected
                    </p>
                  </div>
                  {selectedTracking.adminNote && (
                    <p className="text-xs text-red-600 ml-6">
                      {selectedTracking.adminNote}
                    </p>
                  )}
                </div>
              )}

              {/* Details */}
              <div className="space-y-2.5">
                <DetailRow
                  label="Delivery"
                  value={selectedTracking.deliveryType.replace(/_/g, " ")}
                  capitalize
                />
                {selectedTracking.deliveryAddress && (
                  <DetailRow
                    label="Address"
                    value={selectedTracking.deliveryAddress}
                  />
                )}
                {selectedTracking.deliveryContact && (
                  <DetailRow
                    label="Contact"
                    value={selectedTracking.deliveryContact}
                  />
                )}
                <DetailRow
                  label="Submitted"
                  value={format(
                    new Date(selectedTracking.createdAt),
                    "MMM d, yyyy",
                  )}
                />
                <DetailRow
                  label="Payment"
                  value={selectedTracking.paymentType}
                  capitalize
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────── */

function QuickStat({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  bg: string;
}) {
  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center shrink-0`}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          {value === null ? (
            <Skeleton className="h-6 w-12 mt-0.5" />
          ) : (
            <p className="text-xl font-bold text-gray-900">{value}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  capitalize: cap,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span
        className={`text-xs font-medium text-gray-900 ${cap ? "capitalize" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
