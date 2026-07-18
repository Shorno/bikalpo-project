"use client";

import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Circle,
  FileText,
  KeyRound,
  Loader2,
  MapPin,
  Phone,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useOrderByNumber } from "@/hooks/use-customer-api";
import {
  consumerJourneySteps,
  getConsumerPhasePresentation,
} from "@/lib/consumer-order-presentation";
import { cn } from "@/lib/utils";
import { client } from "@/utils/orpc";

interface OrderDetailClientProps {
  orderNumber: string;
}

const paymentMethodLabels: Record<string, string> = {
  cash_on_delivery: "Cash on delivery",
  bkash: "bKash",
  nagad: "Nagad",
  bank_transfer: "Bank transfer",
};

const money = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 0,
});

function OrderDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Skeleton className="h-5 w-28" />
      <div className="space-y-3">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function OrderDetailClient({ orderNumber }: OrderDetailClientProps) {
  const { data, isLoading, isError } = useOrderByNumber(orderNumber);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportType, setReportType] = useState<
    "delivery" | "payment" | "product"
  >("delivery");
  const [reportPriority, setReportPriority] = useState<
    "medium" | "high" | "critical"
  >("medium");
  const [reportDescription, setReportDescription] = useState("");
  const [reportComment, setReportComment] = useState("");

  useEffect(() => {
    if (isError) notFound();
  }, [isError]);

  if (isLoading) return <OrderDetailSkeleton />;
  if (!data?.order || !data.journey) return null;

  const { order, journey } = data;
  const presentation = getConsumerPhasePresentation(journey.phase);
  const canReport = [
    "confirmed",
    "preparing",
    "out_for_delivery",
    "delivered",
    "delivery_issue",
    "returned",
  ].includes(journey.phase);

  const handleSubmitComplaint = async () => {
    if (reportDescription.length < 10) {
      toast.error("Description must be at least 10 characters");
      return;
    }
    setReportLoading(true);
    try {
      await client.userComplaint.create({
        orderId: order.id,
        type: reportType,
        priority: reportPriority,
        description: reportDescription,
        userComment: reportComment || undefined,
      });
      toast.success("Your issue was submitted. Our team will investigate it.");
      setReportOpen(false);
      setReportDescription("");
      setReportComment("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit the issue",
      );
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-12">
      <header>
        <Link
          href="/account/orders"
          className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-slate-600 outline-none transition-colors hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" />
          All orders
        </Link>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">
              Placed {format(new Date(order.createdAt), "d MMMM yyyy, h:mm a")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              Order {order.orderNumber}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {presentation.description}
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "w-fit px-3 py-1.5 text-sm",
              presentation.badgeClassName,
            )}
          >
            {presentation.label}
          </Badge>
        </div>
      </header>

      <section
        className="rounded-xl border border-slate-200 bg-white"
        aria-labelledby="journey-heading"
      >
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <h2 id="journey-heading" className="font-semibold text-slate-950">
            Delivery journey
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Five clear updates from checkout to verified receipt.
          </p>
        </div>
        <ol
          className="grid gap-0 p-5 sm:grid-cols-5 sm:p-6"
          aria-label="Order delivery progress"
        >
          {journey.steps.map((step, index) => {
            const copy = consumerJourneySteps.find(
              (item) => item.key === step.key,
            );
            const complete = step.state === "complete";
            const current = step.state === "current";
            return (
              <li
                key={step.key}
                className="relative flex min-h-20 gap-3 pb-5 last:min-h-0 last:pb-0 sm:block sm:min-h-0 sm:pb-0"
                aria-current={current ? "step" : undefined}
              >
                {index < journey.steps.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px sm:left-8 sm:right-0 sm:top-[15px] sm:h-px sm:w-[calc(100%-2rem)]",
                      complete ? "bg-blue-600" : "bg-slate-200",
                    )}
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-white",
                    complete && "border-blue-700 bg-blue-700 text-white",
                    current && "border-blue-700 text-blue-700",
                    step.state === "upcoming" &&
                      "border-slate-300 text-slate-300",
                  )}
                >
                  {complete ? (
                    <Check className="h-4 w-4" />
                  ) : current ? (
                    <Circle className="h-3 w-3 fill-current" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-current" />
                  )}
                </span>
                <div className="min-w-0 pt-0.5 sm:mt-3 sm:pr-3">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      step.state === "upcoming"
                        ? "text-slate-400"
                        : "text-slate-900",
                    )}
                  >
                    {copy?.label}
                  </p>
                  {step.completedAt && (
                    <p className="mt-1 text-xs tabular-nums text-slate-500">
                      {format(new Date(step.completedAt), "d MMM, h:mm a")}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {["cancelled", "delivery_issue", "returned"].includes(
          journey.phase,
        ) && (
          <div
            className={cn(
              "m-5 mt-0 flex gap-3 rounded-lg border p-4 text-sm sm:m-6 sm:mt-0",
              journey.phase === "delivery_issue"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : journey.phase === "cancelled"
                  ? "border-red-200 bg-red-50 text-red-900"
                  : "border-slate-300 bg-slate-50 text-slate-800",
            )}
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">{presentation.label}</p>
              <p className="mt-1 leading-6">{presentation.description}</p>
            </div>
          </div>
        )}

        {(journey.invoice ||
          journey.delivery.riderName ||
          journey.delivery.otp) && (
          <div className="grid gap-4 border-t border-slate-200 bg-slate-50/70 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
            {journey.invoice && (
              <DetailFact
                icon={FileText}
                label="Invoice"
                value={journey.invoice.invoiceNumber}
              />
            )}
            {journey.delivery.riderName && (
              <DetailFact
                icon={UserRound}
                label="Delivery rider"
                value={journey.delivery.riderName}
                detail={journey.delivery.riderPhone || undefined}
              />
            )}
            {journey.delivery.startedAt && (
              <DetailFact
                icon={Truck}
                label="Trip started"
                value={format(
                  new Date(journey.delivery.startedAt),
                  "d MMM, h:mm a",
                )}
              />
            )}
          </div>
        )}
      </section>

      {journey.delivery.otp && (
        <section
          className="rounded-xl border-2 border-blue-700 bg-blue-50 p-5 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-6"
          aria-labelledby="otp-heading"
        >
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-blue-700" />
            <div>
              <h2 id="otp-heading" className="font-semibold text-blue-950">
                Confirm only after receiving your order
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-blue-900/80">
                Check the items first. Share this code with the rider only after
                the order is physically in your hands.
              </p>
            </div>
          </div>
          <div className="mt-5 rounded-lg border border-blue-200 bg-white px-6 py-4 text-center sm:mt-0 sm:min-w-48">
            <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
              <KeyRound className="h-3.5 w-3.5" /> Delivery OTP
            </p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-[0.25em] text-blue-950">
              {journey.delivery.otp}
            </p>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section
          className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          aria-labelledby="items-heading"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 id="items-heading" className="font-semibold text-slate-950">
              Order items
            </h2>
            <span className="text-sm text-slate-500">
              {order.items.length} {order.items.length === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {order.items.map((item) => (
              <div key={item.id} className="flex gap-4 p-5">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <Image
                    src={item.productImage || "/placeholder-image.svg"}
                    alt={item.productName}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">
                    {item.productName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.productSize ? `${item.productSize} · ` : ""}
                    {money.format(Number(item.unitPrice))} × {item.quantity}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums text-slate-900">
                  {money.format(Number(item.totalPrice))}
                </p>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-200 bg-slate-50 p-5">
            <div className="ml-auto max-w-sm space-y-2 text-sm">
              <PriceRow
                label="Subtotal"
                value={money.format(Number(order.subtotal))}
              />
              <PriceRow
                label="Delivery"
                value={
                  Number(order.shippingCost) === 0
                    ? "Free"
                    : money.format(Number(order.shippingCost))
                }
              />
              {Number(order.discount) > 0 && (
                <PriceRow
                  label="Discount"
                  value={`−${money.format(Number(order.discount))}`}
                />
              )}
              <Separator />
              <div className="flex items-center justify-between pt-1 text-base font-semibold text-slate-950">
                <span>Total</span>
                <span className="tabular-nums">
                  {money.format(Number(order.total))}
                </span>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-950">Delivery details</h2>
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div className="text-slate-600">
                  <p className="font-medium text-slate-900">
                    {order.shippingName}
                  </p>
                  <p className="mt-1 leading-6">
                    {order.shippingAddress}
                    <br />
                    {[
                      order.shippingArea,
                      order.shippingCity,
                      order.shippingPostalCode,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <Phone className="h-4 w-4 text-slate-400" />
                {order.shippingPhone}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-950">Payment</h2>
            <p className="mt-2 text-sm text-slate-600">
              {paymentMethodLabels[order.paymentMethod] || order.paymentMethod}
            </p>
          </div>
          {order.customerNote && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="font-semibold text-slate-950">Your note</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {order.customerNote}
              </p>
            </div>
          )}
          {canReport && (
            <ReportIssueDialog
              open={reportOpen}
              onOpenChange={setReportOpen}
              orderNumber={order.orderNumber}
              loading={reportLoading}
              type={reportType}
              priority={reportPriority}
              description={reportDescription}
              comment={reportComment}
              onTypeChange={setReportType}
              onPriorityChange={setReportPriority}
              onDescriptionChange={setReportDescription}
              onCommentChange={setReportComment}
              onSubmit={handleSubmitComplaint}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function DetailFact({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-blue-700">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="truncate text-sm font-medium text-slate-900">{value}</p>
        {detail && <p className="text-xs text-slate-500">{detail}</p>}
      </div>
    </div>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span className="tabular-nums text-slate-900">{value}</span>
    </div>
  );
}

function ReportIssueDialog({
  open,
  onOpenChange,
  orderNumber,
  loading,
  type,
  priority,
  description,
  comment,
  onTypeChange,
  onPriorityChange,
  onDescriptionChange,
  onCommentChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  loading: boolean;
  type: "delivery" | "payment" | "product";
  priority: "medium" | "high" | "critical";
  description: string;
  comment: string;
  onTypeChange: (value: "delivery" | "payment" | "product") => void;
  onPriorityChange: (value: "medium" | "high" | "critical") => void;
  onDescriptionChange: (value: string) => void;
  onCommentChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 w-full gap-2">
          <AlertTriangle className="h-4 w-4" />
          Report an issue
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Report an issue</DialogTitle>
          <DialogDescription>
            Tell us what happened with order {orderNumber}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="complaint-type">Issue type</Label>
              <Select
                value={type}
                onValueChange={(value) => onTypeChange(value as typeof type)}
              >
                <SelectTrigger id="complaint-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="delivery">Delivery</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="complaint-priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(value) =>
                  onPriorityChange(value as typeof priority)
                }
              >
                <SelectTrigger id="complaint-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="complaint-description">What happened?</Label>
            <Textarea
              id="complaint-description"
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              rows={4}
              placeholder="Describe the issue in at least 10 characters"
            />
            <p className="text-xs text-slate-500">
              {description.length}/5000 characters
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="complaint-comment">
              Additional comment (optional)
            </Label>
            <Textarea
              id="complaint-comment"
              value={comment}
              onChange={(event) => onCommentChange(event.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            className="bg-blue-700 hover:bg-blue-800"
            onClick={onSubmit}
            disabled={loading || description.length < 10}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit
            issue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
