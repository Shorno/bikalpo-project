import { toast } from "sonner";

export type PurchasePrintData = {
  purchaseNumber: string;
  purchaseDate: string | Date | null;
  createdAt: string | Date;
  supplierName: string;
  warehouseLabel: string;
  items: { productName: string; quantity: string; totalCost: string }[];
  total: number;
  paid: number;
  due: number;
  discount?: string | null;
  transportCost?: string | null;
  note?: string | null;
  paymentType?: string;
};

function printMoney(value: number) {
  return `৳${value.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

function formatPrintDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPrintTime(value: string | Date | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildPrintStyles() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; font-size: 12px; color: #1a1a1a; padding: 16px; max-width: 380px; margin: 0 auto; }
    .header { text-align: center; padding-bottom: 12px; border-bottom: 2px solid #333; margin-bottom: 12px; }
    .header h1 { font-size: 16px; font-weight: 700; margin-bottom: 2px; }
    .header p { font-size: 11px; color: #666; }
    .doc-type { text-align: center; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 8px 0; padding: 4px 0; border-top: 1px dashed #ccc; border-bottom: 1px dashed #ccc; }
    .info-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px; }
    .info-row .label { color: #666; }
    .info-row .value { font-weight: 600; }
    .divider { border: none; border-top: 1px dashed #ccc; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; padding: 4px 0; border-bottom: 1px solid #ccc; font-weight: 600; font-size: 10px; color: #666; text-transform: uppercase; }
    th.right, td.right { text-align: right; }
    td { padding: 4px 0; border-bottom: 1px solid #f0f0f0; }
    .summary-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
    .summary-row.total { font-weight: 700; font-size: 14px; border-top: 1px solid #333; padding-top: 6px; margin-top: 4px; }
    .summary-row.due { color: #dc2626; font-weight: 700; }
    .summary-row.paid { color: #16a34a; }
    .footer { text-align: center; margin-top: 16px; padding-top: 10px; border-top: 1px dashed #ccc; font-size: 10px; color: #999; }
    .highlight-box { border: 2px solid #333; border-radius: 4px; padding: 8px; margin: 8px 0; text-align: center; }
    .highlight-box .big { font-size: 18px; font-weight: 700; }
    .highlight-box .sub { font-size: 11px; color: #666; margin-top: 2px; }
    .note { margin-top: 8px; font-size: 11px; color: #444; white-space: pre-line; }
    @media print { body { padding: 0; } }
  `;
}

export function printHtmlContent(html: string) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "-10000px";
  iframe.style.left = "-10000px";
  iframe.style.width = "0";
  iframe.style.height = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 250);
  };
}

export function buildPurchaseInvoiceHtml(data: PurchasePrintData) {
  const itemRows = data.items
    .map(
      (item) => `
      <tr>
        <td>${item.productName}</td>
        <td class="right">${parseFloat(item.quantity || "0").toLocaleString("en-BD", { maximumFractionDigits: 2 })}</td>
        <td class="right">${printMoney(parseFloat(item.totalCost || "0"))}</td>
      </tr>`,
    )
    .join("");

  const discount = parseFloat(data.discount || "0");
  const transport = parseFloat(data.transportCost || "0");
  const status = data.due > 0.001 ? "Partial" : "Paid";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Purchase ${data.purchaseNumber}</title><style>${buildPrintStyles()}</style></head><body>
    <div class="header">
      <h1>${data.warehouseLabel}</h1>
      <p>Purchase Invoice</p>
    </div>
    <div class="doc-type">Supplier Purchase</div>
    <div class="info-row"><span class="label">Invoice No</span><span class="value">${data.purchaseNumber}</span></div>
    <div class="info-row"><span class="label">Date</span><span class="value">${formatPrintDate(data.purchaseDate || data.createdAt)} ${formatPrintTime(data.purchaseDate || data.createdAt)}</span></div>
    <div class="info-row"><span class="label">Supplier</span><span class="value">${data.supplierName}</span></div>
    <div class="info-row"><span class="label">Payment</span><span class="value">${data.paymentType ?? "-"}</span></div>
    <div class="info-row"><span class="label">Status</span><span class="value">${status}</span></div>
    <hr class="divider">
    <table>
      <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Total</th></tr></thead>
      <tbody>${itemRows || '<tr><td colspan="3">No items</td></tr>'}</tbody>
    </table>
    <hr class="divider">
    ${discount > 0 ? `<div class="summary-row"><span>Discount</span><span>-${printMoney(discount)}</span></div>` : ""}
    ${transport > 0 ? `<div class="summary-row"><span>Transport / Tax</span><span>+${printMoney(transport)}</span></div>` : ""}
    <div class="summary-row total"><span>Grand Total</span><span>${printMoney(data.total)}</span></div>
    <div class="summary-row paid"><span>Paid</span><span>${printMoney(data.paid)}</span></div>
    ${data.due > 0.001 ? `<div class="summary-row due"><span>Due</span><span>${printMoney(data.due)}</span></div>` : ""}
    ${data.note ? `<div class="note"><strong>Note:</strong> ${data.note}</div>` : ""}
    <div class="footer">
      <p>Computer-generated purchase invoice</p>
      <p style="margin-top:4px">${formatPrintDate(new Date())} ${formatPrintTime(new Date())}</p>
    </div>
  </body></html>`;
}

export function buildSupplierPaymentReceiptHtml(data: {
  warehouseLabel: string;
  supplierName: string;
  purchaseNumber: string;
  amount: number;
  paymentMethod: string;
  referenceNo?: string;
  invoiceTotal: number;
  totalPaidAfter: number;
  remainingDue: number;
}) {
  const methodLabel =
    data.paymentMethod === "mobile_banking"
      ? "Mobile Banking"
      : data.paymentMethod === "bank"
        ? "Bank Transfer"
        : "Cash";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payment Receipt</title><style>${buildPrintStyles()}</style></head><body>
    <div class="header">
      <h1>${data.warehouseLabel}</h1>
      <p>Supplier Payment Receipt</p>
    </div>
    <div class="doc-type">Payment Receipt</div>
    <div class="info-row"><span class="label">Receipt Date</span><span class="value">${formatPrintDate(new Date())} ${formatPrintTime(new Date())}</span></div>
    <div class="info-row"><span class="label">Invoice Ref</span><span class="value">${data.purchaseNumber}</span></div>
    <div class="info-row"><span class="label">Supplier</span><span class="value">${data.supplierName}</span></div>
    <hr class="divider">
    <div class="highlight-box">
      <div class="sub">Amount Paid</div>
      <div class="big">${printMoney(data.amount)}</div>
      <div class="sub">${methodLabel}${data.referenceNo ? ` · Ref: ${data.referenceNo}` : ""}</div>
    </div>
    <hr class="divider">
    <div class="summary-row"><span>Invoice Total</span><span>${printMoney(data.invoiceTotal)}</span></div>
    <div class="summary-row paid"><span>Total Paid</span><span>${printMoney(data.totalPaidAfter)}</span></div>
    ${data.remainingDue > 0.001 ? `<div class="summary-row due"><span>Remaining Due</span><span>${printMoney(data.remainingDue)}</span></div>` : ""}
    <div class="footer">
      <p>This is a computer-generated receipt.</p>
      <p style="margin-top:4px">${formatPrintDate(new Date())} ${formatPrintTime(new Date())}</p>
    </div>
  </body></html>`;
}

export function buildPurchaseReceiptHtml(data: PurchasePrintData) {
  const status = data.due > 0.001 ? "Partial Payment" : "Paid in Full";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt ${data.purchaseNumber}</title><style>${buildPrintStyles()}</style></head><body>
    <div class="header">
      <h1>${data.warehouseLabel}</h1>
      <p>Payment Receipt</p>
    </div>
    <div class="doc-type">Purchase Receipt</div>
    <div class="info-row"><span class="label">Receipt Date</span><span class="value">${formatPrintDate(new Date())} ${formatPrintTime(new Date())}</span></div>
    <div class="info-row"><span class="label">Invoice Ref</span><span class="value">${data.purchaseNumber}</span></div>
    <div class="info-row"><span class="label">Supplier</span><span class="value">${data.supplierName}</span></div>
    <hr class="divider">
    <div class="highlight-box">
      <div class="sub">Amount Paid</div>
      <div class="big">${printMoney(data.paid)}</div>
      <div class="sub">${status}${data.paymentType ? ` · ${data.paymentType}` : ""}</div>
    </div>
    <hr class="divider">
    <div class="summary-row"><span>Invoice Total</span><span>${printMoney(data.total)}</span></div>
    <div class="summary-row paid"><span>Total Paid</span><span>${printMoney(data.paid)}</span></div>
    ${data.due > 0.001 ? `<div class="summary-row due"><span>Remaining Due</span><span>${printMoney(data.due)}</span></div>` : ""}
    <div class="footer">
      <p>This is a computer-generated receipt.</p>
      <p style="margin-top:4px">${formatPrintDate(new Date())} ${formatPrintTime(new Date())}</p>
    </div>
  </body></html>`;
}

export async function sharePurchaseDocument(
  html: string,
  fileName: string,
  shareTitle: string,
  shareText: string,
) {
  const { default: html2canvas } = await import("html2canvas-pro");

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "-10000px";
  iframe.style.left = "-10000px";
  iframe.style.width = "380px";
  iframe.style.height = "auto";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) throw new Error("Could not access iframe document");

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    setTimeout(resolve, 500);
  });

  const canvas = await html2canvas(iframeDoc.body, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    width: 380,
  });
  document.body.removeChild(iframe);

  const dataUrl = canvas.toDataURL("image/png");
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const file = new File([blob], fileName, { type: "image/png" });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: shareTitle,
      text: shareText,
      files: [file],
    });
    toast.success("Shared successfully");
    return;
  }

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.click();
  toast.success("Image downloaded");
}
