import InvoiceList from "@/components/features/invoices/invoice-list";

export default function InvoicesPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Invoices</h1>
        <p className="text-muted-foreground mt-1">
          Manage invoices, track payments, and handle deliveries
        </p>
      </div>

      <InvoiceList />
    </div>
  );
}
