"use client";
import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2, Printer, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { PosInvoiceSheet } from "@/components/warehouse/pos-invoice-sheet";
import {
  createWarehousePosInvoicePdf,
  printWarehousePosInvoice,
  shareWarehousePosInvoice,
  type WarehousePosInvoiceDetail,
} from "@/lib/warehouse-pos-invoice";
import { orpc } from "@/utils/orpc";

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Could not prepare the invoice PDF. Please retry.";
}

export function PosInvoiceDialog({
  open,
  onOpenChange,
  saleId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: number | null;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [generated, setGenerated] = useState<{
    invoice: WarehousePosInvoiceDetail;
    blob: Blob;
  } | null>(null);
  const [pdfError, setPdfError] = useState("");
  const [generationAttempt, setGenerationAttempt] = useState(0);
  const invoiceQuery = useQuery({
    queryKey: ["warehousePos", "invoice", saleId],
    queryFn: () => orpc.warehousePos.getSaleInvoice.call({ saleId: saleId! }),
    enabled: open && saleId !== null,
  });
  const invoice = invoiceQuery.data;
  const invoicePdf =
    generated &&
    open &&
    !invoiceQuery.isFetching &&
    !invoiceQuery.isError &&
    generated.invoice === invoice
      ? generated.blob
      : null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: generationAttempt explicitly retries PDF conversion without refetching invoice data.
  useEffect(() => {
    setGenerated(null);
    setPdfError("");
    if (!open || !invoice || invoiceQuery.isFetching || invoiceQuery.isError)
      return;
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      const element = previewRef.current?.querySelector<HTMLElement>(
        "[data-invoice-preview]",
      );
      if (!element) {
        setPdfError("Invoice preview is not ready. Please retry.");
        return;
      }
      void createWarehousePosInvoicePdf(element)
        .then((blob) => {
          if (!cancelled) setGenerated({ invoice, blob });
        })
        .catch((error) => {
          if (!cancelled) setPdfError(errorMessage(error));
        });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [
    open,
    invoice,
    invoiceQuery.isFetching,
    invoiceQuery.isError,
    generationAttempt,
  ]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Invoice preview</DialogTitle>
          <DialogDescription>
            Print or share the completed invoice PDF.
          </DialogDescription>
        </DialogHeader>
        {invoiceQuery.isLoading ? (
          <div className="flex min-h-80 items-center justify-center text-sm text-zinc-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Preparing invoice…
          </div>
        ) : null}
        {invoiceQuery.isError ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 border border-red-200 bg-red-50 text-sm text-red-700">
            <span>Invoice preview could not be loaded.</span>
            <Button
              onClick={() => invoiceQuery.refetch()}
              size="sm"
              variant="outline"
            >
              Retry
            </Button>
          </div>
        ) : null}
        {invoice ? (
          <div
            ref={previewRef}
            className="overflow-x-auto"
            role="region"
            aria-label="Invoice preview; scroll horizontally to view the full sheet"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: Enable keyboard scrolling of the fixed-width invoice.
            tabIndex={0}
          >
            <PosInvoiceSheet invoice={invoice} />
          </div>
        ) : null}
        {invoice && !invoicePdf && !pdfError ? (
          <p className="flex items-center justify-center gap-2 text-xs font-medium text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Preparing the printable PDF…
          </p>
        ) : null}
        {pdfError ? (
          <div
            role="alert"
            className="space-y-2 text-center text-sm text-red-700"
          >
            <p>{pdfError}</p>
            <Button
              variant="outline"
              onClick={() => setGenerationAttempt((value) => value + 1)}
            >
              Retry PDF
            </Button>
          </div>
        ) : null}
        {invoice ? (
          <DialogFooter className="sm:justify-center">
            <Button
              className="gap-2"
              disabled={!invoicePdf}
              onClick={() => invoicePdf && printWarehousePosInvoice(invoicePdf)}
              variant="outline"
            >
              <Printer className="h-4 w-4" />
              Print only
            </Button>
            <Button
              className="gap-2"
              disabled={!invoicePdf}
              onClick={async () => {
                try {
                  if (!invoicePdf)
                    throw new Error("Invoice PDF is still preparing");
                  const result = await shareWarehousePosInvoice(
                    invoice,
                    invoicePdf,
                  );
                  if (result === "downloaded")
                    toast.info(
                      "Direct file sharing is unavailable, so the PDF was downloaded.",
                    );
                } catch (error) {
                  if ((error as DOMException)?.name !== "AbortError")
                    toast.error(errorMessage(error));
                }
              }}
              variant="outline"
            >
              <Share2 className="h-4 w-4" />
              Share PDF
            </Button>
            <Button
              className="gap-2 bg-blue-700 hover:bg-blue-800"
              disabled={!invoicePdf}
              onClick={async () => {
                try {
                  if (!invoicePdf)
                    throw new Error("Invoice PDF is still preparing");
                  const result = await shareWarehousePosInvoice(
                    invoice,
                    invoicePdf,
                  );
                  if (result === "downloaded")
                    toast.info(
                      "Direct file sharing is unavailable, so the PDF was downloaded.",
                    );
                  printWarehousePosInvoice(invoicePdf);
                } catch (error) {
                  if ((error as DOMException)?.name !== "AbortError")
                    toast.error(errorMessage(error));
                }
              }}
            >
              <FileText className="h-4 w-4" />
              Print &amp; share
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
