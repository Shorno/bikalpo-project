"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Loader2,
  Package,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { SALES_PORTAL_BASE } from "@/lib/sales-routing";
import { cn } from "@/lib/utils";
import { client, orpc } from "@/utils/orpc";

type AssignedCustomer = {
  id: string;
  displayName?: string;
  name?: string;
  contactName?: string;
  phoneNumber?: string | null;
  shopName?: string | null;
  warehouseName?: string | null;
  customerType?: "retailer" | "warehouse";
};

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

function getCustomerLabel(customer: AssignedCustomer) {
  return (
    customer.displayName ||
    customer.shopName ||
    customer.warehouseName ||
    customer.name ||
    customer.contactName ||
    "Customer"
  );
}

export function SalesmanEstimateForm({
  mode,
  estimate,
  preselectedCustomerId,
  basePath = SALES_PORTAL_BASE,
}: SalesmanEstimateFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [customerSearch, setCustomerSearch] = useState("");
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
  const [discountPercent, setDiscountPercent] = useState(
    Number(estimate?.discountPercent ?? 0),
  );
  const [validUntil, setValidUntil] = useState(toDateInput(estimate?.validUntil));
  const [notes, setNotes] = useState(estimate?.notes ?? "");

  const { data: customersData, isLoading: customersLoading } = useQuery(
    orpc.salesman.getAssignedCustomers.queryOptions({ input: {} }),
  );
  const { data: catalogData, isLoading: catalogLoading } = useQuery({
    queryKey: ["salesman-estimate-catalog", productSearch],
    queryFn: () =>
      client.salesman.getEstimateCatalog({
        search: productSearch.trim() || undefined,
      }),
    staleTime: 1000 * 60 * 2,
  });

  const customers = (customersData?.customers ?? []) as AssignedCustomer[];
  const catalog = (catalogData?.products ?? []) as CatalogProduct[];

  const selectedVariantIds = new Set(items.map((item) => item.variantId));
  const availableCatalog = catalog.filter(
    (product) => !selectedVariantIds.has(product.variantId),
  );

  const filteredCustomers = useMemo(() => {
    const search = customerSearch.trim().toLowerCase();
    if (!search) return customers;
    return customers.filter((customer) =>
      [
        customer.displayName,
        customer.name,
        customer.contactName,
        customer.shopName,
        customer.warehouseName,
        customer.phoneNumber,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [customers, customerSearch]);

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

  const toggleCustomer = (customerId: string) => {
    setSelectedCustomerIds((current) => {
      if (mode === "edit") return [customerId];
      return current.includes(customerId)
        ? current.filter((id) => id !== customerId)
        : [...current, customerId];
    });
  };

  const addProduct = (product: CatalogProduct) => {
    setItems((current) => [...current, { ...product, quantity: 1 }]);
  };

  const updateQuantity = (variantId: number, quantity: number) => {
    setItems((current) =>
      current.map((item) =>
        item.variantId === variantId
          ? {
              ...item,
              quantity: Math.min(Math.max(1, quantity), item.availableQty),
            }
          : item,
      ),
    );
  };

  const removeItem = (variantId: number) => {
    setItems((current) => current.filter((item) => item.variantId !== variantId));
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
    <form onSubmit={handleSubmit} className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {hasLegacyItems && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Legacy estimate</AlertTitle>
            <AlertDescription>
              This estimate has products without warehouse variant snapshots.
              Create a new estimate from warehouse stock instead.
            </AlertDescription>
          </Alert>
        )}

        <section className="rounded-lg border bg-background">
          <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Customers</h2>
              <p className="text-xs text-muted-foreground">
                {mode === "edit"
                  ? "One customer can be attached while editing."
                  : "Select one or more assigned shops or warehouses."}
              </p>
            </div>
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              {selectedCustomerIds.length}
            </Badge>
          </div>
          <div className="space-y-3 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="Search assigned customers..."
                className="pl-9"
              />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border">
              {customersLoading ? (
                <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading customers
                </div>
              ) : filteredCustomers.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  No assigned customers found.
                </p>
              ) : (
                filteredCustomers.map((customer) => {
                  const checked = selectedCustomerIds.includes(customer.id);
                  return (
                    <div
                      key={customer.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleCustomer(customer.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleCustomer(customer.id);
                        }
                      }}
                      className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/40"
                    >
                      <div
                        aria-hidden
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background",
                        )}
                      >
                        {checked && <Check className="size-3.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {getCustomerLabel(customer)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {customer.phoneNumber || customer.contactName || "No contact"}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {customer.customerType === "warehouse" ? "Warehouse" : "Shop"}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-background">
          <div className="border-b bg-muted/20 px-4 py-3">
            <h2 className="text-sm font-semibold">Warehouse Products</h2>
            <p className="text-xs text-muted-foreground">
              Products come from the registered warehouse stock.
            </p>
          </div>
          <div className="space-y-4 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Search products, brand, SKU..."
                className="pl-9"
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {catalogLoading ? (
                <div className="col-span-full flex items-center justify-center gap-2 rounded-md border p-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading products
                </div>
              ) : availableCatalog.length === 0 ? (
                <p className="col-span-full rounded-md border p-6 text-center text-sm text-muted-foreground">
                  No stocked products found.
                </p>
              ) : (
                availableCatalog.slice(0, 12).map((product) => (
                  <button
                    key={product.variantId}
                    type="button"
                    onClick={() => addProduct(product)}
                    className="flex min-h-20 items-center gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted/40"
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
                        {formatMoney(product.unitPrice)} · Stock {product.availableQty}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-background">
          <div className="border-b bg-muted/20 px-4 py-3">
            <h2 className="text-sm font-semibold">Estimate Items</h2>
          </div>
          {items.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Add products from warehouse stock to build the estimate.
            </p>
          ) : (
            <div className="divide-y">
              {items.map((item) => (
                <div
                  key={item.variantId}
                  className="grid gap-3 p-4 md:grid-cols-[1fr_120px_120px_40px] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatMoney(item.unitPrice)} each · {item.variantLabel}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      max={item.availableQty}
                      value={item.quantity}
                      onChange={(event) =>
                        updateQuantity(
                          item.variantId,
                          Number.parseInt(event.target.value, 10) || 1,
                        )
                      }
                    />
                  </div>
                  <div className="text-sm font-semibold md:text-right">
                    {formatMoney(item.unitPrice * item.quantity)}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(item.variantId)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Remove</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded-lg border bg-background p-4">
          <h2 className="text-sm font-semibold">Discount & Validity</h2>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="discountPercent">Discount percent</Label>
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
            <div>
              <Label htmlFor="validUntil">Valid until</Label>
              <Input
                id="validUntil"
                type="date"
                value={validUntil}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setValidUntil(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional note for the customer"
                className="min-h-24"
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-background p-4">
          <h2 className="text-sm font-semibold">Summary</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Discount ({discountPercent || 0}%)
              </span>
              <span className="font-medium text-destructive">
                -{formatMoney(discountAmount)}
              </span>
            </div>
            <Separator />
            <div className="flex items-end justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="text-2xl font-bold">{formatMoney(total)}</span>
            </div>
          </div>
        </section>

        <Alert
          className={
            needsApproval
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }
        >
          {needsApproval ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          <AlertTitle>
            {needsApproval ? "Warehouse approval needed" : "Auto sent"}
          </AlertTitle>
          <AlertDescription>
            {needsApproval
              ? "Discount is above 5%, so the estimate will wait for warehouse approval."
              : "Discount is 5% or below, so the estimate will be sent to the customer."}
          </AlertDescription>
        </Alert>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "edit" ? "Update Estimate" : "Create Estimate"}
        </Button>
      </aside>
    </form>
  );
}
