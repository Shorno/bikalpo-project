import type {
  DaybookBillEntry,
  DaybookBillPartyType,
} from "@/components/dashboard/daybook/daybook-bill-ledger";
import type { DaybookProductPurchaseEntry } from "@/components/dashboard/daybook/daybook-product-purchase-ledger";
import type { DaybookProductSaleEntry } from "@/components/dashboard/daybook/daybook-product-sale-ledger";

export type DaybookBillPayeeOption = {
  id: string;
  name: string;
  partyType: DaybookBillPartyType;
  previousBillAmount: number;
  source: "bill" | "customer" | "purchase" | "sale" | "supplier";
  subtitle: string;
};

const DEFAULT_SUPPLIERS = [
  "ABC Supplier",
  "Rahim Traders",
  "Karim Wholesale",
  "Fresh Goods Supplier",
] as const;

const DEFAULT_CUSTOMERS = [
  "XYZ Customer",
  "Rahim Store",
  "Karim Traders",
  "Walk-in Customer",
] as const;

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function optionKey(partyType: DaybookBillPartyType, name: string) {
  return `${partyType}:${normalizeName(name)}`;
}

function addPayeeOption(
  options: Map<string, DaybookBillPayeeOption>,
  input: Omit<DaybookBillPayeeOption, "id" | "previousBillAmount"> & {
    previousBillAmount?: number;
  },
) {
  const name = input.name.trim();

  if (!name) {
    return;
  }

  const key = optionKey(input.partyType, name);
  const existing = options.get(key);

  options.set(key, {
    id: key,
    name: existing?.name ?? name,
    partyType: input.partyType,
    previousBillAmount:
      (existing?.previousBillAmount ?? 0) + (input.previousBillAmount ?? 0),
    source: existing?.source ?? input.source,
    subtitle: existing?.subtitle ?? input.subtitle,
  });
}

export function buildDefaultBillPayeeOptions(
  partyType: DaybookBillPartyType,
) {
  const options = new Map<string, DaybookBillPayeeOption>();
  const names = partyType === "supplier" ? DEFAULT_SUPPLIERS : DEFAULT_CUSTOMERS;

  for (const name of names) {
    addPayeeOption(options, {
      name,
      partyType,
      source: partyType,
      subtitle: partyType === "supplier" ? "Supplier" : "Customer",
    });
  }

  return options;
}

export function buildDaybookBillPayeeOptions(input: {
  bills: DaybookBillEntry[];
  partyType: DaybookBillPartyType;
  productPurchases?: DaybookProductPurchaseEntry[];
  productSales?: DaybookProductSaleEntry[];
}) {
  const options = buildDefaultBillPayeeOptions(input.partyType);

  for (const bill of input.bills) {
    if (bill.partyType !== input.partyType) {
      continue;
    }

    addPayeeOption(options, {
      name: bill.partyName,
      partyType: bill.partyType,
      previousBillAmount: bill.total,
      source: "bill",
      subtitle: bill.partyType === "supplier" ? "Supplier" : "Customer",
    });
  }

  if (input.partyType === "supplier") {
    for (const purchase of input.productPurchases ?? []) {
      if (purchase.paymentType !== "due") {
        continue;
      }

      addPayeeOption(options, {
        name: purchase.supplier,
        partyType: "supplier",
        previousBillAmount: purchase.total,
        source: "purchase",
        subtitle: "Supplier due",
      });
    }
  }

  if (input.partyType === "customer") {
    for (const sale of input.productSales ?? []) {
      if (sale.paymentType !== "due") {
        continue;
      }

      addPayeeOption(options, {
        name: sale.customer,
        partyType: "customer",
        previousBillAmount: sale.totalSales,
        source: "sale",
        subtitle: "Customer due",
      });
    }
  }

  return Array.from(options.values());
}
