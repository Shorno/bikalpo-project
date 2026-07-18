"use client";

import {
  AlertCircle,
  Bike,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  FileText,
  MapPin,
  PackageCheck,
  Phone,
  Plus,
  RotateCcw,
  Store,
  Truck,
  UserRound,
  Users,
  X,
} from "lucide-react";
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
import {
  useAssignIncomingDeliveryman,
  useCancelIncomingOrder,
  useConfirmIncomingOrder,
  useCreateIncomingDeliveryGroup,
  useCreateIncomingOrderInvoice,
  useCreateRetailDeliveryman,
  useIncomingOrders,
  useRetailDeliverymen,
  useRetryIncomingDelivery,
} from "@/hooks/use-shop-owner-api";
import { cn } from "@/lib/utils";

type StatusFilter =
  | "all"
  | "pending"
  | "ready_for_dispatch"
  | "invoiced"
  | "processing"
  | "delivered"
  | "returned"
  | "cancelled";

type IncomingOrder = NonNullable<
  ReturnType<typeof useIncomingOrders>["data"]
>["orders"][number];

const statusPresentation: Record<
  string,
  { label: string; className: string; description: string }
> = {
  pending: {
    label: "Needs review",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    description: "Review stock and delivery details before confirming.",
  },
  confirmed: {
    label: "Confirmed",
    className: "border-blue-200 bg-blue-50 text-blue-800",
    description: "This legacy confirmed order is ready for invoicing.",
  },
  ready_for_dispatch: {
    label: "Ready to invoice",
    className: "border-blue-200 bg-blue-50 text-blue-800",
    description: "Create the full invoice to begin dispatch preparation.",
  },
  invoiced: {
    label: "Preparing",
    className: "border-slate-200 bg-slate-50 text-slate-700",
    description: "Build a delivery group and assign a store rider.",
  },
  processing: {
    label: "Out for delivery",
    className: "border-blue-200 bg-blue-50 text-blue-800",
    description: "The rider has started the trip and the customer has an OTP.",
  },
  delivered: {
    label: "Delivered",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    description: "The customer verified delivery with their OTP.",
  },
  returned: {
    label: "Returned",
    className: "border-slate-300 bg-slate-100 text-slate-700",
    description: "The order was returned and inventory was restored.",
  },
  cancelled: {
    label: "Cancelled",
    className: "border-red-200 bg-red-50 text-red-800",
    description: "This order was cancelled before invoicing.",
  },
};

const money = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 0,
});

export default function IncomingOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [groupOrder, setGroupOrder] = useState<IncomingOrder | null>(null);
  const [assignOrder, setAssignOrder] = useState<IncomingOrder | null>(null);
  const [teamOpen, setTeamOpen] = useState(false);

  const { data, isLoading, isError } = useIncomingOrders({
    status: statusFilter,
    page,
    limit: 12,
  });
  const { data: teamData } = useRetailDeliverymen();
  const confirmOrder = useConfirmIncomingOrder();
  const cancelOrder = useCancelIncomingOrder();
  const createInvoice = useCreateIncomingOrderInvoice();
  const createGroup = useCreateIncomingDeliveryGroup();
  const assignRider = useAssignIncomingDeliveryman();
  const retryDelivery = useRetryIncomingDelivery();

  const orders = data?.orders ?? [];
  const pagination = data?.pagination;
  const riders = teamData?.deliverymen ?? [];
  const isMutating = [
    confirmOrder,
    cancelOrder,
    createInvoice,
    createGroup,
    assignRider,
    retryDelivery,
  ].some((mutation) => mutation.isPending);

  const run = (
    mutation: { mutate: (input: { orderId: number }, options: object) => void },
    orderId: number,
    successMessage: string,
  ) => {
    mutation.mutate(
      { orderId },
      {
        onSuccess: () => toast.success(successMessage),
        onError: (error: Error) => toast.error(error.message),
      },
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700">
            <Store className="h-4 w-4" />
            Retail fulfillment
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Consumer orders
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Confirm each order, create its invoice, then hand it to a member of
            your delivery team. Shipping starts only when the rider starts the
            trip.
          </p>
        </div>
        <Button
          variant="outline"
          className="h-10 gap-2"
          onClick={() => setTeamOpen(true)}
        >
          <Users className="h-4 w-4" />
          Delivery team
          <Badge variant="secondary" className="ml-1 rounded-full px-2">
            {riders.length}
          </Badge>
        </Button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <CircleDot className="h-4 w-4 text-blue-600" />
          Every action follows the order shown on the card.
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as StatusFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-10 w-full bg-white sm:w-52">
            <SelectValue placeholder="All stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            <SelectItem value="pending">Needs review</SelectItem>
            <SelectItem value="ready_for_dispatch">Ready to invoice</SelectItem>
            <SelectItem value="invoiced">Preparing</SelectItem>
            <SelectItem value="processing">Out for delivery</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <OrdersSkeleton />
      ) : isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Orders could not be loaded"
          description="Refresh the page and try again. No fulfillment data was changed."
        />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="No orders in this stage"
          description={
            statusFilter === "all"
              ? "New consumer orders will appear here."
              : "Choose another stage to continue managing fulfillment."
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {orders.map((order) => {
            const presentation =
              statusPresentation[order.status] ?? statusPresentation.pending;
            const deliveryFailed =
              order.fulfillment?.deliveryStatus === "failed";
            const groupStatus = order.fulfillment?.groupStatus;
            const assignedRider = riders.find(
              (rider) => rider.id === order.fulfillment?.deliverymanId,
            );

            return (
              <article
                key={order.id}
                className="flex flex-col rounded-xl border border-slate-200 bg-white"
              >
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {new Date(order.createdAt).toLocaleDateString("en-BD", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    <h2 className="mt-1 truncate font-mono text-base font-semibold text-slate-950">
                      {order.orderNumber}
                    </h2>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("shrink-0", presentation.className)}
                  >
                    {deliveryFailed ? "Delivery issue" : presentation.label}
                  </Badge>
                </div>

                <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto]">
                  <div className="min-w-0 space-y-4">
                    <div>
                      <p className="font-medium text-slate-900">
                        {order.customerName || order.shippingName}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />{" "}
                          {order.shippingPhone}
                        </span>
                        {order.shippingArea && (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />{" "}
                            {order.shippingArea}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {order.items.slice(0, 2).map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between gap-3 text-sm"
                        >
                          <span className="truncate text-slate-700">
                            {item.productName}
                          </span>
                          <span className="shrink-0 text-slate-500">
                            × {item.quantity}
                          </span>
                        </div>
                      ))}
                      {order.items.length > 2 && (
                        <p className="text-xs text-slate-500">
                          +{order.items.length - 2} more items
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-xs text-slate-500">Order total</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950">
                      {money.format(Number(order.total))}
                    </p>
                  </div>
                </div>

                <div className="mt-auto border-t border-slate-100 bg-slate-50/70 p-4">
                  <div className="mb-3 flex items-start gap-2 text-xs leading-5 text-slate-600">
                    {groupStatus === "assigned" ? (
                      <Bike className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    ) : (
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    )}
                    <span>
                      {deliveryFailed
                        ? "The delivery attempt failed. Return it to preparation to create a new route."
                        : groupStatus === "assigned"
                          ? `${assignedRider?.name ?? "A store rider"} is assigned. The order remains in preparation until the rider starts.`
                          : groupStatus === "pending_assignment"
                            ? "Delivery group created. Assign an available store rider next."
                            : presentation.description}
                      {order.fulfillment?.invoiceNumber && (
                        <span className="ml-1 font-medium text-slate-800">
                          Invoice {order.fulfillment.invoiceNumber}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {order.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          className="h-9 bg-blue-700 hover:bg-blue-800"
                          disabled={isMutating}
                          onClick={() =>
                            run(confirmOrder, order.id, "Order confirmed")
                          }
                        >
                          <Check className="mr-1.5 h-4 w-4" /> Confirm order
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 text-red-700 hover:bg-red-50 hover:text-red-800"
                          disabled={isMutating}
                          onClick={() =>
                            run(
                              cancelOrder,
                              order.id,
                              "Order cancelled and stock restored",
                            )
                          }
                        >
                          <X className="mr-1.5 h-4 w-4" /> Cancel
                        </Button>
                      </>
                    )}
                    {["confirmed", "ready_for_dispatch"].includes(
                      order.status,
                    ) && (
                      <Button
                        size="sm"
                        className="h-9 bg-blue-700 hover:bg-blue-800"
                        disabled={isMutating}
                        onClick={() =>
                          run(createInvoice, order.id, "Full invoice created")
                        }
                      >
                        <FileText className="mr-1.5 h-4 w-4" /> Create invoice
                      </Button>
                    )}
                    {deliveryFailed && (
                      <Button
                        size="sm"
                        className="h-9 bg-blue-700 hover:bg-blue-800"
                        disabled={isMutating}
                        onClick={() =>
                          run(
                            retryDelivery,
                            order.id,
                            "Order returned to delivery preparation",
                          )
                        }
                      >
                        <RotateCcw className="mr-1.5 h-4 w-4" /> Prepare retry
                      </Button>
                    )}
                    {order.status === "invoiced" &&
                      !deliveryFailed &&
                      !order.fulfillment?.groupId && (
                        <Button
                          size="sm"
                          className="h-9 bg-blue-700 hover:bg-blue-800"
                          onClick={() => setGroupOrder(order)}
                        >
                          <Truck className="mr-1.5 h-4 w-4" /> Create delivery
                          group
                        </Button>
                      )}
                    {groupStatus === "pending_assignment" &&
                      order.fulfillment?.groupId && (
                        <Button
                          size="sm"
                          className="h-9 bg-blue-700 hover:bg-blue-800"
                          onClick={() => setAssignOrder(order)}
                        >
                          <UserRound className="mr-1.5 h-4 w-4" /> Assign rider
                        </Button>
                      )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-5 text-sm text-slate-600">
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <CreateGroupDialog
        order={groupOrder}
        pending={createGroup.isPending}
        onOpenChange={(open) => !open && setGroupOrder(null)}
        onSubmit={(input) =>
          createGroup.mutate(input, {
            onSuccess: () => {
              toast.success("Delivery group created");
              setGroupOrder(null);
            },
            onError: (error) => toast.error(error.message),
          })
        }
      />
      <AssignRiderDialog
        order={assignOrder}
        riders={riders}
        pending={assignRider.isPending}
        onOpenChange={(open) => !open && setAssignOrder(null)}
        onSubmit={(deliverymanId) => {
          const groupId = assignOrder?.fulfillment?.groupId;
          if (!groupId) return;
          assignRider.mutate(
            { groupId, deliverymanId },
            {
              onSuccess: () => {
                toast.success("Rider assigned. Shipping has not started yet.");
                setAssignOrder(null);
              },
              onError: (error) => toast.error(error.message),
            },
          );
        }}
      />
      <DeliveryTeamDialog open={teamOpen} onOpenChange={setTeamOpen} />
    </div>
  );
}

function CreateGroupDialog({
  order,
  pending,
  onOpenChange,
  onSubmit,
}: {
  order: IncomingOrder | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    orderId: number;
    groupName: string;
    vehicleType: "bike";
  }) => void;
}) {
  if (!order) return null;
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create delivery group</DialogTitle>
          <DialogDescription>
            Create a pending route for {order.orderNumber}. You will assign an
            available store rider in the next step.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-blue-700 hover:bg-blue-800"
            disabled={pending}
            onClick={() =>
              onSubmit({
                orderId: order.id,
                groupName: `Delivery ${order.orderNumber}`,
                vehicleType: "bike",
              })
            }
          >
            Create group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignRiderDialog({
  order,
  riders,
  pending,
  onOpenChange,
  onSubmit,
}: {
  order: IncomingOrder | null;
  riders: Array<{
    id: string;
    name: string;
    phoneNumber: string | null;
    activeGroupId: number | null;
  }>;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (deliverymanId: string) => void;
}) {
  const [deliverymanId, setDeliverymanId] = useState("");
  if (!order) return null;
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign a store rider</DialogTitle>
          <DialogDescription>
            The rider can start this delivery from their delivery dashboard.
            Assignment alone keeps the order in preparation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="assignment-rider">Available rider</Label>
          <Select value={deliverymanId} onValueChange={setDeliverymanId}>
            <SelectTrigger id="assignment-rider" className="h-11">
              <SelectValue placeholder="Choose a rider" />
            </SelectTrigger>
            <SelectContent>
              {riders.map((rider) => (
                <SelectItem
                  key={rider.id}
                  value={rider.id}
                  disabled={!!rider.activeGroupId}
                >
                  {rider.name}
                  {rider.phoneNumber ? ` · ${rider.phoneNumber}` : ""}
                  {rider.activeGroupId ? " — busy" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {riders.length === 0 && (
            <p className="text-sm text-amber-700">
              Add a rider from Delivery team first.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-blue-700 hover:bg-blue-800"
            disabled={!deliverymanId || pending}
            onClick={() => onSubmit(deliverymanId)}
          >
            Assign rider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeliveryTeamDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data } = useRetailDeliverymen();
  const createRider = useCreateRetailDeliveryman();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phoneNumber: "",
    serviceArea: "",
  });
  const riders = data?.deliverymen ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Store delivery team</DialogTitle>
          <DialogDescription>
            These rider accounts are scoped to your shop and use the existing
            delivery dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {riders.map((rider) => (
            <div
              key={rider.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {rider.name}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {rider.phoneNumber || rider.email}
                </p>
              </div>
              <Badge
                variant="outline"
                className={
                  rider.activeGroupId
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                }
              >
                {rider.activeGroupId ? "On assignment" : "Available"}
              </Badge>
            </div>
          ))}
          {riders.length === 0 && !adding && (
            <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
              No store riders have been added yet.
            </p>
          )}
          {adding && (
            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <Field
                id="rider-name"
                label="Name"
                value={form.name}
                onChange={(name) => setForm({ ...form, name })}
              />
              <Field
                id="rider-phone"
                label="Phone"
                value={form.phoneNumber}
                onChange={(phoneNumber) => setForm({ ...form, phoneNumber })}
              />
              <Field
                id="rider-email"
                label="Email"
                type="email"
                value={form.email}
                onChange={(email) => setForm({ ...form, email })}
              />
              <Field
                id="rider-password"
                label="Temporary password"
                type="password"
                value={form.password}
                onChange={(password) => setForm({ ...form, password })}
              />
              <div className="sm:col-span-2">
                <Field
                  id="rider-area"
                  label="Service area"
                  value={form.serviceArea}
                  onChange={(serviceArea) => setForm({ ...form, serviceArea })}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={() => setAdding((value) => !value)}
          >
            <Plus className="mr-1.5 h-4 w-4" />{" "}
            {adding ? "Hide form" : "Add rider"}
          </Button>
          {adding && (
            <Button
              className="bg-blue-700 hover:bg-blue-800"
              disabled={
                createRider.isPending ||
                form.name.length < 2 ||
                !form.email ||
                form.password.length < 8
              }
              onClick={() =>
                createRider.mutate(form, {
                  onSuccess: () => {
                    toast.success("Rider account created");
                    setForm({
                      name: "",
                      email: "",
                      password: "",
                      phoneNumber: "",
                      serviceArea: "",
                    });
                    setAdding(false);
                  },
                  onError: (error) => toast.error(error.message),
                })
              }
            >
              Create rider account
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-white"
      />
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof AlertCircle;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
      <Icon className="mx-auto h-10 w-10 text-slate-300" />
      <h2 className="mt-4 font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="rounded-xl border border-slate-200 bg-white p-5"
        >
          <div className="flex justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="mt-6 h-4 w-44" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
          <Skeleton className="mt-6 h-9 w-36" />
        </div>
      ))}
    </div>
  );
}
