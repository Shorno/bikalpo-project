import assert from "node:assert/strict";
import test from "node:test";

import { PDFDocument } from "pdf-lib";

import {
  createWarehousePosInvoicePdfFromPngPages,
  type WarehousePosInvoiceDetail,
} from "./warehouse-pos-invoice";

const invoice: WarehousePosInvoiceDetail = {
  sale: {
    invoiceNo: "INV-20260907-000001",
    paymentStatus: "partial",
    deliveryMethod: "Self Pickup",
    responsiblePersonName: "Sonia",
    saleDate: "2026-09-07",
    subtotal: "250.00",
    discount: "10.00",
    total: "240.00",
    paid: "200.00",
    due: "40.00",
    changeAmount: "0.00",
    createdAt: "2026-09-07T10:00:00.000Z",
    note: null,
    terms: "Please verify the products before leaving the counter.",
  },
  store: {
    code: "WH-001",
    name: "Noor Distribution Hub",
    address: "Mirpur, Dhaka",
    phone: "01700000000",
  },
  customer: {
    name: "Rahim Enterprise",
    address: "Rupnagar, Dhaka",
    phone: "01800000000",
  },
  items: [
    {
      id: 1,
      sku: "OME-LPG-001",
      productName: "Omera LPG Cylinder",
      variantLabel: "Exchange 12 KG",
      quantity: "2.00",
      unitPrice: "125.00",
    },
  ],
};

test("warehouse POS invoice renderer embeds the canonical preview in a valid PDF", async () => {
  const pixel =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XwKsWQAAAABJRU5ErkJggg==";
  const blob = await createWarehousePosInvoicePdfFromPngPages([
    { pngDataUrl: pixel, sourceWidth: 1, sourceHeight: 1 },
    { pngDataUrl: pixel, sourceWidth: 1, sourceHeight: 1 },
  ]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const document = await PDFDocument.load(bytes);

  assert.equal(blob.type, "application/pdf");
  assert.match(new TextDecoder().decode(bytes.slice(0, 8)), /^%PDF-/);
  assert.equal(document.getPageCount(), 2);
  assert.ok(bytes.byteLength > 500);
  assert.equal(invoice.sale.invoiceNo, "INV-20260907-000001");
});
