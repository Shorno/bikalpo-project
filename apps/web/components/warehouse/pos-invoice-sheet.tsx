import * as React from "react";
import type { WarehousePosInvoiceDetail } from "../../lib/warehouse-pos-invoice";

function formatNumber(value: string | number | null | undefined) {
  return Number(value ?? 0).toLocaleString("en-BD", {
    maximumFractionDigits: 2,
  });
}

export function PosInvoiceSheet({
  invoice,
}: {
  invoice: WarehousePosInvoiceDetail;
}): React.ReactElement {
  const { sale, store, customer, items } = invoice;
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
    .format(new Date(sale.createdAt))
    .replace(",", "")
    .replace(/\b(am|pm)\b/, (period) => period.toUpperCase());
  const paymentMethods = [
    ...new Set(
      (invoice.payments ?? [])
        .filter((payment) => Number(payment.amount) > 0)
        .map((payment) => payment.paymentMethod),
    ),
  ];
  const payment = (
    paymentMethods.join(" + ") ||
    sale.paymentMethod ||
    sale.paymentStatus
  ).toUpperCase();
  const charges = [
    [`Items Total (${items.length} Items)`, sale.subtotal],
    ["Product Discount", sale.discount],
    ["Coupon Discount", 0],
    ["Reward Discount", 0],
    ["VAT / Tax", sale.tax ?? 0],
    ["Delivery Charge", 0],
    ["Shipping Charge", 0],
  ] as const;
  const totals = [
    ["GRAND TOTAL", sale.total],
    ["Paid Amount", sale.paid],
    ["Due Amount", sale.due],
  ] as const;

  return (
    <article
      data-invoice-preview=""
      className="w-[760px] max-w-none bg-white p-8 text-sm leading-6 text-zinc-950"
    >
      <header data-invoice-block="">
        <h2
          className="mb-5 flex items-baseline gap-2 text-xl font-bold"
          aria-label="Bikalpo Invoice"
        >
          <span>Bikalpo</span>
          <span>Invoice</span>
        </h2>
        <div className="flex items-start justify-between gap-6">
          {React.createElement("img", {
            src: "/logos/bikalpo-logo.jpg",
            alt: "Bikalpo",
            width: 56,
            height: 56,
            className: "h-14 w-14 object-contain",
          })}
          <time
            dateTime={new Date(sale.createdAt).toISOString()}
            className="pt-1 text-right tabular-nums"
          >
            {date}
          </time>
        </div>
        <p className="mt-2 break-words font-semibold">{store.name}</p>
        <p className="my-5 break-words text-center font-mono font-semibold">
          [{sale.invoiceNo}]
        </p>
        <div className="mb-5">
          <p className="break-words font-semibold">{customer.name}</p>
          {customer.address ? (
            <p className="ml-6 whitespace-pre-wrap break-words">
              {customer.address}
            </p>
          ) : null}
          {customer.phone ? (
            <p className="break-words">Mobile: {customer.phone}</p>
          ) : null}
          <p className="mt-1 font-semibold">PAYMENT: {payment}</p>
        </div>
      </header>

      <table className="w-full table-fixed border-collapse border border-zinc-500 text-left">
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[54%]" />
          <col className="w-[8%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead data-invoice-block="">
          <tr className="border-b border-zinc-500">
            {["SKU", "Product Name / Variant", "Qty", "Price"].map((label) => (
              <th
                key={label}
                scope="col"
                className="border-r border-zinc-500 px-2 py-2 font-semibold last:border-r-0"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              data-invoice-block=""
              className="border-b border-zinc-500 align-top last:border-b-0"
            >
              <td className="break-words border-r border-zinc-500 px-2 py-3 font-mono text-xs">
                {item.sku || "—"}
              </td>
              <td className="break-words border-r border-zinc-500 px-2 py-3">
                {item.productName}
                {item.variantLabel ? ` ${item.variantLabel}` : ""}
              </td>
              <td className="border-r border-zinc-500 px-2 py-3 text-right font-mono tabular-nums">
                {formatNumber(item.quantity)}
              </td>
              <td className="px-2 py-3 text-right font-mono tabular-nums">
                ৳{formatNumber(item.unitPrice)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="py-4">
        {charges.map(([label, amount]) => (
          <div
            key={label}
            data-invoice-block=""
            className="flex justify-between gap-6"
          >
            <dt>{label}:</dt>
            <dd className="font-mono tabular-nums">৳{formatNumber(amount)}</dd>
          </div>
        ))}
        <div
          data-invoice-block=""
          className="mt-3 border-y border-zinc-500 py-3"
        >
          {totals.map(([label, amount], index) => (
            <div
              key={label}
              className={`flex justify-between gap-6 ${index === 0 ? "mb-1 font-bold" : ""}`}
            >
              <dt>{label}:</dt>
              <dd className="font-mono tabular-nums">
                ৳{formatNumber(amount)}
              </dd>
            </div>
          ))}
        </div>
        <div data-invoice-block="" className="mt-3 flex justify-between gap-6">
          <dt>Return Amount:</dt>
          <dd className="font-mono tabular-nums">
            ৳{formatNumber(sale.changeAmount)}
          </dd>
        </div>
      </dl>

      {sale.terms || sale.note ? (
        <section data-invoice-block="" className="mt-3">
          <h3 className="font-semibold">Note</h3>
          <p className="mt-1 whitespace-pre-wrap break-words">
            → {sale.terms || sale.note}
          </p>
        </section>
      ) : null}
      <footer
        data-invoice-block=""
        className="mt-7 space-y-2"
        style={{ fontFamily: "Arial, sans-serif" }}
      >
        <p className="flex items-baseline justify-center gap-1">
          <span className="whitespace-pre">Powered by</span>
          <a
            href="https://bikalpo.com"
            className="whitespace-nowrap underline underline-offset-2"
          >
            Bikalpo.com
          </a>
        </p>
        <p className="whitespace-pre-wrap">
          Thank you for shopping with Bikalpo.
        </p>
      </footer>
    </article>
  );
}
