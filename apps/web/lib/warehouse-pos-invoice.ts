import { PDFDocument } from "pdf-lib";

type InvoiceValue = string | number | null;

export type WarehousePosInvoiceDetail = {
  sale: {
    invoiceNo: string;
    paymentStatus: string;
    deliveryMethod: string;
    responsiblePersonName: string | null;
    saleDate: string;
    subtotal: InvoiceValue;
    discount: InvoiceValue;
    total: InvoiceValue;
    paid: InvoiceValue;
    due: InvoiceValue;
    changeAmount: InvoiceValue;
    createdAt: string | Date;
    note: string | null;
    terms: string | null;
  };
  store: {
    code: string | null;
    name: string;
    address: string | null;
    phone: string | null;
  };
  customer: {
    name: string;
    address: string | null;
    phone: string | null;
  };
  items: Array<{
    id: number;
    sku: string | null;
    productName: string;
    variantLabel: string;
    quantity: InvoiceValue;
    unitPrice: InvoiceValue;
  }>;
};

async function createPdfFromInvoiceElement(element: HTMLElement) {
  await document.fonts.ready;
  await Promise.all(
    Array.from(element.querySelectorAll("img")).map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) return resolve();
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );
  const { default: html2canvas } = await import("html2canvas-pro");
  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    logging: false,
    scale: 2,
    useCORS: true,
  });
  const pagePixelHeight = Math.max(1, Math.floor((canvas.width * 762) / 515));
  const pages: Array<{
    pngDataUrl: string;
    sourceWidth: number;
    sourceHeight: number;
  }> = [];
  for (let sourceY = 0; sourceY < canvas.height; sourceY += pagePixelHeight) {
    const sourceHeight = Math.min(pagePixelHeight, canvas.height - sourceY);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sourceHeight;
    const context = pageCanvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the invoice PDF page");
    context.drawImage(
      canvas,
      0,
      sourceY,
      canvas.width,
      sourceHeight,
      0,
      0,
      canvas.width,
      sourceHeight,
    );
    pages.push({
      pngDataUrl: pageCanvas.toDataURL("image/png"),
      sourceWidth: pageCanvas.width,
      sourceHeight: pageCanvas.height,
    });
  }
  return createWarehousePosInvoicePdfFromPngPages(pages);
}

export async function createWarehousePosInvoicePdfFromPng(
  pngDataUrl: string,
  sourceWidth: number,
  sourceHeight: number,
) {
  return createWarehousePosInvoicePdfFromPngPages([
    { pngDataUrl, sourceWidth, sourceHeight },
  ]);
}

export async function createWarehousePosInvoicePdfFromPngPages(
  pages: Array<{
    pngDataUrl: string;
    sourceWidth: number;
    sourceHeight: number;
  }>,
) {
  if (pages.length === 0)
    throw new Error("The invoice PDF needs at least one page");
  const document = await PDFDocument.create();
  for (const source of pages) {
    if (source.sourceWidth <= 0 || source.sourceHeight <= 0) {
      throw new Error("Invoice PDF page dimensions must be positive");
    }
    const page = document.addPage([595, 842]);
    const image = await document.embedPng(source.pngDataUrl);
    const scale = Math.min(515 / source.sourceWidth, 762 / source.sourceHeight);
    const width = source.sourceWidth * scale;
    const height = source.sourceHeight * scale;
    page.drawImage(image, {
      x: (595 - width) / 2,
      y: 842 - 40 - height,
      width,
      height,
    });
  }
  const bytes = await document.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

export async function createWarehousePosInvoicePdf(
  invoiceElement: HTMLElement,
) {
  return createPdfFromInvoiceElement(invoiceElement);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function shareWarehousePosInvoice(
  detail: WarehousePosInvoiceDetail,
  blob: Blob,
) {
  const file = new File([blob], `${detail.sale.invoiceNo}.pdf`, {
    type: "application/pdf",
  });
  if (
    navigator.share &&
    (!navigator.canShare || navigator.canShare({ files: [file] }))
  ) {
    await navigator.share({
      title: `Invoice ${detail.sale.invoiceNo}`,
      text: `Bikalpo invoice ${detail.sale.invoiceNo}`,
      files: [file],
    });
    return "shared" as const;
  }
  downloadBlob(blob, file.name);
  return "downloaded" as const;
}

export function printWarehousePosInvoice(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.width = "1px";
  frame.style.height = "1px";
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";
  frame.src = url;
  document.body.append(frame);
  frame.addEventListener(
    "load",
    () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      window.setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(url);
      }, 60_000);
    },
    { once: true },
  );
}
