"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BarChart3Icon,
  CalendarIcon,
  ChevronDownIcon,
  CreditCardIcon,
  DownloadIcon,
  EditIcon,
  EyeIcon,
  FileTextIcon,
  PrinterIcon,
  ReceiptTextIcon,
  RefreshCcwIcon,
  RotateCcwIcon,
  SaveIcon,
  Share2Icon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const BDT = "\u09F3";
const DEFAULT_YEAR = "2026";
const DEFAULT_START_DATE = "2026-01-01";
const DEFAULT_END_DATE = "2026-07-18";
const YEAR_OPTIONS = ["2026", "2025", "2024", "2023"];

const reportCards = [
  {
    description: "Invoice totals, discounts, returns, and net sales.",
    href: "/dashboard/reports/sales",
    icon: BarChart3Icon,
    title: "Sales Report",
  },
  {
    description: "Purchase orders, supplier totals, returns, and net purchase.",
    href: "/dashboard/reports/purchase",
    icon: FileTextIcon,
    title: "Purchase Report",
  },
  {
    description:
      "Supplier bills, outstanding balances, paid, and overdue dues.",
    href: "/dashboard/reports/accounts-payable",
    icon: ReceiptTextIcon,
    title: "Accounts Payable Report",
  },
  {
    description: "Customer invoices, received amounts, open dues, and overdue.",
    href: "/dashboard/reports/accounts-receivable",
    icon: ReceiptTextIcon,
    title: "Accounts Receivable Report",
  },
  {
    description: "Monthly income, purchase, expenses, and net profitability.",
    href: "/dashboard/reports/profit-loss",
    icon: BarChart3Icon,
    title: "Profit & Loss Report",
  },
];

type ReportFiltersState = {
  endDate: string;
  party: string;
  startDate: string;
  year: string;
};

type SummaryMetric = {
  label: string;
  value: string;
  tone: "blue" | "emerald" | "amber" | "rose" | "slate";
};

type ReportColumn = {
  align?: "left" | "right" | "center";
  key: string;
  label: string;
};

type ReportTableRow = {
  id: string;
  links?: Record<string, string>;
  status?: "Overdue" | "Paid" | "Partial" | "Unpaid";
  values: Record<string, string>;
};

type SalesRow = {
  amount: number;
  customer: string;
  date: string;
  dateIso: string;
  discount: number;
  id: string;
  invoiceNo: string;
  net: number;
  returnAmount: number;
};

type PurchaseRow = {
  amount: number;
  date: string;
  dateIso: string;
  discount: number;
  id: string;
  net: number;
  poNo: string;
  returnAmount: number;
  supplier: string;
};

type PayableRow = {
  billNo: string;
  date: string;
  dateIso: string;
  due: number;
  dueDate: string;
  id: string;
  status: "Overdue" | "Paid" | "Unpaid";
  supplier: string;
  totalBill: number;
};

type ReceivableRow = {
  customer: string;
  date: string;
  dateIso: string;
  due: number;
  dueDate: string;
  id: string;
  invoice: number;
  invoiceNo: string;
  status: "Overdue" | "Paid" | "Partial" | "Unpaid";
};

type EditableEntry = {
  account: string;
  accountLine: string;
  accountLineDescription: string;
  amount: number;
  category: string;
  date: string;
  documentTitle: string;
  idNo: string;
  issueDate: string;
  note: string;
  partyName: string;
  paymentMethod: "cash" | "bank" | "mobile-banking";
  primaryAction: string;
  productName: string;
  recipientAddress: string;
  recipientName: string;
  recipientPhone: string;
  referenceCode: string;
  referenceNo: string;
  secondaryCode: string;
  senderName: string;
  total: number;
  totalPaid: number;
};

type EditableEntryKind = "payable" | "receivable";

const salesRows: SalesRow[] = [
  {
    amount: 25000,
    customer: "Noor Store",
    date: "17 Jul",
    dateIso: "2026-07-17",
    discount: 500,
    id: "sales-100245",
    invoiceNo: "INV-100245",
    net: 24500,
    returnAmount: 0,
  },
  {
    amount: 18000,
    customer: "Bismillah Store",
    date: "17 Jul",
    dateIso: "2026-07-17",
    discount: 0,
    id: "sales-100246",
    invoiceNo: "INV-100246",
    net: 18000,
    returnAmount: 0,
  },
  {
    amount: 32000,
    customer: "Hasan Traders",
    date: "18 Jul",
    dateIso: "2026-07-18",
    discount: 1000,
    id: "sales-100247",
    invoiceNo: "INV-100247",
    net: 30500,
    returnAmount: 500,
  },
  {
    amount: 45000,
    customer: "Amin Enterprise",
    date: "18 Jul",
    dateIso: "2026-07-18",
    discount: 0,
    id: "sales-100248",
    invoiceNo: "INV-100248",
    net: 45000,
    returnAmount: 0,
  },
];

const purchaseRows: PurchaseRow[] = [
  {
    amount: 25000,
    date: "17 Jul",
    dateIso: "2026-07-17",
    discount: 500,
    id: "purchase-100245",
    net: 24500,
    poNo: "PO-100245",
    returnAmount: 0,
    supplier: "ABC Distributor",
  },
  {
    amount: 18000,
    date: "17 Jul",
    dateIso: "2026-07-17",
    discount: 0,
    id: "purchase-100246",
    net: 18000,
    poNo: "PO-100246",
    returnAmount: 0,
    supplier: "XYZ Traders",
  },
  {
    amount: 32000,
    date: "18 Jul",
    dateIso: "2026-07-18",
    discount: 1000,
    id: "purchase-100247",
    net: 30500,
    poNo: "PO-100247",
    returnAmount: 500,
    supplier: "Noor Enterprise",
  },
  {
    amount: 45000,
    date: "18 Jul",
    dateIso: "2026-07-18",
    discount: 0,
    id: "purchase-100248",
    net: 45000,
    poNo: "PO-100248",
    returnAmount: 0,
    supplier: "Delta Supply",
  },
];

const payableRows: PayableRow[] = [
  {
    billNo: "BILL-100245",
    date: "17 Jul",
    dateIso: "2026-07-17",
    due: 25000,
    dueDate: "30 Jul",
    id: "payable-100245",
    status: "Unpaid",
    supplier: "ABC Distributor",
    totalBill: 25000,
  },
  {
    billNo: "BILL-100246",
    date: "18 Jul",
    dateIso: "2026-07-18",
    due: 0,
    dueDate: "25 Jul",
    id: "payable-100246",
    status: "Paid",
    supplier: "Noor Enterprise",
    totalBill: 18000,
  },
  {
    billNo: "BILL-100247",
    date: "19 Jul",
    dateIso: "2026-07-19",
    due: 32000,
    dueDate: "28 Jul",
    id: "payable-100247",
    status: "Unpaid",
    supplier: "Delta Supply",
    totalBill: 32000,
  },
  {
    billNo: "BILL-100248",
    date: "20 Jul",
    dateIso: "2026-07-20",
    due: 25000,
    dueDate: "15 Jul",
    id: "payable-100248",
    status: "Overdue",
    supplier: "XYZ Traders",
    totalBill: 45000,
  },
];

const receivableRows: ReceivableRow[] = [
  {
    customer: "Noor Store",
    date: "17 Jul",
    dateIso: "2026-07-17",
    due: 15000,
    dueDate: "30 Jul",
    id: "receivable-100245",
    invoice: 25000,
    invoiceNo: "INV-100245",
    status: "Partial",
  },
  {
    customer: "Rahman Traders",
    date: "18 Jul",
    dateIso: "2026-07-18",
    due: 0,
    dueDate: "25 Jul",
    id: "receivable-100246",
    invoice: 18000,
    invoiceNo: "INV-100246",
    status: "Paid",
  },
  {
    customer: "Bismillah Store",
    date: "19 Jul",
    dateIso: "2026-07-19",
    due: 32000,
    dueDate: "28 Jul",
    id: "receivable-100247",
    invoice: 32000,
    invoiceNo: "INV-100247",
    status: "Unpaid",
  },
  {
    customer: "Amin Enterprise",
    date: "20 Jul",
    dateIso: "2026-07-20",
    due: 25000,
    dueDate: "15 Jul",
    id: "receivable-100248",
    invoice: 45000,
    invoiceNo: "INV-100248",
    status: "Overdue",
  },
];

const initialPayableEntry: EditableEntry = {
  account: "bank",
  accountLine: "Laber bill",
  accountLineDescription: "Laber bill",
  amount: 25000,
  category: "Laber Bill",
  date: "2026-04-27",
  documentTitle: "BIKALPO Bill",
  idNo: "BILL-100245",
  issueDate: "15 Apr 2026 10:30 AM",
  note: "",
  partyName: "ABC Distributor",
  paymentMethod: "bank",
  primaryAction: "Payment",
  productName: "Laber (Daylaber)",
  recipientAddress: "Mirpur-10, Dhaka",
  recipientName: "Rahim Store",
  recipientPhone: "017XXXXXXXX",
  referenceCode: "AK990065782132",
  referenceNo: "REF-001",
  secondaryCode: "ORD-20260415-1001",
  senderName: "Noor Distribution Hub (SHP-100245)",
  total: 25000,
  totalPaid: 0,
};

const initialReceivableEntry: EditableEntry = {
  account: "bank",
  accountLine: "Sales collection",
  accountLineDescription: "Partial invoice collection",
  amount: 15000,
  category: "Product Sales",
  date: "2026-07-27",
  documentTitle: "BIKALPO Invoice",
  idNo: "INV-100245",
  issueDate: "17 Jul 2026 04:15 PM",
  note: "",
  partyName: "Noor Store",
  paymentMethod: "bank",
  primaryAction: "Receive",
  productName: "Retail product order",
  recipientAddress: "Mirpur-10, Dhaka",
  recipientName: "Noor Store",
  recipientPhone: "017XXXXXXXX",
  referenceCode: "INV-100245",
  referenceNo: "REF-001",
  secondaryCode: "SALE-20260717-1001",
  senderName: "Bikalpo Shop (SHP-100245)",
  total: 25000,
  totalPaid: 10000,
};

function payableEntryFromRow(row: PayableRow): EditableEntry {
  return {
    ...initialPayableEntry,
    amount: row.due,
    date: row.dateIso,
    idNo: row.billNo,
    partyName: row.supplier,
    referenceNo: `REF-${row.billNo.replace("BILL-", "")}`,
    total: row.totalBill,
    totalPaid: Math.max(0, row.totalBill - row.due),
  };
}

function receivableEntryFromRow(row: ReceivableRow): EditableEntry {
  return {
    ...initialReceivableEntry,
    amount: row.due,
    date: row.dateIso,
    idNo: row.invoiceNo,
    partyName: row.customer,
    recipientName: row.customer,
    referenceCode: row.invoiceNo,
    referenceNo: `REF-${row.invoiceNo.replace("INV-", "")}`,
    total: row.invoice,
    totalPaid: Math.max(0, row.invoice - row.due),
  };
}

function shortReportDate(dateIso: string) {
  const date = new Date(`${dateIso}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return dateIso;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

const salesColumns: ReportColumn[] = [
  { key: "invoiceNo", label: "Invoice No" },
  { key: "date", label: "Date" },
  { key: "customer", label: "Customer" },
  { align: "right", key: "amount", label: "Amount" },
  { align: "right", key: "discount", label: "Discount" },
  { align: "right", key: "returnAmount", label: "Return" },
  { align: "right", key: "net", label: "Net" },
];

const purchaseColumns: ReportColumn[] = [
  { key: "poNo", label: "PO No." },
  { key: "date", label: "Date" },
  { key: "supplier", label: "Supplier" },
  { align: "right", key: "amount", label: "Amount" },
  { align: "right", key: "discount", label: "Discount" },
  { align: "right", key: "returnAmount", label: "Return" },
  { align: "right", key: "net", label: "Net" },
];

const payableColumns: ReportColumn[] = [
  { key: "billNo", label: "Bill No." },
  { key: "date", label: "Date" },
  { key: "supplier", label: "Supplier" },
  { key: "dueDate", label: "Due Date" },
  { align: "right", key: "totalBill", label: "Total Bill" },
  { align: "right", key: "due", label: "Due" },
  { align: "center", key: "status", label: "Status" },
];

const receivableColumns: ReportColumn[] = [
  { key: "invoiceNo", label: "Invoice No." },
  { key: "date", label: "Date" },
  { key: "customer", label: "Customer" },
  { key: "dueDate", label: "Due Date" },
  { align: "right", key: "invoice", label: "Invoice" },
  { align: "right", key: "due", label: "Due" },
  { align: "center", key: "status", label: "Status" },
];

function money(value: number) {
  return `${BDT}${value.toLocaleString("en-US")}`;
}

function useReportFilters(defaultParty = "all") {
  const [filters, setFilters] = useState<ReportFiltersState>({
    endDate: DEFAULT_END_DATE,
    party: defaultParty,
    startDate: DEFAULT_START_DATE,
    year: DEFAULT_YEAR,
  });

  const updateFilter = (key: keyof ReportFiltersState, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "year"
        ? {
            endDate: `${value}-07-18`,
            startDate: `${value}-01-01`,
          }
        : null),
    }));
  };

  return { filters, updateFilter };
}

function isWithinRange(dateIso: string, filters: ReportFiltersState) {
  const isDefaultRange =
    filters.startDate === DEFAULT_START_DATE &&
    filters.endDate === DEFAULT_END_DATE;

  if (isDefaultRange) {
    return dateIso.startsWith(filters.year);
  }

  return (
    dateIso.startsWith(filters.year) &&
    dateIso >= filters.startDate &&
    dateIso <= filters.endDate
  );
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadCsv(
  filename: string,
  columns: ReportColumn[],
  rows: ReportTableRow[],
) {
  const header = columns.map((column) => csvEscape(column.label)).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((column) => csvEscape(row.values[column.key] ?? ""))
        .join(","),
    )
    .join("\n");
  const blob = new Blob([`${header}\n${body}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportMatrixCsv(filename: string, rows: PnlDisplayRow[]) {
  const header = ["Category", ...pnlMonths].map(csvEscape).join(",");
  const body = rows
    .filter((row) => row.kind !== "spacer")
    .map((row) =>
      [
        csvEscape(row.label),
        ...("values" in row
          ? row.values.map((value) => csvEscape(money(value)))
          : pnlMonths.map(() => csvEscape(""))),
      ].join(","),
    )
    .join("\n");
  const blob = new Blob([`${header}\n${body}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function mapSalesRows(rows: SalesRow[]): ReportTableRow[] {
  return rows.map((row) => ({
    id: row.id,
    links: {
      invoiceNo: `/dashboard/sales?invoice=${encodeURIComponent(row.invoiceNo)}`,
    },
    values: {
      amount: money(row.amount),
      customer: row.customer,
      date: row.date,
      discount: money(row.discount),
      invoiceNo: row.invoiceNo,
      net: money(row.net),
      returnAmount: money(row.returnAmount),
    },
  }));
}

function mapPurchaseRows(rows: PurchaseRow[]): ReportTableRow[] {
  return rows.map((row) => ({
    id: row.id,
    values: {
      amount: money(row.amount),
      date: row.date,
      discount: money(row.discount),
      net: money(row.net),
      poNo: row.poNo,
      returnAmount: money(row.returnAmount),
      supplier: row.supplier,
    },
  }));
}

function mapPayableRows(
  rows: PayableRow[],
  entries: Record<string, EditableEntry> = {},
): ReportTableRow[] {
  return rows.map((row) => {
    const entry = entries[row.id];

    return {
      id: row.id,
      status: row.status,
      values: {
        billNo: entry?.idNo ?? row.billNo,
        date: entry ? shortReportDate(entry.date) : row.date,
        due: money(entry?.amount ?? row.due),
        dueDate: row.dueDate,
        status: row.status,
        supplier: entry?.partyName ?? row.supplier,
        totalBill: money(entry?.total ?? row.totalBill),
      },
    };
  });
}

function mapReceivableRows(
  rows: ReceivableRow[],
  entries: Record<string, EditableEntry> = {},
): ReportTableRow[] {
  return rows.map((row) => {
    const entry = entries[row.id];

    return {
      id: row.id,
      links: {
        invoiceNo: `/dashboard/sales?invoice=${encodeURIComponent(entry?.idNo ?? row.invoiceNo)}`,
      },
      status: row.status,
      values: {
        customer: entry?.partyName ?? row.customer,
        date: entry ? shortReportDate(entry.date) : row.date,
        due: money(entry?.amount ?? row.due),
        dueDate: row.dueDate,
        invoice: money(entry?.total ?? row.invoice),
        invoiceNo: entry?.idNo ?? row.invoiceNo,
        status: row.status,
      },
    };
  });
}

export function SalesReportPage() {
  const { filters, updateFilter } = useReportFilters();
  const filteredRows = useMemo(
    () =>
      salesRows.filter(
        (row) =>
          isWithinRange(row.dateIso, filters) &&
          (filters.party === "all" || row.customer === filters.party),
      ),
    [filters],
  );
  const tableRows = mapSalesRows(filteredRows);
  const partyOptions = [
    { label: "All Customer", value: "all" },
    ...salesRows.map((row) => ({ label: row.customer, value: row.customer })),
  ];

  return (
    <ReportShell
      exportLabel="sales-report.csv"
      icon={BarChart3Icon}
      onExport={() => downloadCsv("sales-report.csv", salesColumns, tableRows)}
      title="Sales Report"
    >
      <ReportFilters
        filters={filters}
        onChange={updateFilter}
        partyLabel="Customer"
        partyOptions={partyOptions}
      />
      <SummaryStrip
        metrics={[
          { label: "Total Invoice", tone: "blue", value: "145 Invoice" },
          { label: "Total Sales", tone: "emerald", value: money(1250000) },
          { label: "Discount", tone: "amber", value: money(25000) },
          { label: "Return", tone: "rose", value: money(15000) },
          { label: "Net Sales", tone: "slate", value: money(1210000) },
        ]}
      />
      <ReportTable columns={salesColumns} rows={tableRows} />
    </ReportShell>
  );
}

export function ReportsIndexPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg border bg-white text-blue-700 shadow-sm">
          <FileTextIcon className="size-5" />
        </div>
        <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-950">
          Reports
        </h1>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {reportCards.map((report) => (
          <Link
            className="group rounded-lg border bg-white p-4 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
            href={report.href}
            key={report.href}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-700">
                  <report.icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-slate-950">
                    {report.title}
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    {report.description}
                  </p>
                </div>
              </div>
              <ArrowRightIcon className="mt-1 size-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-700" />
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}

export function PurchaseReportPage() {
  const { filters, updateFilter } = useReportFilters();
  const filteredRows = useMemo(
    () =>
      purchaseRows.filter(
        (row) =>
          isWithinRange(row.dateIso, filters) &&
          (filters.party === "all" || row.supplier === filters.party),
      ),
    [filters],
  );
  const tableRows = mapPurchaseRows(filteredRows);
  const partyOptions = [
    { label: "All Suppliers", value: "all" },
    ...purchaseRows.map((row) => ({
      label: row.supplier,
      value: row.supplier,
    })),
  ];

  return (
    <ReportShell
      exportLabel="purchase-report.csv"
      icon={FileTextIcon}
      onExport={() =>
        downloadCsv("purchase-report.csv", purchaseColumns, tableRows)
      }
      title="Purchase Report"
    >
      <ReportFilters
        filters={filters}
        onChange={updateFilter}
        partyLabel="Supplier"
        partyOptions={partyOptions}
      />
      <SummaryStrip
        metrics={[
          { label: "Total Purchase Orders", tone: "blue", value: "98 Orders" },
          { label: "Total Purchase", tone: "emerald", value: money(985000) },
          { label: "Discount", tone: "amber", value: money(12000) },
          { label: "Return", tone: "rose", value: money(8000) },
          { label: "Net Purchase", tone: "slate", value: money(965000) },
        ]}
      />
      <ReportTable columns={purchaseColumns} rows={tableRows} />
    </ReportShell>
  );
}

export function AccountsPayableReportPage() {
  const { filters, updateFilter } = useReportFilters();
  const [entries, setEntries] = useState<Record<string, EditableEntry>>(() =>
    Object.fromEntries(
      payableRows.map((row) => [row.id, payableEntryFromRow(row)]),
    ),
  );
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const filteredRows = useMemo(
    () =>
      payableRows.filter(
        (row) =>
          isWithinRange(row.dateIso, filters) &&
          (filters.party === "all" || row.supplier === filters.party),
      ),
    [filters],
  );
  const tableRows = mapPayableRows(filteredRows, entries);
  const editingEntry = editingRowId ? entries[editingRowId] : undefined;
  const partyOptions = [
    { label: "All Suppliers", value: "all" },
    ...payableRows.map((row) => ({ label: row.supplier, value: row.supplier })),
  ];

  return (
    <ReportShell
      exportLabel="accounts-payable-report.csv"
      icon={ReceiptTextIcon}
      onExport={() =>
        downloadCsv("accounts-payable-report.csv", payableColumns, tableRows)
      }
      title="Accounts Payable Report"
    >
      <ReportFilters
        filters={filters}
        onChange={updateFilter}
        partyLabel="Supplier"
        partyOptions={partyOptions}
      />
      <SummaryStrip
        metrics={[
          { label: "Total Bills", tone: "blue", value: "248 Bills" },
          { label: "Outstanding", tone: "amber", value: money(845000) },
          { label: "Paid", tone: "emerald", value: money(1250000) },
          { label: "Overdue", tone: "rose", value: money(120000) },
        ]}
      />
      <ReportTable
        columns={payableColumns}
        detailTriggerKey="billNo"
        onEditRow={(row) => {
          setEditingRowId(row.id);
        }}
        rows={tableRows}
      />
      {editingEntry && editingRowId && (
        <EntryEditScreen
          entry={editingEntry}
          kind="payable"
          onClose={() => setEditingRowId(null)}
          onSave={(nextEntry) => {
            setEntries((current) => ({
              ...current,
              [editingRowId]: nextEntry,
            }));
          }}
          title="Bill Details"
        />
      )}
    </ReportShell>
  );
}

export function AccountsReceivableReportPage() {
  const { filters, updateFilter } = useReportFilters();
  const [entries, setEntries] = useState<Record<string, EditableEntry>>(() =>
    Object.fromEntries(
      receivableRows.map((row) => [row.id, receivableEntryFromRow(row)]),
    ),
  );
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const filteredRows = useMemo(
    () =>
      receivableRows.filter(
        (row) =>
          isWithinRange(row.dateIso, filters) &&
          (filters.party === "all" || row.customer === filters.party),
      ),
    [filters],
  );
  const tableRows = mapReceivableRows(filteredRows, entries);
  const editingEntry = editingRowId ? entries[editingRowId] : undefined;
  const partyOptions = [
    { label: "All Customer", value: "all" },
    ...receivableRows.map((row) => ({
      label: row.customer,
      value: row.customer,
    })),
  ];

  return (
    <ReportShell
      exportLabel="accounts-receivable-report.csv"
      icon={ReceiptTextIcon}
      onExport={() =>
        downloadCsv(
          "accounts-receivable-report.csv",
          receivableColumns,
          tableRows,
        )
      }
      title="Accounts Receivable Report"
    >
      <ReportFilters
        filters={filters}
        onChange={updateFilter}
        partyLabel="Customer"
        partyOptions={partyOptions}
      />
      <SummaryStrip
        metrics={[
          { label: "Total Customers", tone: "blue", value: "185 Customers" },
          { label: "Total Invoices", tone: "slate", value: "425 Invoices" },
          { label: "Outstanding", tone: "amber", value: money(675000) },
          { label: "Received", tone: "emerald", value: money(2850000) },
          { label: "Overdue", tone: "rose", value: money(95000) },
        ]}
      />
      <ReportTable
        columns={receivableColumns}
        onEditRow={(row) => {
          setEditingRowId(row.id);
        }}
        rows={tableRows}
      />
      {editingEntry && editingRowId && (
        <EntryEditScreen
          entry={editingEntry}
          kind="receivable"
          onClose={() => setEditingRowId(null)}
          onSave={(nextEntry) => {
            setEntries((current) => ({
              ...current,
              [editingRowId]: nextEntry,
            }));
          }}
          title="Invoice Details"
        />
      )}
    </ReportShell>
  );
}

export function ProfitLossMatrixReportPage() {
  const [reportType, setReportType] = useState("annually");
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [endDate, setEndDate] = useState(DEFAULT_END_DATE);

  const resetFilters = () => {
    setReportType("annually");
    setYear(DEFAULT_YEAR);
    setStartDate(DEFAULT_START_DATE);
    setEndDate(DEFAULT_END_DATE);
  };

  return (
    <ReportShell
      exportLabel="profit-loss-report.csv"
      icon={BarChart3Icon}
      onExport={() => exportMatrixCsv("profit-loss-report.csv", pnlRows)}
      title="Profit & Loss Report"
    >
      <p className="max-w-2xl text-sm text-slate-600">
        Monthly financial overview showing income, expenses, and net
        profitability.
      </p>
      <ProfitLossFilters
        endDate={endDate}
        onEndDateChange={setEndDate}
        onReportTypeChange={setReportType}
        onReset={resetFilters}
        onStartDateChange={setStartDate}
        onYearChange={(value) => {
          setYear(value);
          setStartDate(`${value}-01-01`);
          setEndDate(`${value}-07-18`);
        }}
        reportType={reportType}
        startDate={startDate}
        year={year}
      />
      <ProfitLossMatrix rows={pnlRows} />
    </ReportShell>
  );
}

function ReportShell({
  children,
  icon: Icon,
  onExport,
  title,
}: {
  children: React.ReactNode;
  exportLabel: string;
  icon: LucideIcon;
  onExport: () => void;
  title: string;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-white text-blue-700 shadow-sm">
            <Icon className="size-5" />
          </div>
          <h1 className="min-w-0 break-words text-xl font-bold uppercase leading-tight tracking-wide text-slate-950 sm:text-2xl">
            {title}
          </h1>
        </div>
        <Button
          className="h-9 w-full border-blue-200 bg-white px-4 text-blue-700 hover:bg-blue-50 sm:w-fit"
          onClick={onExport}
          type="button"
          variant="outline"
        >
          <DownloadIcon />
          Export
          <ChevronDownIcon />
        </Button>
      </div>
      {children}
    </div>
  );
}

function ReportFilters({
  filters,
  onChange,
  partyLabel,
  partyOptions,
}: {
  filters: ReportFiltersState;
  onChange: (key: keyof ReportFiltersState, value: string) => void;
  partyLabel: "Customer" | "Supplier";
  partyOptions: { label: string; value: string }[];
}) {
  return (
    <section className="rounded-lg border bg-white p-3 shadow-sm sm:p-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="space-y-4">
          <FieldLabel>Date Range</FieldLabel>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-[160px_200px_200px]">
            <Select
              onValueChange={(value) => onChange("year", value)}
              value={filters.year}
            >
              <SelectTrigger className="h-10 w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateInput
              ariaLabel={`${partyLabel} report start date`}
              onChange={(value) => onChange("startDate", value)}
              value={filters.startDate}
            />
            <DateInput
              ariaLabel={`${partyLabel} report end date`}
              onChange={(value) => onChange("endDate", value)}
              value={filters.endDate}
            />
          </div>
          <div className="w-full sm:max-w-xs">
            <FieldLabel>{partyLabel}</FieldLabel>
            <Select
              onValueChange={(value) => onChange("party", value)}
              value={filters.party}
            >
              <SelectTrigger className="mt-2 h-10 w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {partyOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          className="h-10 w-full bg-blue-700 px-5 hover:bg-blue-800 lg:w-auto"
          type="button"
        >
          <RefreshCcwIcon />
          Update Report
        </Button>
      </div>
    </section>
  );
}

function ProfitLossFilters({
  endDate,
  onEndDateChange,
  onReportTypeChange,
  onReset,
  onStartDateChange,
  onYearChange,
  reportType,
  startDate,
  year,
}: {
  endDate: string;
  onEndDateChange: (value: string) => void;
  onReportTypeChange: (value: string) => void;
  onReset: () => void;
  onStartDateChange: (value: string) => void;
  onYearChange: (value: string) => void;
  reportType: string;
  startDate: string;
  year: string;
}) {
  return (
    <section className="rounded-lg border bg-white p-3 shadow-sm sm:p-4">
      <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-start">
        <div className="space-y-4">
          <FieldLabel>Date Range</FieldLabel>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[170px_170px_200px_200px]">
            <div>
              <FieldLabel>Report Type</FieldLabel>
              <Select onValueChange={onReportTypeChange} value={reportType}>
                <SelectTrigger className="mt-2 h-10 w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annually">Annually</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Choose Year</FieldLabel>
              <Select onValueChange={onYearChange} value={year}>
                <SelectTrigger className="mt-2 h-10 w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Start Date</FieldLabel>
              <DateInput
                ariaLabel="Profit and loss start date"
                className="mt-2"
                onChange={onStartDateChange}
                value={startDate}
              />
            </div>
            <div>
              <FieldLabel>End Date</FieldLabel>
              <DateInput
                ariaLabel="Profit and loss end date"
                className="mt-2"
                onChange={onEndDateChange}
                value={endDate}
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap xl:justify-end">
          <Button
            className="h-10 w-full bg-blue-700 px-5 hover:bg-blue-800 sm:w-auto"
            type="button"
          >
            <RefreshCcwIcon />
            Generate Report
          </Button>
          <Button
            className="h-10 w-full border-slate-300 bg-white px-5 sm:w-auto"
            onClick={onReset}
            type="button"
            variant="outline"
          >
            <RotateCcwIcon />
            Reset Filter
          </Button>
        </div>
      </div>
    </section>
  );
}

function DateInput({
  ariaLabel,
  className,
  onChange,
  value,
}: {
  ariaLabel: string;
  className?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Input
        aria-label={ariaLabel}
        className="h-10 bg-white pr-9"
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
      <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
      {children}
    </div>
  );
}

function SummaryStrip({ metrics }: { metrics: SummaryMetric[] }) {
  return (
    <section className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-5">
      {metrics.map((metric) => (
        <div
          className="min-w-0 rounded-lg border bg-white p-3 shadow-sm sm:p-4"
          key={metric.label}
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {metric.label}
          </div>
          <div
            className={cn(
              "mt-2 break-words text-lg font-bold tabular-nums sm:text-xl",
              metricToneClass(metric.tone),
            )}
          >
            {metric.value}
          </div>
        </div>
      ))}
    </section>
  );
}

function metricToneClass(tone: SummaryMetric["tone"]) {
  switch (tone) {
    case "amber":
      return "text-amber-700";
    case "blue":
      return "text-blue-700";
    case "emerald":
      return "text-emerald-700";
    case "rose":
      return "text-rose-700";
    case "slate":
      return "text-slate-950";
  }
}

function ReportTable({
  columns,
  detailTriggerKey,
  onEditRow,
  rows,
}: {
  columns: ReportColumn[];
  detailTriggerKey?: string;
  onEditRow?: (row: ReportTableRow) => void;
  rows: ReportTableRow[];
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="divide-y divide-slate-100 md:hidden">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            No report rows for the selected filters.
          </div>
        ) : (
          rows.map((row) => (
            <article className="p-4" key={row.id}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {columns.map((column) => (
                  <div className="min-w-0" key={column.key}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {column.label}
                    </div>
                    <div
                      className={cn(
                        "mt-1 break-words text-sm text-slate-700",
                        column.align === "right" && "tabular-nums",
                        column.key.endsWith("No") ||
                          column.key === "billNo" ||
                          column.key === "invoiceNo" ||
                          column.key === "poNo"
                          ? "font-semibold text-slate-950"
                          : null,
                      )}
                    >
                      {onEditRow && detailTriggerKey === column.key ? (
                        <button
                          aria-label={`View details for ${row.values[column.key]}`}
                          className="font-semibold text-blue-700 underline-offset-4 hover:underline"
                          onClick={() => onEditRow(row)}
                          type="button"
                        >
                          {row.values[column.key]}
                        </button>
                      ) : (
                        <ReportCellValue column={column} row={row} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {onEditRow && !detailTriggerKey && (
                <Button
                  aria-label={`Edit ${row.values.invoiceNo ?? row.values.billNo ?? "report row"}`}
                  className="mt-4 w-full"
                  onClick={() => onEditRow(row)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <EditIcon />
                  Edit
                </Button>
              )}
            </article>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => (
                <th
                  className={cn(
                    "px-4 py-3 font-semibold",
                    alignClass(column.align),
                  )}
                  key={column.key}
                >
                  {column.label}
                </th>
              ))}
              {onEditRow && !detailTriggerKey && (
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-12 text-center text-sm text-slate-500"
                  colSpan={
                    columns.length + (onEditRow && !detailTriggerKey ? 1 : 0)
                  }
                >
                  No report rows for the selected filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr className="hover:bg-slate-50/80" key={row.id}>
                  {columns.map((column) => (
                    <td
                      className={cn(
                        "px-4 py-3 text-slate-700",
                        alignClass(column.align),
                        column.align === "right" && "tabular-nums",
                        column.key === "status" && "text-center",
                        column.key.endsWith("No") ||
                          column.key === "billNo" ||
                          column.key === "invoiceNo" ||
                          column.key === "poNo"
                          ? "font-semibold text-slate-950"
                          : null,
                      )}
                      key={column.key}
                    >
                      {onEditRow && detailTriggerKey === column.key ? (
                        <button
                          aria-label={`View details for ${row.values[column.key]}`}
                          className="font-semibold text-blue-700 underline-offset-4 hover:underline"
                          onClick={() => onEditRow(row)}
                          type="button"
                        >
                          {row.values[column.key]}
                        </button>
                      ) : (
                        <ReportCellValue column={column} row={row} />
                      )}
                    </td>
                  ))}
                  {onEditRow && !detailTriggerKey && (
                    <td className="px-4 py-3 text-right">
                      <Button
                        aria-label={`Edit ${row.values.invoiceNo ?? row.values.billNo ?? "report row"}`}
                        onClick={() => onEditRow(row)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <EditIcon />
                        Edit
                      </Button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReportCellValue({
  column,
  row,
}: {
  column: ReportColumn;
  row: ReportTableRow;
}) {
  if (column.key === "status" && row.status) {
    return <StatusPill status={row.status} />;
  }

  const href = row.links?.[column.key];
  if (href) {
    return (
      <Link
        className="font-semibold text-blue-700 underline-offset-4 hover:underline"
        href={href}
      >
        {row.values[column.key]}
      </Link>
    );
  }

  return row.values[column.key];
}

function alignClass(align: ReportColumn["align"]) {
  if (align === "right") {
    return "text-right";
  }
  if (align === "center") {
    return "text-center";
  }
  return "text-left";
}

function StatusPill({
  status,
}: {
  status: NonNullable<ReportTableRow["status"]>;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold",
        status === "Paid" && "bg-emerald-50 text-emerald-700",
        status === "Partial" && "bg-blue-50 text-blue-700",
        status === "Unpaid" && "bg-amber-50 text-amber-700",
        status === "Overdue" && "bg-rose-50 text-rose-700",
      )}
    >
      {status}
    </span>
  );
}

function EntryEditScreen({
  entry,
  kind,
  onClose,
  onSave,
  title,
}: {
  entry: EditableEntry;
  kind: EditableEntryKind;
  onClose: () => void;
  onSave: (entry: EditableEntry) => void;
  title: string;
}) {
  const [draft, setDraft] = useState(entry);
  const [error, setError] = useState("");
  const [screen, setScreen] = useState<"details" | "edit" | "preview">(
    "details",
  );
  const [savedMessage, setSavedMessage] = useState("");
  const maxAmount = Math.max(
    0,
    kind === "receivable" ? draft.total - draft.totalPaid : draft.total,
  );

  const updateDraft = <Key extends keyof EditableEntry>(
    key: Key,
    value: EditableEntry[Key],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
    setSavedMessage("");
  };

  const save = (closeAfterSave = false) => {
    const validationError = getEntryValidationError(draft, kind);

    if (validationError) {
      setError(validationError);
      return;
    }

    onSave(draft);
    if (closeAfterSave) {
      onClose();
      return;
    }

    setSavedMessage("Changes saved.");
  };

  const dialogTitle =
    screen === "edit"
      ? kind === "payable"
        ? "Edit Bill"
        : "Edit Receivable Payment"
      : screen === "preview"
        ? draft.documentTitle
        : title;

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      open
    >
      <DialogContent
        className={cn(
          "gap-0 bg-white p-0",
          screen === "edit"
            ? "h-dvh max-h-dvh w-screen max-w-none grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-none sm:max-w-none"
            : "h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto sm:h-auto sm:max-h-[92vh]",
          screen === "details" && "sm:max-w-5xl",
          screen === "preview" && "sm:max-w-3xl",
        )}
      >
        <DialogHeader className="border-b px-4 py-4 sm:px-6 sm:py-5">
          <div className="pr-9">
            <DialogTitle className="text-lg font-bold text-slate-950 sm:text-xl">
              {dialogTitle}
            </DialogTitle>
            <DialogDescription className="sr-only">
              View or edit the selected{" "}
              {kind === "payable" ? "bill" : "invoice"}.
            </DialogDescription>
          </div>
        </DialogHeader>

        {screen === "details" && (
          <EntryReadOnlyDetails
            entry={draft}
            kind={kind}
            onEdit={() => {
              setError("");
              setSavedMessage("");
              setScreen("edit");
            }}
            onView={() => setScreen("preview")}
          />
        )}

        {screen === "preview" && (
          <main className="px-3 py-3 sm:px-6 sm:py-5">
            <Button
              className="mb-4"
              onClick={() => setScreen("details")}
              type="button"
              variant="outline"
            >
              <ArrowLeftIcon />
              Back to Details
            </Button>
            <BillPreview entry={draft} />
          </main>
        )}

        {screen === "edit" && (
          <EntryFullScreenEditor
            draft={draft}
            error={error}
            kind={kind}
            maxAmount={maxAmount}
            onBack={() => {
              setDraft(entry);
              setError("");
              setSavedMessage("");
              setScreen("details");
            }}
            onSave={save}
            savedMessage={savedMessage}
            updateDraft={updateDraft}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type UpdateEditableEntry = <Key extends keyof EditableEntry>(
  key: Key,
  value: EditableEntry[Key],
) => void;

function EntryReadOnlyDetails({
  entry,
  kind,
  onEdit,
  onView,
}: {
  entry: EditableEntry;
  kind: EditableEntryKind;
  onEdit: () => void;
  onView: () => void;
}) {
  return (
    <main className="px-3 py-3 sm:px-6 sm:py-5">
      <section className="rounded-lg border bg-white p-3 sm:p-4">
        <h3 className="text-lg font-bold text-slate-950">
          {kind === "payable" ? "Bill" : "Invoice Payment"}
        </h3>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ReadOnlyField
            label={kind === "payable" ? "Payee Name" : "Customer Name"}
            value={entry.partyName}
          />
          <ReadOnlyField label="ID No" value={entry.idNo} />
          <ReadOnlyField label="Date" value={entry.date} />
          <ReadOnlyField label="Amount" value={money(entry.amount)} />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <ReadOnlyField label="Reference No" value={entry.referenceNo} />
          <ReadOnlyField
            label="Payment Method"
            value={paymentLabel(entry.paymentMethod)}
          />
          <ReadOnlyField label="Account" value={paymentLabel(entry.account)} />
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Account Name</span>
            <span>Description</span>
            <span className="text-right">Amount</span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 px-4 py-4 text-sm">
            <span className="break-words font-medium text-slate-950">
              {entry.accountLine}
            </span>
            <span className="break-words text-slate-700">
              {entry.accountLineDescription}
            </span>
            <span className="text-right font-semibold tabular-nums">
              {money(entry.amount)}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="space-y-4">
            <ReadOnlyField label="Attachment" value="No attachment" />
            <ReadOnlyField
              label="Note"
              multiline
              value={entry.note || "No note"}
            />
          </div>
          <div className="space-y-2 bg-slate-50 p-4 text-sm">
            <AmountLine label="Amount" value={entry.amount} />
            <AmountLine label="Total" strong value={entry.total} />
            <AmountLine
              label="Outstanding"
              value={Math.max(0, entry.total - entry.totalPaid)}
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 border-t pt-4 sm:flex sm:flex-wrap sm:justify-end">
          <Button className="w-full sm:w-auto" type="button" variant="outline">
            <CreditCardIcon />
            Write Off
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={onView}
            type="button"
            variant="outline"
          >
            <EyeIcon />
            View
          </Button>
          <Button
            className="w-full bg-blue-700 hover:bg-blue-800 sm:w-auto"
            onClick={onEdit}
            type="button"
          >
            <EditIcon />
            Edit
          </Button>
        </div>
      </section>
    </main>
  );
}

function EntryFullScreenEditor({
  draft,
  error,
  kind,
  maxAmount,
  onBack,
  onSave,
  savedMessage,
  updateDraft,
}: {
  draft: EditableEntry;
  error: string;
  kind: EditableEntryKind;
  maxAmount: number;
  onBack: () => void;
  onSave: (closeAfterSave?: boolean) => void;
  savedMessage: string;
  updateDraft: UpdateEditableEntry;
}) {
  return (
    <main className="min-h-0 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}
      {savedMessage && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          {savedMessage}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_170px]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <EditableInput
            label={kind === "payable" ? "Payee Name*" : "Customer Name*"}
            onChange={(value) => updateDraft("partyName", value)}
            value={draft.partyName}
          />
          <EditableInput
            label="ID No*"
            onChange={(value) => updateDraft("idNo", value)}
            value={draft.idNo}
          />
          <EditableInput
            label="Date*"
            onChange={(value) => updateDraft("date", value)}
            type="date"
            value={draft.date}
          />
          <EditableInput
            label="Reference No*"
            onChange={(value) => updateDraft("referenceNo", value)}
            value={draft.referenceNo}
          />
          <EditableSelect
            label="Payment Method*"
            onChange={(value) =>
              updateDraft(
                "paymentMethod",
                value as EditableEntry["paymentMethod"],
              )
            }
            value={draft.paymentMethod}
          />
          <EditableSelect
            label="Account*"
            onChange={(value) => updateDraft("account", value)}
            value={draft.account}
          />
        </div>

        <div className="rounded-lg border bg-slate-50 px-4 py-3 text-right">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Amount
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-950 tabular-nums">
            {money(draft.amount)}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 rounded-lg border bg-slate-50 p-3 md:hidden">
        <EditableInput
          label="Account Name*"
          onChange={(value) => updateDraft("accountLine", value)}
          value={draft.accountLine}
        />
        <EditableInput
          label="Description*"
          onChange={(value) => updateDraft("accountLineDescription", value)}
          value={draft.accountLineDescription}
        />
        <EditableInput
          label="Amount*"
          max={maxAmount}
          min={0}
          onChange={(value) => updateDraft("amount", toPositiveNumber(value))}
          type="number"
          value={String(draft.amount)}
        />
      </div>

      <div className="mt-6 hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-14 px-4 py-3 font-semibold">#</th>
              <th className="px-4 py-3 font-semibold">Account Name*</th>
              <th className="px-4 py-3 font-semibold">Description*</th>
              <th className="px-4 py-3 text-right font-semibold">Amount*</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-3 text-slate-500">1</td>
              <td className="px-4 py-3">
                <Input
                  className="h-10 bg-white"
                  onChange={(event) =>
                    updateDraft("accountLine", event.target.value)
                  }
                  value={draft.accountLine}
                />
              </td>
              <td className="px-4 py-3">
                <Input
                  className="h-10 bg-white"
                  onChange={(event) =>
                    updateDraft("accountLineDescription", event.target.value)
                  }
                  value={draft.accountLineDescription}
                />
              </td>
              <td className="px-4 py-3">
                <Input
                  className="h-10 bg-white text-right"
                  max={maxAmount}
                  min={0}
                  onChange={(event) =>
                    updateDraft("amount", toPositiveNumber(event.target.value))
                  }
                  type="number"
                  value={String(draft.amount)}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-6 border-t pt-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <EditableTextarea
          label="Notes"
          onChange={(value) => updateDraft("note", value)}
          value={draft.note}
        />
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Attachment
          </Label>
          <div className="mt-2 flex min-h-28 items-center justify-center rounded-lg border border-dashed bg-white text-sm text-slate-500">
            No attachment
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex flex-wrap justify-end gap-2 border-t bg-white px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Button onClick={onBack} type="button" variant="ghost">
          <ArrowLeftIcon />
          Back to Details
        </Button>
        <Button onClick={() => onSave()} type="button" variant="outline">
          <SaveIcon />
          Save
        </Button>
        <Button
          className="bg-blue-700 hover:bg-blue-800"
          onClick={() => onSave(true)}
          type="button"
        >
          Save &amp; Close
        </Button>
      </div>
    </main>
  );
}

function ReadOnlyField({
  label,
  multiline,
  value,
}: {
  label: string;
  multiline?: boolean;
  value: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </div>
      <div
        className={cn(
          "mt-2 rounded-lg border bg-slate-50 px-3 py-2.5 text-sm text-slate-900",
          multiline && "min-h-24 whitespace-pre-wrap",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function paymentLabel(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getEntryValidationError(
  entry: EditableEntry,
  kind: EditableEntryKind,
) {
  const requiredFields = [
    entry.partyName,
    entry.idNo,
    entry.date,
    entry.referenceNo,
    entry.account,
    entry.accountLine,
    entry.accountLineDescription,
    entry.senderName,
    entry.referenceCode,
    entry.recipientName,
    entry.productName,
    entry.category,
  ];

  if (requiredFields.some((value) => !value.trim())) {
    return "Please complete all required fields before saving.";
  }

  if (!Number.isFinite(entry.amount) || entry.amount < 0) {
    return "Amount cannot be negative.";
  }

  if (!Number.isFinite(entry.totalPaid) || entry.totalPaid < 0) {
    return "Total paid cannot be negative.";
  }

  if (entry.totalPaid > entry.total) {
    return "Total paid cannot be greater than the total bill.";
  }

  const maxAmount = Math.max(
    0,
    kind === "receivable" ? entry.total - entry.totalPaid : entry.total,
  );

  if (entry.amount > maxAmount) {
    return `Amount cannot exceed ${money(maxAmount)}.`;
  }

  return "";
}

function toPositiveNumber(value: string) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, numericValue);
}

function EditableInput({
  label,
  max,
  min,
  onChange,
  type = "text",
  value,
}: {
  label: string;
  max?: number;
  min?: number;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <div>
      <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </Label>
      <Input
        className="mt-2 h-10 bg-white"
        max={max}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </div>
  );
}

function EditableTextarea({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div>
      <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </Label>
      <Textarea
        className="mt-2 min-h-28 resize-none bg-white"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </div>
  );
}

function EditableSelect({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div>
      <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </Label>
      <Select onValueChange={onChange} value={value}>
        <SelectTrigger className="mt-2 h-10 w-full bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cash">Cash</SelectItem>
          <SelectItem value="bank">Bank</SelectItem>
          <SelectItem value="mobile-banking">Mobile Banking</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function AmountLine({
  label,
  strong,
  value,
}: {
  label: string;
  strong?: boolean;
  value: number;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        strong && "border-t border-slate-200 pt-2 font-bold text-slate-950",
      )}
    >
      <span className="text-slate-600">{label}</span>
      <span className="tabular-nums">{money(value)}</span>
    </div>
  );
}

function escapePrintText(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildBillPrintHtml(entry: EditableEntry) {
  const amountDue = Math.max(0, entry.total - entry.totalPaid);
  const value = (text: string | number) => escapePrintText(text);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${value(entry.documentTitle)} ${value(entry.idNo)}</title>
    <style>
      @page { size: A4; margin: 14mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #0f172a; background: #fff; font: 14px/1.45 Arial, sans-serif; }
      .bill { width: 100%; max-width: 760px; margin: 0 auto; border: 1px solid #cbd5e1; padding: 22px; }
      h1 { margin: 0; padding-bottom: 14px; border-bottom: 1px solid #cbd5e1; text-align: center; font-size: 20px; }
      .identity { display: grid; grid-template-columns: 64px minmax(0, 1fr) 112px; align-items: start; gap: 16px; margin-top: 20px; }
      .logo { display: grid; width: 56px; height: 56px; place-items: center; border: 1px solid #cbd5e1; border-radius: 8px; background: #eff6ff; color: #1d4ed8; font-size: 18px; font-weight: 700; }
      .party { text-align: center; }
      .party strong { display: block; font-size: 16px; }
      .code { margin: 6px auto 0; padding: 4px 8px; border: 1px solid #cbd5e1; font: 12px monospace; overflow-wrap: anywhere; }
      .recipient { margin-top: 12px; }
      .recipient strong { display: block; }
      .due { color: #b45309; font-weight: 700; }
      .barcode { height: 68px; background: repeating-linear-gradient(90deg,#0f172a 0,#0f172a 2px,transparent 2px,transparent 5px,#0f172a 5px,#0f172a 7px,transparent 7px,transparent 10px); }
      h2 { margin: 22px 0 14px; padding: 12px 0; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; text-align: center; font-size: 14px; text-transform: uppercase; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 10px 12px; border: 1px solid #cbd5e1; text-align: left; }
      th { background: #f8fafc; color: #475569; font-size: 11px; text-transform: uppercase; }
      th:last-child, td:last-child { text-align: right; }
      .totals { width: 310px; max-width: 100%; margin: 18px 0 0 auto; }
      .total-row { display: flex; justify-content: space-between; gap: 24px; padding: 6px 0; border-bottom: 1px solid #e2e8f0; }
      .total-row.strong { font-weight: 700; }
      .note, .footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #cbd5e1; color: #475569; font-size: 12px; }
      .footer { display: flex; justify-content: space-between; gap: 20px; }
      @media print { .bill { border: 0; padding: 0; } }
    </style>
  </head>
  <body>
    <main class="bill">
      <h1>${value(entry.documentTitle)}</h1>
      <section class="identity">
        <div class="logo">B</div>
        <div class="party">
          <strong>${value(entry.senderName)}</strong>
          <div class="code">${value(entry.referenceCode)}</div>
          <div class="code">${value(entry.secondaryCode)}</div>
          <div class="recipient">
            <strong>${value(entry.recipientName)}</strong>
            <div>${value(entry.recipientAddress)}</div>
            <div>${value(entry.recipientPhone)}</div>
            <div class="due">Due (COD)</div>
          </div>
        </div>
        <div class="barcode" aria-label="Barcode"></div>
      </section>
      <h2>Product Details</h2>
      <table>
        <thead><tr><th>Category</th><th>Product Name</th><th>Amount</th></tr></thead>
        <tbody><tr><td>${value(entry.category)}</td><td>${value(entry.productName)}</td><td>${value(money(entry.total))}</td></tr></tbody>
      </table>
      <div class="totals">
        <div class="total-row"><span>Subtotal</span><span>${value(money(entry.total))}</span></div>
        <div class="total-row strong"><span>Total</span><span>${value(money(entry.total))}</span></div>
        <div class="total-row"><span>Total Paid</span><span>${value(money(entry.totalPaid))}</span></div>
        <div class="total-row strong"><span>Amount Due</span><span>${value(money(amountDue))}</span></div>
      </div>
      <div class="note">Note: Payment due within the agreed credit period.</div>
      <div class="footer"><span>Powered by Bikalpo.com</span><span>${value(entry.issueDate)}</span></div>
    </main>
  </body>
</html>`;
}

function printBill(entry: EditableEntry) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = iframe.contentDocument;

  if (!(frameWindow && frameDocument)) {
    iframe.remove();
    return;
  }

  let didPrint = false;
  const openPrintDialog = () => {
    if (didPrint) {
      return;
    }

    didPrint = true;
    frameWindow.focus();
    frameWindow.print();
  };
  const cleanup = () => iframe.remove();

  frameWindow.addEventListener("afterprint", cleanup, { once: true });
  iframe.addEventListener("load", openPrintDialog, { once: true });
  frameDocument.open();
  frameDocument.write(buildBillPrintHtml(entry));
  frameDocument.close();

  window.setTimeout(openPrintDialog, 400);
  window.setTimeout(cleanup, 60_000);
}

function BillPreview({ entry }: { entry: EditableEntry }) {
  const amountDue = Math.max(0, entry.total - entry.totalPaid);

  return (
    <div className="min-w-0 rounded-lg border bg-white p-3 shadow-sm sm:p-4">
      <div className="border-b pb-3 text-center text-lg font-bold text-slate-950">
        {entry.documentTitle}
      </div>
      <div className="mt-4 grid grid-cols-[56px_minmax(0,1fr)] items-start gap-3 text-sm sm:grid-cols-[72px_minmax(0,1fr)_96px]">
        <div className="flex size-12 items-center justify-center rounded-lg border bg-blue-50 text-lg font-black text-blue-700 sm:size-14">
          B
        </div>
        <div className="min-w-0 space-y-1 text-center">
          <div className="break-words font-semibold text-slate-950">
            {entry.senderName}
          </div>
          <div className="mx-auto max-w-full break-all rounded border px-2 py-1 font-mono text-xs">
            {entry.referenceCode}
          </div>
          <div className="mx-auto max-w-full break-all rounded border px-2 py-1 font-mono text-xs">
            {entry.secondaryCode}
          </div>
          <div className="pt-1 font-semibold">{entry.recipientName}</div>
          <div>{entry.recipientAddress}</div>
          <div>{entry.recipientPhone}</div>
          <div className="font-semibold text-amber-700">Due (COD)</div>
        </div>
        <div className="col-span-2 h-12 rounded border bg-[repeating-linear-gradient(90deg,#0f172a_0,#0f172a_2px,transparent_2px,transparent_5px,#0f172a_5px,#0f172a_7px,transparent_7px,transparent_10px)] sm:col-span-1 sm:h-16" />
      </div>
      <div className="my-4 border-y py-3 text-center text-sm font-bold uppercase tracking-wide text-slate-950">
        Product Details
      </div>
      <div className="rounded-lg border p-3 sm:hidden">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Category
        </div>
        <div className="mt-1 text-sm text-slate-700">{entry.category}</div>
        <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Product Name
        </div>
        <div className="mt-1 break-words text-sm font-medium text-slate-950">
          {entry.productName}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Amount
          </span>
          <span className="font-semibold tabular-nums">
            {money(entry.total)}
          </span>
        </div>
      </div>
      <div className="hidden overflow-hidden rounded-lg border sm:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Categories</th>
              <th className="px-3 py-2 font-semibold">Product Name</th>
              <th className="px-3 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-3 py-3 text-slate-700">{entry.category}</td>
              <td className="px-3 py-3 font-medium text-slate-950">
                {entry.productName}
              </td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums">
                {money(entry.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-4 ml-auto w-full space-y-2 text-sm sm:max-w-64">
        <AmountLine label="Subtotal" value={entry.total} />
        <AmountLine label="Total" strong value={entry.total} />
        <AmountLine label="Total Paid" value={entry.totalPaid} />
        <AmountLine label="Amount Due" strong value={amountDue} />
      </div>
      <div className="mt-4 border-t pt-3 text-xs text-slate-600">
        Note: Payment due within the agreed credit period.
      </div>
      <div className="mt-4 flex flex-col gap-1 border-t pt-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span>Powered by Bikalpo.com</span>
        <span>{entry.issueDate}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4 sm:flex sm:justify-end">
        <Button
          className="w-full sm:w-auto"
          onClick={() => {
            if (navigator.share) {
              void navigator.share({
                text: `${entry.documentTitle} ${entry.referenceCode}`,
                title: entry.documentTitle,
              });
            }
          }}
          type="button"
          variant="outline"
        >
          <Share2Icon />
          Share
        </Button>
        <Button
          className="w-full sm:w-auto"
          onClick={() => printBill(entry)}
          type="button"
          variant="outline"
        >
          <PrinterIcon />
          Print
        </Button>
      </div>
    </div>
  );
}

const pnlMonths = [
  "Jan 2026",
  "Feb 2026",
  "Mar 2026",
  "Apr 2026",
  "May 2026",
  "Jun 2026",
  "Jul 2026",
];

type PnlDisplayRow =
  | { kind: "section"; label: string }
  | { kind: "value"; label: string; strong?: boolean; values: number[] }
  | { kind: "spacer"; label: string };

const zeroValues = Array.from({ length: pnlMonths.length }, () => 0);

const pnlRows: PnlDisplayRow[] = [
  { kind: "section", label: "Income" },
  { kind: "value", label: "Sales", values: zeroValues },
  { kind: "value", label: "Others", values: zeroValues },
  { kind: "value", label: "Total Sales", strong: true, values: zeroValues },
  { kind: "spacer", label: "income-spacer" },
  { kind: "section", label: "Cost of Goods Sold" },
  { kind: "value", label: "Purchase", values: zeroValues },
  { kind: "value", label: "Total Purchase", strong: true, values: zeroValues },
  { kind: "value", label: "Gross Profit", strong: true, values: zeroValues },
  { kind: "spacer", label: "cogs-spacer" },
  { kind: "section", label: "Expenses" },
  { kind: "value", label: "Cost of Goods Sold", values: zeroValues },
  { kind: "value", label: "Sales Return", values: zeroValues },
  { kind: "value", label: "Other Expenses", values: zeroValues },
  { kind: "value", label: "Total Expense", strong: true, values: zeroValues },
  { kind: "spacer", label: "expense-spacer" },
  { kind: "section", label: "Net Profit" },
  { kind: "value", label: "Net Profit", strong: true, values: zeroValues },
];

function ProfitLossMatrix({ rows }: { rows: PnlDisplayRow[] }) {
  return (
    <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-semibold">
                Category
              </th>
              {pnlMonths.map((month) => (
                <th className="px-4 py-3 text-right font-semibold" key={month}>
                  {month}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              if (row.kind === "spacer") {
                return (
                  <tr key={row.label}>
                    <td
                      className="h-4 bg-slate-50/60"
                      colSpan={pnlMonths.length + 1}
                    />
                  </tr>
                );
              }

              if (row.kind === "section") {
                return (
                  <tr key={row.label}>
                    <td
                      className="bg-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-700"
                      colSpan={pnlMonths.length + 1}
                    >
                      {row.label}
                    </td>
                  </tr>
                );
              }

              return (
                <tr className="hover:bg-slate-50/80" key={row.label}>
                  <td
                    className={cn(
                      "sticky left-0 bg-white px-4 py-3 text-slate-700",
                      row.strong && "font-bold text-slate-950",
                    )}
                  >
                    {row.label}
                  </td>
                  {row.values.map((value, index) => (
                    <td
                      className={cn(
                        "px-4 py-3 text-right tabular-nums text-slate-700",
                        row.strong && "font-bold text-slate-950",
                      )}
                      key={`${row.label}-${pnlMonths[index]}`}
                    >
                      {money(value)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
