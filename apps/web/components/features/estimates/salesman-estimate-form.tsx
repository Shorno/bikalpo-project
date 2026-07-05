"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarIcon,
  CheckCircle2,
  Loader2,
  Package,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CustomerSelect } from "@/components/features/estimates/customer-select";
import { MultiCustomerSelect } from "@/components/features/estimates/multi-customer-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { SALES_PORTAL_BASE } from "@/lib/sales-routing";
import { cn } from "@/lib/utils";
import { client, orpc } from "@/utils/orpc";

type CatalogProduct = {
  inventoryId: number;
  variantId: number;
  productId: number;
  name: string;
  productName: string;
  brandName: string | null;
  variantLabel: string;
  sku: string | null;
  image: string | null;
  availableQty: number;
  unitPrice: number;
};

type EstimateFormItem = CatalogProduct & {
  quantity: number;
};

type ExistingEstimate = {
  id: number;
  customerId: string;
  discountPercent?: string | number | null;
  notes?: string | null;
  validUntil?: string | Date | null;
  status?: string;
  items: Array<{
    variantId?: number | null;
    productId: number;
    productName: string;
    productImage?: string | null;
    productSize?: string | null;
    quantity: number;
    unitPrice: string | number;
  }>;
};

type SalesmanEstimateFormProps = {
  mode: "create" | "edit";
  estimate?: ExistingEstimate;
  preselectedCustomerId?: string | null;
  basePath?: string;
};

function formatMoney(value: number | string | null | undefined) {
  return `Tk ${Number(value ?? 0).toLocaleString("en-BD", {
    maximumFractionDigits: 2,
  })}`;
}

function toDateInput(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(value: string) {
  if (!value) return "Select date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Select date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function SalesmanEstimateForm({
  mode,
  estimate,
  preselectedCustomerId,
  basePath = SALES_PORTAL_BASE,
}: SalesmanEstimateFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [productSearch, setProductSearch] = useState("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>(
    estimate?.customerId
      ? [estimate.customerId]
      : preselectedCustomerId
        ? [preselectedCustomerId]
        : [],
  );
  const [items, setItems] = useState<EstimateFormItem[]>(
    () =>
      estimate?.items.flatMap((item) => {
        if (item.variantId == null) return [];

        return [
          {
            inventoryId: item.variantId,
            variantId: item.variantId,
            productId: item.productId,
            name: item.productName,
            productName: item.productName,
            brandName: null,
            variantLabel: item.productSize || "Variant",
            sku: null,
            image: item.productImage ?? null,
            availableQty: item.quantity,
            unitPrice: Number(item.unitPrice),
            quantity: item.quantity,
          },
        ];
      }) ?? [],
  );
  const [quantityInputs, setQuantityInputs] = useState<Record<number, string>>(
    () =>
      Object.fromEntries(
        (estimate?.items ?? [])
          .filter((item) => item.variantId != null)
          .map((item) => [item.variantId as number, String(item.quantity)]),
      ),
  );
  const [discountPercent, setDiscountPercent] = useState(
    Number(estimate?.discountPercent ?? 0),
  );
  const [validUntil, setValidUntil] = useState(toDateInput(estimate?.validUntil));
  const [notes, setNotes] = useState(estimate?.notes ?? "");

  const { data: catalogData, isLoading: catalogLoading } = useQuery({
    queryKey: ["salesman-estimate-catalog", productSearch],
    queryFn: () =>
      client.salesman.getEstimateCatalog({
        search: productSearch.trim() || undefined,
      }),
    staleTime: 1000 * 60 * 2,
  });

  const catalog = (catalogData?.products ?? []) as CatalogProduct[];

  const selectedVariantIds = new Set(items.map((item) => item.variantId));
  const availableCatalog = catalog.filter(
    (product) => !selectedVariantIds.has(product.variantId),
  );

  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const discountAmount = subtotal * (discountPercent / 100);
  const total = Math.max(0, subtotal - discountAmount);
  const needsApproval = discountPercent > 5;
  const hasLegacyItems =
    mode === "edit" && estimate?.items.some((item) => item.variantId == null);

  const createMutation = useMutation({
    mutationFn: () =>
      client.salesman.createEstimate({
        customerIds: selectedCustomerIds,
        items: items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        discountPercent,
        validUntil: validUntil ? new Date(validUntil) : null,
        notes: notes.trim() || null,
      }),
    onSuccess: async (result) => {
      toast.success(result.message);
      await queryClient.invalidateQueries({
        queryKey: orpc.salesman.getEstimates.key(),
      });
      router.push(`${basePath}/estimates`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create estimate");
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      client.salesman.updateEstimate({
        id: estimate!.id,
        customerIds: selectedCustomerIds,
        items: items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        discountPercent,
        validUntil: validUntil ? new Date(validUntil) : null,
        notes: notes.trim() || null,
      }),
    onSuccess: async () => {
      toast.success("Estimate updated");
      await queryClient.invalidateQueries({
        queryKey: orpc.salesman.getEstimates.key(),
      });
      router.push(`${basePath}/estimates`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update estimate");
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const addProduct = (product: CatalogProduct) => {
    setItems((current) => [...current, { ...product, quantity: 1 }]);
    setQuantityInputs((current) => ({
      ...current,
      [product.variantId]: "1",
    }));
  };

  const updateQuantity = (variantId: number, quantity: number) => {
    const nextQuantity = Math.max(1, quantity);
    setItems((current) =>
      current.map((item) =>
        item.variantId === variantId
          ? {
              ...item,
              quantity: Math.min(nextQuantity, item.availableQty),
            }
          : item,
      ),
    );
  };

  const handleQuantityChange = (
    variantId: number,
    value: string,
    availableQty: number,
  ) => {
    const digitsOnly = value.replace(/[^\d]/g, "");
    setQuantityInputs((current) => ({
      ...current,
      [variantId]: digitsOnly,
    }));

    if (!digitsOnly) return;

    const parsed = Number.parseInt(digitsOnly, 10);
    if (!Number.isFinite(parsed)) return;
    updateQuantity(variantId, Math.min(parsed, availableQty));
  };

  const commitQuantity = (variantId: number, availableQty: number) => {
    const rawValue = quantityInputs[variantId] ?? "";
    const parsed = Number.parseInt(rawValue, 10);
    const nextQuantity = Number.isFinite(parsed)
      ? Math.min(Math.max(1, parsed), availableQty)
      : 1;

    updateQuantity(variantId, nextQuantity);
    setQuantityInputs((current) => ({
      ...current,
      [variantId]: String(nextQuantity),
    }));
  };

  const removeItem = (variantId: number) => {
    setItems((current) => current.filter((item) => item.variantId !== variantId));
    setQuantityInputs((current) => {
      const next = { ...current };
      delete next[variantId];
      return next;
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedCustomerIds.length === 0) {
      toast.error("Select at least one customer");
      return;
    }
    if (items.length === 0) {
      toast.error("Add at least one product");
      return;
    }
    if (hasLegacyItems) {
      toast.error("This legacy estimate must be recreated from warehouse stock");
      return;
    }
    if (mode === "edit") updateMutation.mutate();
    else createMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {hasLegacyItems && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Legacy estimate</AlertTitle>
          <AlertDescription>
            This estimate has products without warehouse variant snapshots. Create
            a new estimate from warehouse stock instead.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        {/* Main: warehouse product catalog */}
        <Card className="shadow-none">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div>
                <h2 className="text-sm font-semibold leading-none">
                  Warehouse Products
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tap a product to add it to the estimate.
                </p>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Search products, brand, SKU..."
                className="pl-9"
              />
            </div>

            <div className="max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {catalogLoading ? (
                  <div className="col-span-full flex items-center justify-center gap-2 rounded-md border p-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading products
                  </div>
                ) : availableCatalog.length === 0 ? (
                  <p className="col-span-full rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No stocked products found.
                  </p>
                ) : (
                  availableCatalog.map((product) => (
                    <button
                      key={product.variantId}
                      type="button"
                      onClick={() => addProduct(product)}
                      className="flex min-h-20 items-center gap-3 rounded-md border p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
                    >
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                        {product.image ? (
                          <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        ) : (
                          <Package className="m-3 h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium">
                          {product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(product.unitPrice)} · Stock{" "}
                          {product.availableQty}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar: estimate cart */}
        <Card className="shadow-none lg:sticky lg:top-6">
          <CardContent className="space-y-4 p-4">
            {/* Customers */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">
                  {mode === "edit" ? "Customer" : "Customers"}
                </h2>
              </div>
              {mode === "edit" ? (
                <CustomerSelect
                  value={selectedCustomerIds[0]}
                  onSelect={(customerId) => setSelectedCustomerIds([customerId])}
                />
              ) : (
                <MultiCustomerSelect
                  value={selectedCustomerIds}
                  onSelect={setSelectedCustomerIds}
                />
              )}
            </div>

            <Separator />

            {/* Estimate items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Estimate Items</h2>
                <Badge variant="outline">{items.length}</Badge>
              </div>
              {items.length === 0 ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Add products from the catalog to build the estimate.
                </p>
              ) : (
                <div className="max-h-[40vh] divide-y overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.variantId} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatMoney(item.unitPrice)} each · {item.variantLabel}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.variantId)}
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">
                            Qty
                          </Label>
                          <Input
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={
                              quantityInputs[item.variantId] ??
                              String(item.quantity)
                            }
                            onChange={(event) =>
                              handleQuantityChange(
                                item.variantId,
                                event.target.value,
                                item.availableQty,
                              )
                            }
                            onBlur={() =>
                              commitQuantity(item.variantId, item.availableQty)
                            }
                            className="h-8 w-20"
                          />
                        </div>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatMoney(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Discount & validity */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="discountPercent" className="text-xs font-medium">
                  Discount percent
                </Label>
                <Input
                  id="discountPercent"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={discountPercent}
                  onChange={(event) =>
                    setDiscountPercent(Number.parseFloat(event.target.value) || 0)
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="validUntil" className="text-xs font-medium">
                  Valid until
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="validUntil"
                      type="button"
                      variant="outline"
                      className={cn(
                        "h-9 w-full justify-between px-3 text-left font-normal",
                        !validUntil && "text-muted-foreground",
                      )}
                    >
                      <span>{formatDateLabel(validUntil)}</span>
                      <CalendarIcon className="h-4 w-4 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      captionLayout="dropdown"
                      selected={
                        validUntil
                          ? new Date(`${validUntil}T00:00:00`)
                          : undefined
                      }
                      defaultMonth={
                        validUntil
                          ? new Date(`${validUntil}T00:00:00`)
                          : new Date()
                      }
                      startMonth={new Date()}
                      endMonth={new Date(new Date().getFullYear() + 2, 11)}
                      disabled={(date) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return date < today;
                      }}
                      onSelect={(date) => setValidUntil(toDateInput(date))}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs font-medium">
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional note for the customer"
                  className="min-h-24"
                />
              </div>
            </div>

            <Separator />

            {/* Summary */}
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium tabular-nums">
                  {formatMoney(subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Discount ({discountPercent || 0}%)
                </span>
                <span className="font-medium text-destructive tabular-nums">
                  -{formatMoney(discountAmount)}
                </span>
              </div>
              <Separator />
              <div className="flex items-end justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="text-2xl font-bold tabular-nums">
                  {formatMoney(total)}
                </span>
              </div>
            </div>

            {/* Approval hint */}
            <div
              className={cn(
                "flex items-start gap-2 rounded-md border p-3 text-xs",
                needsApproval
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900",
              )}
            >
              {needsApproval ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>
                {needsApproval
                  ? "Discount is above 5%, so the estimate will wait for warehouse approval."
                  : "Discount is 5% or below, so the estimate will be sent to the customer."}
              </span>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "edit" ? "Update Estimate" : "Create Estimate"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
