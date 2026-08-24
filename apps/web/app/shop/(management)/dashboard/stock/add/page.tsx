"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileUp, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useConfirmManualPurchase,
  useManualPurchasePaymentAccounts,
  useManualPurchaseSuppliers,
  useSaveManualPurchaseDraft,
  useShopProductsForStock,
} from "@/hooks/use-shop-owner-api";
import { fileToDataUrl } from "@/lib/cloudinary";
import { client } from "@/utils/orpc";

type StockProduct = {
  id: number;
  name: string;
  variants: Array<{
    brandName: string | null;
    currentStock: number;
    inventoryId: number;
    operationalUnit: string;
    retailPrice: string | null;
    unitLabel: string;
    variantId: number;
  }>;
};

type PurchaseRow = {
  batchNo: string;
  exchangeQty: string;
  expiryDate: string;
  id: string;
  inventoryId: string;
  quantity: string;
  unitCost: string;
};

const dateValue = () => new Date().toISOString().slice(0, 10);
const createRow = (): PurchaseRow => ({
  batchNo: "",
  exchangeQty: "0",
  expiryDate: "",
  id: crypto.randomUUID(),
  inventoryId: "",
  quantity: "",
  unitCost: "",
});
const toAmount = (value: string) => {
  const parsed = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};
const money = (value: number) =>
  `Tk${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

export default function AddStockPage() {
  const router = useRouter();
  const attachmentInput = useRef<HTMLInputElement>(null);
  const [productSearch, setProductSearch] = useState("");
  const { data: productData, isLoading: productsLoading } = useShopProductsForStock(productSearch);
  const { data: supplierData } = useManualPurchaseSuppliers();
  const { data: accountData } = useManualPurchasePaymentAccounts();
  const saveDraft = useSaveManualPurchaseDraft();
  const confirmPurchase = useConfirmManualPurchase();
  const products = ((productData as { products?: StockProduct[] } | undefined)?.products ?? []) as StockProduct[];
  const suppliers = supplierData ?? [];
  const paymentAccounts = accountData?.paymentAccounts ?? [];
  const variants = useMemo(
    () => products.flatMap((product) => product.variants.map((variant) => ({ ...variant, productName: product.name }))),
    [products],
  );
  const variantsByInventory = useMemo(
    () => new Map(variants.map((variant) => [String(variant.inventoryId), variant])),
    [variants],
  );

  const [supplierId, setSupplierId] = useState("");
  const [billNo, setBillNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(dateValue);
  const [entryMode, setEntryMode] = useState<"exchange" | "new">("new");
  const [paymentMethod, setPaymentMethod] = useState<"bank" | "cash">("cash");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [paidAmount, setPaidAmount] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [vatAmount, setVatAmount] = useState("0");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<PurchaseRow[]>([createRow()]);
  const [attachment, setAttachment] = useState<{ name: string; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [idempotencyKey] = useState(() => `manual-purchase-${crypto.randomUUID()}`);

  const subtotal = useMemo(
    () => rows.reduce((sum, row) => sum + toAmount(row.quantity) * toAmount(row.unitCost), 0),
    [rows],
  );
  const total = Math.max(0, subtotal - toAmount(discount) + toAmount(vatAmount));
  const paid = Math.min(total, Math.max(0, toAmount(paidAmount)));
  const due = Math.max(0, total - paid);
  const pending = saveDraft.isPending || confirmPurchase.isPending || uploading;

  const updateRow = (id: string, field: keyof PurchaseRow, value: string) => {
    setRows((current) => current.map((row) => {
      if (row.id !== id) return row;
      if (field !== "inventoryId") return { ...row, [field]: value };
      return { ...row, inventoryId: value, unitCost: row.unitCost || variantsByInventory.get(value)?.retailPrice || "" };
    }));
  };

  const buildInput = () => {
    const items = rows.filter((row) => row.inventoryId && toAmount(row.quantity) > 0).map((row) => ({
      batchNo: row.batchNo || null,
      exchangeQty: entryMode === "exchange" ? toAmount(row.exchangeQty) : 0,
      expiryDate: row.expiryDate || null,
      inventoryId: Number(row.inventoryId),
      quantity: toAmount(row.quantity),
      unitCost: toAmount(row.unitCost),
    }));
    if (!supplierId) throw new Error("Select a supplier");
    if (items.length === 0) throw new Error("Add at least one product row");
    if (paid > 0 && !paymentAccountId) throw new Error("Select a payment account");
    return {
      attachmentName: attachment?.name ?? null,
      attachmentUrl: attachment?.url ?? null,
      discount: toAmount(discount),
      entryMode,
      idempotencyKey,
      items,
      note: note.trim() || null,
      paidAmount: paid,
      paymentAccountId: paid > 0 ? Number(paymentAccountId) : null,
      paymentMethod: paid > 0 ? paymentMethod : null,
      purchaseDate,
      supplierId: Number(supplierId),
      supplierInvoiceNo: billNo.trim() || null,
      vatAmount: toAmount(vatAmount),
    };
  };

  const submit = async (mode: "confirm" | "draft") => {
    try {
      const result = mode === "draft"
        ? await saveDraft.mutateAsync(buildInput())
        : await confirmPurchase.mutateAsync(buildInput());
      if (result.verificationStatus === "on_hold") {
        toast.error(result.purchase.verificationMessage || "Manual purchase is on hold");
        return;
      }
      toast.success(mode === "draft"
        ? `${result.purchase.purchaseNumber} saved as a verified draft`
        : `${result.purchase.purchaseNumber} confirmed and stock added`);
      if (mode === "confirm") router.push("/dashboard/stock");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Manual purchase failed");
    }
  };

  const uploadAttachment = async (file?: File) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return toast.error("Attachment must be 20 MB or smaller");
    setUploading(true);
    try {
      const result = await client.cloudinary.upload({ file: await fileToDataUrl(file), folder: "manual-purchases" });
      if (!result.success) throw new Error("Attachment upload failed");
      setAttachment({ name: file.name, url: result.url });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Attachment upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild size="icon" variant="ghost"><Link aria-label="Back to stock" href="/dashboard/stock"><ArrowLeft /></Link></Button>
            <div className="min-w-0"><h1 className="truncate text-xl font-bold">Manual Purchase / Add Stock</h1><p className="text-sm text-muted-foreground">One connected inventory, payment, and accounting transaction</p></div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Button asChild variant="outline"><Link href="/dashboard/stock">Cancel</Link></Button>
            <Button disabled={pending} onClick={() => void submit("draft")} variant="outline"><Save /> Save Draft</Button>
            <Button disabled={pending} onClick={() => void submit("confirm")}>{pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Confirm & Add Stock</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 sm:px-6">
        <section className="grid gap-4 border-b pb-6 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Payee Name *"><Select onValueChange={setSupplierId} value={supplierId}><SelectTrigger className="w-full"><SelectValue placeholder="Select supplier" /></SelectTrigger><SelectContent>{suppliers.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}{item.company ? ` - ${item.company}` : ""}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="ID / Bill No"><Input onChange={(event) => setBillNo(event.target.value)} placeholder="BILL-100245" value={billNo} /></Field>
          <Field label="Date *"><Input onChange={(event) => setPurchaseDate(event.target.value)} type="date" value={purchaseDate} /></Field>
          <div className="rounded-md border bg-muted/30 p-3 text-right"><p className="text-xs font-semibold uppercase text-muted-foreground">Amount</p><p className="mt-1 text-2xl font-bold tabular-nums">{money(total)}</p></div>
          <Field label="Payment Method"><Select onValueChange={(value) => setPaymentMethod(value as "bank" | "cash")} value={paymentMethod}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></Field>
          <Field label={`Account ${paid > 0 ? "*" : ""}`}><Select onValueChange={setPaymentAccountId} value={paymentAccountId}><SelectTrigger className="w-full"><SelectValue placeholder="Select cash / bank" /></SelectTrigger><SelectContent>{paymentAccounts.filter((item) => item.type === paymentMethod).map((item) => <SelectItem key={item.id} value={item.id}>{item.name} ({money(item.balance)})</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Total Paid"><Input inputMode="decimal" onChange={(event) => setPaidAmount(event.target.value)} value={paidAmount} /></Field>
          <Field label="Entry Mode"><div className="grid grid-cols-2 overflow-hidden rounded-md border">{(["new", "exchange"] as const).map((mode) => <button className={`h-10 text-sm font-medium capitalize ${entryMode === mode ? "bg-primary text-primary-foreground" : "bg-background"}`} key={mode} onClick={() => setEntryMode(mode)} type="button">{mode}</button>)}</div></Field>
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-base font-semibold">Item Entry</h2><p className="text-sm text-muted-foreground">Every row creates a variant-level inventory movement.</p></div><Input className="w-full sm:max-w-sm" onChange={(event) => setProductSearch(event.target.value)} placeholder="Search products or brands" value={productSearch} /></div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[1050px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-3">SKU / Product *</th><th className="px-3 py-3">Brand</th><th className="px-3 py-3">Size</th><th className="px-3 py-3">Qty *</th>{entryMode === "exchange" && <th className="px-3 py-3">Exchange</th>}<th className="px-3 py-3">Price *</th><th className="px-3 py-3">Batch</th><th className="px-3 py-3">Expiry</th><th /></tr></thead>
              <tbody>{rows.map((row) => {
                const selected = variantsByInventory.get(row.inventoryId);
                return <tr className="border-t" key={row.id}>
                  <td className="min-w-72 px-3 py-2"><Select onValueChange={(value) => updateRow(row.id, "inventoryId", value)} value={row.inventoryId}><SelectTrigger className="w-full"><SelectValue placeholder={productsLoading ? "Loading..." : "Select product variant"} /></SelectTrigger><SelectContent>{variants.map((item) => <SelectItem key={item.inventoryId} value={String(item.inventoryId)}>{item.productName} - {item.unitLabel} - Stock {item.currentStock}</SelectItem>)}</SelectContent></Select></td>
                  <td className="px-3 py-2">{selected?.brandName || "-"}</td><td className="px-3 py-2">{selected?.unitLabel || "-"}</td>
                  <td className="px-3 py-2"><Input className="w-24" inputMode="decimal" onChange={(event) => updateRow(row.id, "quantity", event.target.value)} value={row.quantity} /></td>
                  {entryMode === "exchange" && <td className="px-3 py-2"><Input className="w-24" inputMode="decimal" onChange={(event) => updateRow(row.id, "exchangeQty", event.target.value)} value={row.exchangeQty} /></td>}
                  <td className="px-3 py-2"><Input className="w-28" inputMode="decimal" onChange={(event) => updateRow(row.id, "unitCost", event.target.value)} value={row.unitCost} /></td>
                  <td className="px-3 py-2"><Input className="w-32" onChange={(event) => updateRow(row.id, "batchNo", event.target.value)} value={row.batchNo} /></td>
                  <td className="px-3 py-2"><Input className="w-36" onChange={(event) => updateRow(row.id, "expiryDate", event.target.value)} type="date" value={row.expiryDate} /></td>
                  <td className="px-3 py-2"><Button aria-label="Remove row" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} size="icon" variant="ghost"><Trash2 /></Button></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <div className="flex gap-2"><Button onClick={() => setRows((current) => [...current, createRow()])} variant="outline"><Plus /> Add Row</Button><Button onClick={() => setRows([createRow()])} variant="outline"><Trash2 /> Clear All</Button></div>
        </section>

        <section className="grid gap-6 border-y py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Attachment"><input accept="image/*,.pdf" className="hidden" onChange={(event) => void uploadAttachment(event.target.files?.[0])} ref={attachmentInput} type="file" /><button className="flex min-h-28 w-full flex-col items-center justify-center rounded-md border border-dashed text-sm" onClick={() => attachmentInput.current?.click()} type="button">{uploading ? <Loader2 className="mb-2 animate-spin" /> : <FileUp className="mb-2" />}<span className="font-medium">{attachment?.name || "Add attachment"}</span><span className="text-xs text-muted-foreground">Max file size: 20 MB</span></button></Field>
            <Field label="Note"><Textarea className="min-h-28" onChange={(event) => setNote(event.target.value)} value={note} /></Field>
          </div>
          <div className="space-y-3 rounded-md bg-muted/30 p-4 text-sm">
            <Total label="Subtotal" value={money(subtotal)} /><div className="flex items-center justify-between gap-4"><Label>Discount</Label><Input className="w-32 text-right" inputMode="decimal" onChange={(event) => setDiscount(event.target.value)} value={discount} /></div><div className="flex items-center justify-between gap-4"><Label>VAT / Tax</Label><Input className="w-32 text-right" inputMode="decimal" onChange={(event) => setVatAmount(event.target.value)} value={vatAmount} /></div>
            <div className="border-t pt-3"><Total bold label="Amount" value={money(total)} /></div><Total label="Total Paid" value={money(paid)} /><Total bold className={due > 0 ? "text-amber-700" : "text-emerald-700"} label="Amount Due" value={money(due)} />
          </div>
        </section>
        <div className="flex flex-col gap-2 pb-8 sm:hidden"><Button disabled={pending} onClick={() => void submit("confirm")}><CheckCircle2 /> Confirm & Add Stock</Button><Button disabled={pending} onClick={() => void submit("draft")} variant="outline"><Save /> Save Draft</Button><Button asChild variant="ghost"><Link href="/dashboard/stock"><X /> Cancel</Link></Button></div>
      </main>
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function Total({ bold, className = "", label, value }: { bold?: boolean; className?: string; label: string; value: string }) {
  return <div className={`flex justify-between ${bold ? "text-base font-bold" : ""} ${className}`}><span>{label}</span><span className="tabular-nums">{value}</span></div>;
}
