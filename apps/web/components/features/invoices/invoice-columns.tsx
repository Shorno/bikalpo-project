"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Eye, FileText, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { updateInvoicePaymentStatus } from "@/actions/invoice/invoice-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  InvoiceDeliveryStatus,
  InvoicePaymentStatus,
  InvoiceWithItems,
} from "@/db/schema/invoice";

const PAYMENT_OPTIONS: { value: InvoicePaymentStatus; label: string }[] = [
  { value: "unpaid", label: "Unpaid" },
  { value: "collected", label: "Collected" },
  { value: "settled", label: "Settled" },
];

function getDeliveryColor(status: InvoiceDeliveryStatus) {
  const colors: Record<InvoiceDeliveryStatus, string> = {
    not_assigned: "bg-gray-100 text-gray-800 border-gray-200",
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    out_for_delivery: "bg-blue-100 text-blue-800 border-blue-200",
    delivered: "bg-green-100 text-green-800 border-green-200",
    failed: "bg-red-100 text-red-800 border-red-200",
  };
  return colors[status];
}

function getPaymentColor(status: InvoicePaymentStatus) {
  const colors: Record<InvoicePaymentStatus, string> = {
    unpaid: "bg-red-100 text-red-800",
    collected: "bg-green-100 text-green-800",
    settled: "bg-gray-100 text-gray-800",
  };
  return colors[status];
}

function formatPrice(price: string | number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
  }).format(Number(price));
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-BD", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

function capitalizeFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function useInvoiceColumns() {
  const queryClient = useQueryClient();

  // const handleDeliveryStatusChange = async (
  //   invoiceId: number,
  //   deliveryStatus: InvoiceDeliveryStatus,
  // ) => {
  //   try {
  //     const result = await updateInvoiceDeliveryStatus(
  //       invoiceId,
  //       deliveryStatus,
  //     );
  //     if (result.success) {
  //       toast.success(`Delivery status updated to ${deliveryStatus}`);
  //       queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
  //     } else {
  //       toast.error(result.error || "Failed to update status");
  //     }
  //   } catch {
  //     toast.error("Something went wrong");
  //   }
  // };

  const handlePaymentChange = async (
    invoiceId: number,
    status: InvoicePaymentStatus,
  ) => {
    try {
      const result = await updateInvoicePaymentStatus(invoiceId, status);
      if (result.success) {
        toast.success(`Payment status updated to ${status}`);
        queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      } else {
        toast.error(result.error || "Failed to update payment status");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  // const handleDeliveryChange = async (
  //   invoiceId: number,
  //   status: InvoiceDeliveryStatus,
  // ) => {
  //   try {
  //     const result = await updateInvoiceDeliveryStatus(invoiceId, status);
  //     if (result.success) {
  //       toast.success(`Delivery status updated to ${status}`);
  //       queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
  //     } else {
  //       toast.error(result.error || "Failed to update delivery status");
  //     }
  //   } catch {
  //     toast.error("Something went wrong");
  //   }
  // };

  const columns: ColumnDef<InvoiceWithItems>[] = [
    {
      accessorKey: "invoiceType",
      header: "Type",
      cell: ({ row }) => row.getValue("invoiceType"),
      enableColumnFilter: true,
      filterFn: "equals",
    },
    {
      accessorKey: "invoiceNumber",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Invoice
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const invoice = row.original;
        return (
          <div className="font-medium">
            {row.getValue("invoiceNumber")}
            {invoice.invoiceType === "split" && (
              <Badge variant="outline" className="ml-2 text-xs">
                Split #{invoice.splitSequence}
              </Badge>
            )}
            {invoice.invoiceType === "main" &&
              invoice.splitInvoices &&
              invoice.splitInvoices.length > 0 && (
                <Badge
                  variant="outline"
                  className="ml-2 text-xs bg-purple-50 text-purple-700 border-purple-200"
                >
                  {invoice.splitInvoices.length} Partial
                </Badge>
              )}
          </div>
        );
      },
    },
    {
      id: "order",
      header: "Order",
      cell: ({ row }) => {
        const invoice = row.original;
        return (
          <div>
            <Link
              href={`/dashboard/admin/orders/${invoice.order?.id}`}
              className="text-primary hover:underline"
            >
              {invoice.order?.orderNumber || "-"}
            </Link>
          </div>
        );
      },
    },
    {
      id: "customer",
      header: "Customer",
      cell: ({ row }) => {
        const invoice = row.original;
        return (
          <div>
            <p className="font-medium">
              {invoice.customer?.shopName || invoice.customer?.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {invoice.customer?.phoneNumber}
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: "grandTotal",
      header: ({ column }) => (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Amount
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-center font-medium">
          {formatPrice(row.getValue("grandTotal"))}
        </div>
      ),
    },
    {
      accessorKey: "deliveryStatus",
      header: () => <div className="text-center">Delivery</div>,
      cell: ({ row }) => {
        const invoice = row.original;
        return (
          <div className="flex justify-center">
            <Badge className={getDeliveryColor(invoice.deliveryStatus)}>
              {invoice.deliveryStatus.split("_").map(capitalizeFirst).join(" ")}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "paymentStatus",
      header: () => <div className="text-center">Payment</div>,
      cell: ({ row }) => {
        const invoice = row.original;
        return (
          <div className="flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="p-0 h-auto">
                  <Badge className={getPaymentColor(invoice.paymentStatus)}>
                    {capitalizeFirst(invoice.paymentStatus)}
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Update Payment</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {PAYMENT_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() =>
                      handlePaymentChange(invoice.id, option.value)
                    }
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-center text-sm text-muted-foreground">
          {formatDate(row.getValue("createdAt"))}
        </div>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-center">Actions</div>,
      enableHiding: false,
      cell: ({ row }) => {
        const invoice = row.original;
        return (
          <div className="flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/admin/invoices/${invoice.id}`}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href={`/dashboard/admin/invoices/${invoice.id}?print=true`}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Print / Download
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return columns;
}
