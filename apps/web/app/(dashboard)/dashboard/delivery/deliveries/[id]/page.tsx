import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeliveryGroupById } from "@/actions/delivery/delivery-management";
import { DeliveryExecution } from "@/components/features/delivery/delivery-execution";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DELIVERY_BASE } from "@/lib/routes";

function StatusBadge({ status }: { status: string }) {
  const variant = status === "out_for_delivery" ? "default" : "secondary";
  return (
    <Badge variant={variant} className="text-[10px] sm:text-xs uppercase">
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function StatCard({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: number;
  variant?: "default" | "success" | "destructive";
}) {
  const bgClass =
    variant === "success"
      ? "bg-emerald-50"
      : variant === "destructive"
        ? "bg-red-50"
        : "bg-muted/50";
  const valueClass =
    variant === "success"
      ? "text-emerald-600"
      : variant === "destructive"
        ? "text-red-600"
        : "";

  return (
    <div className={`text-center p-2 rounded-lg ${bgClass}`}>
      <p className={`text-lg sm:text-xl font-bold ${valueClass}`}>{value}</p>
      <p className="text-[10px] sm:text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default async function DeliveryRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getDeliveryGroupById(Number(id));

  if (!result.success || !result.group) {
    notFound();
  }

  const { group } = result;

  // Calculate stats from invoices
  const invoices = group.invoices || [];
  const pendingInvoices = invoices.filter(
    (inv: any) => inv.status === "pending",
  ).length;
  const deliveredInvoices = invoices.filter(
    (inv: any) => inv.status === "delivered",
  ).length;
  const failedInvoices = invoices.filter(
    (inv: any) => inv.status === "failed",
  ).length;
  const totalValue = invoices.reduce(
    (sum: number, inv: any) => sum + Number(inv.invoice.grandTotal),
    0,
  );

  return (
    <div className="flex flex-col gap-3 sm:gap-6">
      {/* Compact Header */}
      <div className="flex items-center gap-2 sm:gap-4">
        <Link href={`${DELIVERY_BASE}/deliveries`}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 sm:h-9 sm:w-9 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight truncate">
              {group.groupName}
            </h1>
            <StatusBadge status={group.status} />
          </div>
          <p className="text-[10px] sm:text-sm text-muted-foreground">
            {format(new Date(group.assignedAt!), "MMM d, yyyy")}
          </p>
        </div>
      </div>

      {/* Stats Summary - Compact horizontal on mobile */}
      <Card className="p-0">
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-4 gap-2 sm:gap-4">
            <StatCard label="Pending" value={pendingInvoices} />
            <StatCard
              label="Delivered"
              value={deliveredInvoices}
              variant="success"
            />
            <StatCard
              label="Failed"
              value={failedInvoices}
              variant="destructive"
            />
            <div className="text-center p-2 rounded-lg bg-primary/10">
              <p className="text-lg sm:text-xl font-bold text-primary">
                {invoices.length}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Total
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs sm:text-sm">
            <span className="text-muted-foreground">Amount to Collect</span>
            <span className="font-semibold">
              ৳{totalValue.toLocaleString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Notes - Show only if exists, compact */}
      {group.notes && (
        <Card className="p-0 bg-amber-50/50 border-amber-200">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs font-medium text-amber-800 mb-1">Notes</p>
            <p className="text-xs sm:text-sm text-amber-900 whitespace-pre-wrap">
              {group.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Invoices List */}
      <DeliveryExecution group={group} />
    </div>
  );
}
