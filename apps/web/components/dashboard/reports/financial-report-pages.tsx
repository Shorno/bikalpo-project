"use client";

import type { LucideIcon } from "lucide-react";
import {
  BanknoteIcon,
  BarChart3Icon,
  CalendarIcon,
  ChevronDownIcon,
  CreditCardIcon,
  DownloadIcon,
  EyeIcon,
  FileTextIcon,
  PrinterIcon,
  ReceiptTextIcon,
  RefreshCcwIcon,
  RotateCcwIcon,
  Share2Icon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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

function mapPayableRows(rows: PayableRow[]): ReportTableRow[] {
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    values: {
      billNo: row.billNo,
      date: row.date,
      due: money(row.due),
      dueDate: row.dueDate,
      status: row.status,
      supplier: row.supplier,
      totalBill: money(row.totalBill),
    },
  }));
}

function mapReceivableRows(rows: ReceivableRow[]): ReportTableRow[] {
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    values: {
      customer: row.customer,
      date: row.date,
      due: money(row.due),
      dueDate: row.dueDate,
      invoice: money(row.invoice),
      invoiceNo: row.invoiceNo,
      status: row.status,
    },
  }));
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
  const filteredRows = useMemo(
    () =>
      payableRows.filter(
        (row) =>
          isWithinRange(row.dateIso, filters) &&
          (filters.party === "all" || row.supplier === filters.party),
      ),
    [filters],
  );
  const tableRows = mapPayableRows(filteredRows);
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
      <ReportTable columns={payableColumns} rows={tableRows} />
      <PayableBillPanel />
    </ReportShell>
  );
}

export function AccountsReceivableReportPage() {
  const { filters, updateFilter } = useReportFilters();
  const filteredRows = useMemo(
    () =>
      receivableRows.filter(
        (row) =>
          isWithinRange(row.dateIso, filters) &&
          (filters.party === "all" || row.customer === filters.party),
      ),
    [filters],
  );
  const tableRows = mapReceivableRows(filteredRows);
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
      <ReportTable columns={receivableColumns} rows={tableRows} />
      <ReceivablePaymentPanel />
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
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border bg-white text-blue-700 shadow-sm">
            <Icon className="size-5" />
          </div>
          <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-950">
            {title}
          </h1>
        </div>
        <Button
          className="h-9 w-fit border-blue-200 bg-white px-4 text-blue-700 hover:bg-blue-50"
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
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="space-y-4">
          <FieldLabel>Date Range</FieldLabel>
          <div className="grid gap-3 sm:grid-cols-[160px_200px_200px]">
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
          <div className="max-w-xs">
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
          className="h-10 bg-blue-700 px-5 hover:bg-blue-800"
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
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-start">
        <div className="space-y-4">
          <FieldLabel>Date Range</FieldLabel>
          <div className="grid gap-3 md:grid-cols-[170px_170px_200px_200px]">
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
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <Button
            className="h-10 bg-blue-700 px-5 hover:bg-blue-800"
            type="button"
          >
            <RefreshCcwIcon />
            Generate Report
          </Button>
          <Button
            className="h-10 border-slate-300 bg-white px-5"
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
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {metrics.map((metric) => (
        <div
          className="rounded-lg border bg-white p-4 shadow-sm"
          key={metric.label}
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {metric.label}
          </div>
          <div
            className={cn(
              "mt-2 text-xl font-bold tabular-nums",
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
  rows,
}: {
  columns: ReportColumn[];
  rows: ReportTableRow[];
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="overflow-x-auto">
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
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-12 text-center text-sm text-slate-500"
                  colSpan={columns.length}
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
                      {column.key === "status" && row.status ? (
                        <StatusPill status={row.status} />
                      ) : (
                        row.values[column.key]
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
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

function PayableBillPanel() {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
      <PaymentForm
        accountLine="Laber bill"
        accountLineDescription="Laber bill"
        amount={25000}
        date="2026-04-27"
        idNo="BILL-100245"
        partyLabel="Payee Name"
        partyName="ABC Distributor"
        primaryAction="Payment"
        title="Bill"
      />
      <BillPreview
        amountDue={25000}
        category="Laber Bill"
        documentTitle="BIKALPO Bill"
        issueDate="15 Apr 2026 10:30 AM"
        productName="Laber (Daylaber)"
        recipientAddress="Mirpur-10, Dhaka"
        recipientName="Rahim Store"
        recipientPhone="017XXXXXXXX"
        referenceCode="AK990065782132"
        secondaryCode="ORD-20260415-1001"
        senderName="Noor Distribution Hub (SHP-100245)"
        total={25000}
        totalPaid={0}
      />
    </section>
  );
}

function ReceivablePaymentPanel() {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
      <PaymentForm
        accountLine="Sales collection"
        accountLineDescription="Partial invoice collection"
        amount={15000}
        date="2026-07-27"
        idNo="INV-100245"
        partyLabel="Customer Name"
        partyName="Noor Store"
        primaryAction="Receive"
        title="Invoice Payment"
      />
      <BillPreview
        amountDue={15000}
        category="Product Sales"
        documentTitle="BIKALPO Invoice"
        issueDate="17 Jul 2026 04:15 PM"
        productName="Retail product order"
        recipientAddress="Mirpur-10, Dhaka"
        recipientName="Noor Store"
        recipientPhone="017XXXXXXXX"
        referenceCode="INV-100245"
        secondaryCode="SALE-20260717-1001"
        senderName="Bikalpo Shop (SHP-100245)"
        total={25000}
        totalPaid={10000}
      />
    </section>
  );
}

function PaymentForm({
  accountLine,
  accountLineDescription,
  amount,
  date,
  idNo,
  partyLabel,
  partyName,
  primaryAction,
  title,
}: {
  accountLine: string;
  accountLineDescription: string;
  amount: number;
  date: string;
  idNo: string;
  partyLabel: string;
  partyName: string;
  primaryAction: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <InputField label={`${partyLabel}*`} value={partyName} />
        <InputField label="ID No" value={idNo} />
        <InputField label="Date" type="date" value={date} />
        <InputField label="Amount" value={money(amount)} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <InputField label="Reference No" value="REF-001" />
        <SelectField label="Payment Method" value="Bank" />
        <SelectField label="Account*" value="Bank" />
      </div>
      <div className="mt-5 overflow-hidden rounded-lg border">
        <table className="w-full min-w-[540px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Account Name*</th>
              <th className="px-4 py-3 font-semibold">Description</th>
              <th className="px-4 py-3 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-3 font-semibold text-slate-950">
                {accountLine}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {accountLineDescription}
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                {money(amount)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Attachment
            </Label>
            <div className="mt-2 h-20 rounded-lg border border-dashed bg-slate-50" />
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Note
            </Label>
            <Textarea className="mt-2 min-h-28 resize-none bg-white" />
          </div>
        </div>
        <div className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
          <AmountLine label="Amount" value={amount} />
          <AmountLine label="Total" strong value={amount} />
          <AmountLine label="Outstanding" value={amount} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline">
          <CreditCardIcon />
          Write Off
        </Button>
        <Button type="button" variant="outline">
          <EyeIcon />
          View
        </Button>
        <Button className="bg-blue-700 hover:bg-blue-800" type="button">
          <BanknoteIcon />
          {primaryAction}
        </Button>
      </div>
    </div>
  );
}

function InputField({
  label,
  type = "text",
  value,
}: {
  label: string;
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
        readOnly
        type={type}
        value={value}
      />
    </div>
  );
}

function SelectField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </Label>
      <Select defaultValue={value.toLowerCase()}>
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

function BillPreview({
  amountDue,
  category,
  documentTitle,
  issueDate,
  productName,
  recipientAddress,
  recipientName,
  recipientPhone,
  referenceCode,
  secondaryCode,
  senderName,
  total,
  totalPaid,
}: {
  amountDue: number;
  category: string;
  documentTitle: string;
  issueDate: string;
  productName: string;
  recipientAddress: string;
  recipientName: string;
  recipientPhone: string;
  referenceCode: string;
  secondaryCode: string;
  senderName: string;
  total: number;
  totalPaid: number;
}) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="border-b pb-3 text-center text-lg font-bold text-slate-950">
        {documentTitle}
      </div>
      <div className="mt-4 grid grid-cols-[72px_1fr_96px] items-start gap-3 text-sm">
        <div className="flex size-14 items-center justify-center rounded-lg border bg-blue-50 text-lg font-black text-blue-700">
          B
        </div>
        <div className="space-y-1 text-center">
          <div className="font-semibold text-slate-950">{senderName}</div>
          <div className="mx-auto w-fit rounded border px-2 py-1 font-mono text-xs">
            {referenceCode}
          </div>
          <div className="mx-auto w-fit rounded border px-2 py-1 font-mono text-xs">
            {secondaryCode}
          </div>
          <div className="pt-1 font-semibold">{recipientName}</div>
          <div>{recipientAddress}</div>
          <div>{recipientPhone}</div>
          <div className="font-semibold text-amber-700">Due (COD)</div>
        </div>
        <div className="h-16 rounded border bg-[repeating-linear-gradient(90deg,#0f172a_0,#0f172a_2px,transparent_2px,transparent_5px,#0f172a_5px,#0f172a_7px,transparent_7px,transparent_10px)]" />
      </div>
      <div className="my-4 border-y py-3 text-center text-sm font-bold uppercase tracking-wide text-slate-950">
        Product Details
      </div>
      <div className="overflow-hidden rounded-lg border">
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
              <td className="px-3 py-3 text-slate-700">{category}</td>
              <td className="px-3 py-3 font-medium text-slate-950">
                {productName}
              </td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums">
                {money(total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-4 ml-auto max-w-64 space-y-2 text-sm">
        <AmountLine label="Subtotal" value={total} />
        <AmountLine label="Total" strong value={total} />
        <AmountLine label="Total Paid" value={totalPaid} />
        <AmountLine label="Amount Due" strong value={amountDue} />
      </div>
      <div className="mt-4 border-t pt-3 text-xs text-slate-600">
        Note: Payment due within the agreed credit period.
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3 text-xs text-slate-500">
        <span>Powered by Bikalpo.com</span>
        <span>{issueDate}</span>
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t pt-4">
        <Button
          onClick={() => {
            if (navigator.share) {
              void navigator.share({
                text: `${documentTitle} ${referenceCode}`,
                title: documentTitle,
              });
            }
          }}
          type="button"
          variant="outline"
        >
          <Share2Icon />
          Share
        </Button>
        <Button onClick={() => window.print()} type="button" variant="outline">
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
