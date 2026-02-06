"use client";

import { History } from "lucide-react";
import { useEffect, useState } from "react";
import { getStockChangeLogs } from "@/actions/product/get-stock-change-logs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface StockChangeLogsSheetProps {
  productId: number;
  productName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockChangeLogsSheet({
  productId,
  productName,
  open,
  onOpenChange,
}: StockChangeLogsSheetProps) {
  const [logs, setLogs] = useState<
    Awaited<ReturnType<typeof getStockChangeLogs>>
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !productId) return;
    setLoading(true);
    getStockChangeLogs(productId)
      .then(setLogs)
      .finally(() => setLoading(false));
  }, [open, productId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="size-5" />
            Stock Change Logs — {productName}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : logs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No stock changes yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell
                      className={
                        log.changeType === "add"
                          ? "text-green-600 font-medium"
                          : "text-red-600 font-medium"
                      }
                    >
                      {log.changeType === "add" ? "Add" : "Reduce"}
                    </TableCell>
                    <TableCell>
                      {log.changeType === "add" ? "+" : ""}
                      {log.quantity}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate">
                      {log.reason || "—"}
                    </TableCell>
                    <TableCell>{log.createdBy?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {log.createdAt
                        ? new Date(log.createdAt).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
