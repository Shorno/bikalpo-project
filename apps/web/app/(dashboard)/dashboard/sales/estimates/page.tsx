import { format, formatDistanceToNow } from "date-fns";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Pencil,
  Plus,
  Send,
  Store,
  XCircle,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { getEstimatesBySalesman } from "@/actions/estimate/get-estimates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auth } from "@/lib/auth";
import { SALES_BASE } from "@/lib/routes";

const getStatusConfig = (status: string) => {
  switch (status) {
    case "approved":
      return {
        icon: CheckCircle2,
        label: "Approved",
        className:
          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
      };
    case "converted":
      return {
        icon: CheckCircle2,
        label: "Converted",
        className:
          "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
      };
    case "rejected":
      return {
        icon: XCircle,
        label: "Rejected",
        className:
          "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
      };
    case "sent":
      return {
        icon: Send,
        label: "Sent",
        className:
          "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
      };
    case "pending":
    case "pending_admin_approval":
      return {
        icon: Clock,
        label:
          status === "pending_admin_approval" ? "Awaiting Approval" : "Pending",
        className:
          "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
      };
    default:
      return {
        icon: Clock,
        label: status,
        className:
          "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700",
      };
  }
};

export default async function EstimatesPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const { estimates } = await getEstimatesBySalesman();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Estimates</h1>
        {session?.user?.role === "salesman" && (
          <Button asChild>
            <Link href={`${SALES_BASE}/estimates/create`}>
              <Plus className="mr-2 size-4" />
              Create Estimate
            </Link>
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[280px] font-semibold">
                Customer
              </TableHead>
              <TableHead className="font-semibold">Status & Date</TableHead>
              <TableHead className="text-right font-semibold">Amount</TableHead>
              <TableHead className="w-[100px] text-right font-semibold">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {estimates?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="rounded-full bg-muted p-3">
                      <Store className="size-5 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">No estimates found</p>
                    {session?.user?.role === "salesman" && (
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="mt-2"
                      >
                        <Link href={`${SALES_BASE}/estimates/create`}>
                          <Plus className="mr-2 size-3" />
                          Create your first estimate
                        </Link>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              estimates?.map((estimate) => {
                const statusConfig = getStatusConfig(estimate.status);
                const StatusIcon = statusConfig.icon;
                const createdDate = new Date(estimate.createdAt);

                return (
                  <TableRow
                    key={estimate.id}
                    className="group transition-colors hover:bg-muted/30"
                  >
                    {/* Customer Info - Primary Focus */}
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Store className="size-4" />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <p className="truncate font-semibold leading-tight">
                            {estimate.customer?.name}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {estimate.customer?.shopName ||
                              estimate.customer?.phoneNumber}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Status & Date - Grouped Together */}
                    <TableCell className="py-4">
                      <div className="flex flex-col gap-2">
                        <Badge
                          variant="outline"
                          className={`w-fit gap-1.5 px-2.5 py-1 ${statusConfig.className}`}
                        >
                          <StatusIcon className="size-3.5" />
                          {statusConfig.label}
                        </Badge>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="size-3" />
                          <span>{format(createdDate, "MMM d, yyyy")}</span>
                          <span className="text-muted-foreground/60">•</span>
                          <span>
                            {formatDistanceToNow(createdDate, {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Amount - Prominent Display */}
                    <TableCell className="py-4 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-lg font-bold tabular-nums text-foreground">
                          ৳{Number(estimate.total).toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {(estimate as { items?: { length: number } }).items
                            ?.length || 0}{" "}
                          items
                        </span>
                      </div>
                    </TableCell>

                    {/* Actions - Compact Icons */}
                    <TableCell className="py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 opacity-70 transition-opacity hover:opacity-100"
                          asChild
                        >
                          <Link href={`${SALES_BASE}/estimates/${estimate.id}`}>
                            <Eye className="size-4" />
                            <span className="sr-only">View</span>
                          </Link>
                        </Button>
                        {estimate.status !== "converted" &&
                          estimate.status !== "rejected" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 opacity-70 transition-opacity hover:opacity-100"
                              asChild
                            >
                              <Link
                                href={`${SALES_BASE}/estimates/${estimate.id}/edit`}
                              >
                                <Pencil className="size-4" />
                                <span className="sr-only">Edit</span>
                              </Link>
                            </Button>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
