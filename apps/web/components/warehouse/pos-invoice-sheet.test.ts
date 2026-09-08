import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { WarehousePosInvoiceDetail } from "../../lib/warehouse-pos-invoice";
import { PosInvoiceSheet } from "./pos-invoice-sheet";

const invoice: WarehousePosInvoiceDetail = {
  sale: {
    invoiceNo: "INV-20260721-000001",
    paymentStatus: "partial",
    paymentMethod: "cash",
    deliveryMethod: "Self Pickup",
    responsiblePersonName: "Sonia",
    saleDate: "2026-08-13",
    subtotal: "2084.00",
    discount: "84.00",
    tax: "0.00",
    total: "2000.00",
    paid: "500.00",
    due: "1500.00",
    changeAmount: "0.00",
    createdAt: "2026-08-13T00:21:00Z",
    note: null,
    terms: "Please check cylinder seal before use.",
  },
  store: {
    code: "SHP-100245",
    name: "Noor Distribution Hub",
    address: null,
    phone: null,
  },
  customer: {
    name: "MD Roni",
    address: "16, Block-B, Mirpur Rupnagar, Dhaka",
    phone: "017XXXXXXXX",
  },
  items: [
    {
      id: 1,
      sku: "TAH-FASH-001",
      productName: "Georgette Saree for Women",
      variantLabel: "Black one Size",
      quantity: "1.00",
      unitPrice: "1034.00",
    },
    {
      id: 2,
      sku: "OME-LPG-001",
      productName: "Omera LPG Cylinder",
      variantLabel: "Exchange 12KG",
      quantity: "1.00",
      unitPrice: "1050.00",
    },
  ],
};

test("invoice follows reference order and displays persisted discount and totals without invented charges", () => {
  const html = renderToStaticMarkup(
    createElement(PosInvoiceSheet, { invoice }),
  );
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  assert.match(text, /Bikalpo Invoice/);
  assert.match(text, /Noor Distribution Hub/);
  assert.doesNotMatch(text, /SHP-100245|BIKALPOINVOICE/);
  assert.match(text, /13 Aug 2026 06:21 AM/);
  assert.match(text, /\[INV-20260721-000001\]/);
  assert.match(text, /PAYMENT: CASH/);
  assert.match(text, /Georgette Saree for Women Black one Size/);
  assert.match(
    text,
    /Items Total \(2 Items\): ৳2,084 Product Discount: ৳84 Coupon Discount: ৳0 Reward Discount: ৳0 VAT \/ Tax: ৳0 Delivery Charge: ৳0 Shipping Charge: ৳0 GRAND TOTAL: ৳2,000 Paid Amount: ৳500 Due Amount: ৳1,500 Return Amount: ৳0/,
  );
  assert.match(text, /Note .*Please check cylinder seal before use/);
  assert.doesNotMatch(
    text,
    /Responsible|Sale date|Delivery method|COD|BARCODE/,
  );
  assert.ok(
    text.indexOf("Powered by") < text.indexOf("Thank you for shopping"),
  );
  assert.match(html, /href="https:\/\/bikalpo.com"/);
});

test("invoice preserves split payment methods, fractional quantities, and escaped customer text", () => {
  const detail = {
    ...invoice,
    customer: { ...invoice.customer, name: "<script>test</script>" },
    payments: [
      { amount: "250", paymentMethod: "cash" },
      { amount: "250", paymentMethod: "bank" },
      { amount: "0", paymentMethod: "due" },
    ],
    items: [{ ...invoice.items[0]!, quantity: "1.25" }],
  };
  const html = renderToStaticMarkup(
    createElement(PosInvoiceSheet, { invoice: detail }),
  );
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  assert.match(text, /PAYMENT: CASH \+ BANK/);
  assert.match(text, /1\.25/);
  assert.match(html, /&lt;script&gt;test&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test("an unpaid invoice uses its recorded DUE method and omits absent optional fields", () => {
  const detail = {
    ...invoice,
    store: { ...invoice.store, code: null },
    sale: {
      ...invoice.sale,
      paymentMethod: "due",
      paymentStatus: "due",
      paid: 0,
      due: 2000,
      terms: null,
      note: null,
    },
  };
  const html = renderToStaticMarkup(
    createElement(PosInvoiceSheet, { invoice: detail }),
  );
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  assert.match(text, /PAYMENT: DUE/);
  assert.doesNotMatch(text, /COD|SHP-|Note/);
  assert.match(text, /Paid Amount: ৳0 Due Amount: ৳2,000/);
});
