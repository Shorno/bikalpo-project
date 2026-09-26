"use client";

import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, Download, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PriceImportPreview } from "@/lib/consumer-price-workbook";
import { client, orpc } from "@/utils/orpc";
import { formatBdt } from "./product-price-table";

export function ProductPriceBulkActions({
  filters,
  disabled,
  canExport,
  onImportingChange,
  onImported,
}: {
  filters: {
    search?: string;
    typeId?: number;
    categoryId?: number;
    subCategoryId?: number;
    coreProductId?: number;
  };
  disabled: boolean;
  canExport: boolean;
  onImportingChange: (value: boolean) => void;
  onImported: () => Promise<unknown>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [reading, setReading] = useState(false);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<PriceImportPreview | null>(null);
  const [error, setError] = useState("");
  const importMutation = useMutation({
    ...orpc.product.importConsumerReferencePrices.mutationOptions(),
    onSuccess: async ({ updatedCount }) => {
      toast.success(
        updatedCount
          ? `${updatedCount} reference price${updatedCount === 1 ? "" : "s"} updated`
          : "All prices are already up to date",
      );
      setOpen(false);
      setPreview(null);
      await onImported();
    },
    onError: (error: Error) =>
      setError(error.message || "Import failed. No prices were changed."),
    onSettled: () => onImportingChange(false),
  });
  const exportPrices = async () => {
    setExporting(true);
    try {
      const [{ items }, { writePriceWorkbook }] = await Promise.all([
        client.product.exportConsumerReferencePrices(filters),
        import("@/lib/consumer-price-workbook"),
      ]);
      const blob = await writePriceWorkbook(items);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `product-prices-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Exported ${items.length} variant prices`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };
  const readFile = async (file: File) => {
    setFileName(file.name);
    setPreview(null);
    setError("");
    setOpen(true);
    setReading(true);
    try {
      if (!/\.xlsx$/i.test(file.name))
        throw new Error(
          "Select an Excel .xlsx workbook exported from this page",
        );
      if (file.size > 10 * 1024 * 1024)
        throw new Error("The workbook must be smaller than 10 MB");
      const { readPriceWorkbook } = await import(
        "@/lib/consumer-price-workbook"
      );
      setPreview(await readPriceWorkbook(await file.arrayBuffer()));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The workbook could not be read",
      );
    } finally {
      setReading(false);
    }
  };
  const upload = () => {
    if (
      !preview?.rows.length ||
      preview.errors.length ||
      importMutation.isPending
    )
      return;
    setError("");
    onImportingChange(true);
    importMutation.mutate({ rows: preview.rows });
  };
  return (
    <section
      className="rounded-xl border bg-card p-4 shadow-sm"
      aria-label="Bulk action"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Bulk Action</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Export the filtered list, edit prices in Excel, then upload to save.
            Every change is logged.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 max-md:[&_button]:min-h-11">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            aria-label="Upload price workbook"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void readFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || reading}
            onClick={() => fileInput.current?.click()}
          >
            <Upload className="size-4" /> Upload Price (Excel)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canExport || disabled || exporting}
            onClick={() => void exportPrices()}
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}{" "}
            Export Price List
          </Button>
        </div>
      </div>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!reading && !importMutation.isPending) setOpen(value);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Price (Excel)</DialogTitle>
            <DialogDescription className="break-all">
              {fileName} · Review prices before saving. Up to 1,000 rows per
              upload.
            </DialogDescription>
          </DialogHeader>
          {reading && (
            <p role="status" className="flex items-center gap-2 py-6 text-sm">
              <Loader2 className="size-4 animate-spin" /> Reading workbook…
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {preview && preview.errors.length > 0 && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              <p className="font-medium">
                Fix these errors and upload again. No prices have been changed.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {preview.errors.slice(0, 20).map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
              {preview.errors.length > 20 && (
                <p className="mt-2">
                  And {preview.errors.length - 20} more errors.
                </p>
              )}
            </div>
          )}
          {preview && !preview.errors.length && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                {preview.rows.length} valid variant price
                {preview.rows.length === 1 ? "" : "s"} ready to save
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variant Price ID</TableHead>
                    <TableHead className="text-right">
                      Price / New Cylinder Price
                    </TableHead>
                    <TableHead className="text-right">Exchange Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.slice(0, 10).map((row) => (
                    <TableRow key={row.variantPriceId}>
                      <TableCell className="font-mono">
                        {row.variantPriceId}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatBdt(row.consumerPrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.exchangePrice ? formatBdt(row.exchangePrice) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview.rows.length > 10 && (
                <p className="text-xs text-muted-foreground">
                  Showing the first 10 of {preview.rows.length} rows. All rows
                  will be processed.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={reading || importMutation.isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                reading ||
                importMutation.isPending ||
                !preview?.rows.length ||
                !!preview.errors.length
              }
              onClick={upload}
            >
              {importMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}{" "}
              Save Prices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
