import { db } from "@bikalpo-project/db";
import type {
  AccountingAccountType,
  AccountingOwnerType,
  BalanceSheetLine,
  ProfitAndLossLine,
} from "@bikalpo-project/db/accounting";
import {
  ensureDefaultFinanceAccounts,
  ensureDefaultFinancePaymentAccounts,
} from "@bikalpo-project/db/accounting-seed";
import {
  expense,
  expenseCategory,
  financeAccount,
  financeCategory,
  financePaymentAccount,
  financialLedger,
  supplier,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { localDateStamp } from "../utils/date";

const UI_ACCOUNT_TYPES = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "INCOME",
  "EXPENSE",
] as const;

type UIAccountType = (typeof UI_ACCOUNT_TYPES)[number];

const PAYMENT_METHODS = ["cash", "bank"] as const;
const PRODUCT_PURCHASE_PAYMENT_TYPES = ["cash", "due"] as const;
const PRODUCT_SALE_PAYMENT_TYPES = ["cash", "due"] as const;

type ResolvedFixedAssetAccount = {
  currentBalance: number;
  id: number;
  name: string;
};

type FixedAssetPurchaseLine = {
  account: ResolvedFixedAssetAccount;
  accountId: number | null;
  accountName: string;
  price: number;
  productName: string;
};

type ResolvedLoanAccount = {
  currentBalance: number;
  id: number;
  name: string;
};

type LoanReceivedLine = {
  account: ResolvedLoanAccount;
  amount: number;
  description: string;
  loanType: string;
};

type ResolvedPayableAccount = {
  currentBalance: number;
  id: number;
  name: string;
};

type ResolvedSupplierAdvanceAccount = {
  currentBalance: number;
  id: number;
  name: string;
};

type ResolvedCustomerAdvanceAccount = {
  currentBalance: number;
  id: number;
  name: string;
};

type ResolvedInventoryAccount = {
  currentBalance: number;
  id: number;
  name: string;
};

type ResolvedReceivableAccount = {
  currentBalance: number;
  id: number;
  name: string;
};

type ProductSaleItem = {
  description: string;
  productCost: number;
  productName: string;
  saleAmount: number;
};

function resolveOwnerScope(role?: string | null): AccountingOwnerType {
  return role === "warehouse" ? "warehouse" : "shop";
}

function toUiAccountType(accountType: AccountingAccountType): UIAccountType {
  if (accountType === "asset") return "ASSET";
  if (accountType === "liability") return "LIABILITY";
  if (accountType === "equity") return "EQUITY";
  if (accountType === "income") return "INCOME";
  return "EXPENSE";
}

function toDbAccountType(accountType: UIAccountType): AccountingAccountType {
  if (accountType === "ASSET") return "asset";
  if (accountType === "LIABILITY") return "liability";
  if (accountType === "EQUITY") return "equity";
  if (accountType === "INCOME") return "income";
  return "expense";
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseMoney(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function toMoney(value: number) {
  return value.toFixed(2);
}

function assertSufficientPaymentBalance(input: {
  accountName: string;
  balanceBefore: number;
  total: number;
}) {
  if (input.balanceBefore - input.total >= 0) {
    return;
  }

  throw new ORPCError("BAD_REQUEST", {
    message: `Insufficient ${input.accountName} balance. Available Tk${input.balanceBefore.toLocaleString(
      "en-US",
      {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      },
    )}, transaction Tk${input.total.toLocaleString("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}.`,
  });
}

async function ensurePaymentAccountsReady(input: {
  ownerId: string;
  ownerType: AccountingOwnerType;
}) {
  await ensureDefaultFinancePaymentAccounts(input);
  await ensureOwnerCashBankPaymentAccounts(input);
}

function normalizePaymentAccountLookup(value: string | number) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

async function resolvePaymentAccountId(input: {
  ownerId: string;
  ownerType: AccountingOwnerType;
  paymentAccountId: string | number;
}) {
  const numericId = Number(input.paymentAccountId);

  if (Number.isFinite(numericId) && numericId > 0) {
    return numericId;
  }

  const lookup = normalizePaymentAccountLookup(input.paymentAccountId);
  const accounts = await db.query.financePaymentAccount.findMany({
    where: (table, { and: andFn, eq: eqFn }) =>
      andFn(
        eqFn(table.ownerId, input.ownerId),
        eqFn(table.ownerType, input.ownerType),
      ),
  });

  const matchingAccount = accounts.find((account) => {
    const accountName = normalizePaymentAccountLookup(account.name);

    return (
      accountName === lookup ||
      (lookup === "cash on hand" && account.type === "cash") ||
      (lookup === "cash" && account.type === "cash") ||
      (lookup === "bank account" && account.type === "bank") ||
      (lookup === "bank" && account.type === "bank")
    );
  });

  if (!matchingAccount) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Select a valid payment account",
    });
  }

  return matchingAccount.id;
}

async function resolveLedgerBalanceTargets(input: {
  description?: string | null;
  ownerId: string;
  ownerType: AccountingOwnerType;
  referenceId: number;
  referenceType: string;
}) {
  const [paymentAccounts, referencedAccount] = await Promise.all([
    db.query.financePaymentAccount.findMany({
      where: (table, { and: andFn, eq: eqFn }) =>
        andFn(
          eqFn(table.ownerId, input.ownerId),
          eqFn(table.ownerType, input.ownerType),
        ),
    }),
    input.referenceType === "adjustment"
      ? db.query.financeAccount.findFirst({
          where: (table, { and: andFn, eq: eqFn }) =>
            andFn(
              eqFn(table.id, input.referenceId),
              eqFn(table.ownerId, input.ownerId),
              eqFn(table.ownerType, input.ownerType),
            ),
        })
      : Promise.resolve(null),
  ]);
  const paymentTargets = new Map<number, (typeof paymentAccounts)[number]>();
  const referencedPayment = paymentAccounts.find(
    (account) => account.id === input.referenceId,
  );

  if (referencedPayment) {
    paymentTargets.set(referencedPayment.id, referencedPayment);
  }

  const namedPaymentAccount = extractLedgerAccountName(input.description);
  if (namedPaymentAccount) {
    const normalizedName = normalizePaymentAccountLookup(namedPaymentAccount);
    const matchingPayment = paymentAccounts.find(
      (account) =>
        normalizePaymentAccountLookup(account.name) === normalizedName,
    );

    if (matchingPayment) {
      paymentTargets.set(matchingPayment.id, matchingPayment);
    }
  }

  return {
    financeTargets:
      referencedAccount && !referencedAccount.isPaymentAccount
        ? [referencedAccount]
        : [],
    paymentTargets: Array.from(paymentTargets.values()),
  };
}

function signedLedgerAmount(input: {
  accountType?: AccountingAccountType;
  amount: number;
  direction: "credit" | "debit";
  isPaymentAccount?: boolean;
}) {
  if (input.isPaymentAccount) {
    return input.direction === "credit" ? input.amount : -input.amount;
  }

  const normalBalance =
    input.accountType === "liability" ||
    input.accountType === "equity" ||
    input.accountType === "income"
      ? "credit"
      : "debit";

  return input.direction === normalBalance ? input.amount : -input.amount;
}

function extractLedgerAccountName(description: string | null | undefined) {
  const match = description?.match(
    /(?:Payment account|Deposit account):\s*([^|]+)/i,
  );

  return match?.[1]?.trim() ?? null;
}

function formatLedgerEntryType(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ledgerDateValue(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(value.getDate()).padStart(2, "0")}`;
}

function resolveAccountReportLines(input: {
  accountType: AccountingAccountType;
  categoryCode: string;
  categoryName: string;
}): {
  balanceSheetLine: BalanceSheetLine | null;
  profitAndLossLine: ProfitAndLossLine | null;
} {
  if (
    input.accountType === "asset" &&
    (input.categoryCode === "asset-cash-bank" ||
      input.categoryName.toLowerCase() === "cash and bank")
  ) {
    return {
      balanceSheetLine: "cash_and_bank",
      profitAndLossLine: null,
    };
  }

  if (
    input.accountType === "asset" &&
    (input.categoryCode === "asset-fixed" ||
      input.categoryName.toLowerCase() === "fixed assets")
  ) {
    return {
      balanceSheetLine: "fixed_assets",
      profitAndLossLine: null,
    };
  }

  if (
    input.accountType === "asset" &&
    (input.categoryCode === "asset-supplier-advance" ||
      input.categoryName.toLowerCase() === "supplier advance")
  ) {
    return {
      balanceSheetLine: "supplier_advance",
      profitAndLossLine: null,
    };
  }

  if (
    input.accountType === "liability" &&
    (input.categoryCode === "liability-customer-advance" ||
      input.categoryName.toLowerCase() === "customer advance")
  ) {
    return {
      balanceSheetLine: "customer_advance",
      profitAndLossLine: null,
    };
  }

  if (
    input.accountType === "liability" &&
    (input.categoryCode === "liability-loan-payable" ||
      input.categoryName.toLowerCase() === "loan payable")
  ) {
    return {
      balanceSheetLine: "loan_payable",
      profitAndLossLine: null,
    };
  }

  if (
    input.accountType === "liability" &&
    (input.categoryCode === "liability-accounts-payable" ||
      input.categoryName.toLowerCase() === "accounts payable")
  ) {
    return {
      balanceSheetLine: "accounts_payable",
      profitAndLossLine: null,
    };
  }

  return {
    balanceSheetLine: null,
    profitAndLossLine: null,
  };
}

function scopeWhere<TTable extends { ownerId: any; ownerType: any }>(
  table: TTable,
  ownerId: string,
  ownerType: AccountingOwnerType,
) {
  return or(
    and(isNull(table.ownerId), isNull(table.ownerType)),
    and(eq(table.ownerId, ownerId), eq(table.ownerType, ownerType)),
  );
}

async function generateUniqueCode(
  table: typeof financeCategory | typeof financeAccount,
  ownerId: string,
  ownerType: AccountingOwnerType,
  baseCode: string,
) {
  let code = baseCode;
  let counter = 2;

  while (true) {
    const existing = await db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.code, code), scopeWhere(table, ownerId, ownerType)))
      .limit(1);

    if (existing.length === 0) {
      return code;
    }

    code = `${baseCode}-${counter}`;
    counter += 1;
  }
}

async function generateUniquePaymentAccountCode(
  ownerId: string,
  ownerType: AccountingOwnerType,
  baseCode: string,
) {
  let code = baseCode;
  let counter = 2;

  while (true) {
    const existing = await db
      .select({ id: financePaymentAccount.id })
      .from(financePaymentAccount)
      .where(
        and(
          eq(financePaymentAccount.code, code),
          eq(financePaymentAccount.ownerId, ownerId),
          eq(financePaymentAccount.ownerType, ownerType),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      return code;
    }

    code = `${baseCode}-${counter}`;
    counter += 1;
  }
}

function isCashAndBankCategory(input: {
  accountType: AccountingAccountType;
  code: string;
  name: string;
}) {
  return (
    input.accountType === "asset" &&
    (input.code === "asset-cash-bank" ||
      input.name.trim().toLowerCase() === "cash and bank")
  );
}

function resolveCashBankPaymentAccountType(name: string) {
  const normalizedName = name.toLowerCase();

  if (normalizedName.includes("cash") || normalizedName.includes("hand")) {
    return "cash";
  }

  return "bank";
}

async function ensureCashBankPaymentAccountForFinanceAccount(input: {
  accountCode: string;
  accountId: number;
  accountName: string;
  currentBalance: number | string;
  openingBalance: number | string;
  ownerId: string;
  ownerType: AccountingOwnerType;
}) {
  const existing = await db.query.financePaymentAccount.findFirst({
    where: (table, { and: andFn, eq: eqFn }) =>
      andFn(
        eqFn(table.financeAccountId, input.accountId),
        eqFn(table.ownerId, input.ownerId),
        eqFn(table.ownerType, input.ownerType),
      ),
  });

  if (existing) {
    return existing.id;
  }

  const code = await generateUniquePaymentAccountCode(
    input.ownerId,
    input.ownerType,
    input.accountCode || `payment-${slugify(input.accountName) || "account"}`,
  );
  const openingBalance = toMoney(parseMoney(input.openingBalance));
  const currentBalance = toMoney(parseMoney(input.currentBalance));
  const [created] = await db
    .insert(financePaymentAccount)
    .values({
      code,
      currentBalance,
      financeAccountId: input.accountId,
      isActive: true,
      isDefault: false,
      name: input.accountName,
      openingBalance,
      ownerId: input.ownerId,
      ownerType: input.ownerType,
      type: resolveCashBankPaymentAccountType(input.accountName),
    })
    .returning({ id: financePaymentAccount.id });

  if (!created) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Failed to create payment account",
    });
  }

  await db
    .update(financeAccount)
    .set({
      balanceSheetLine: "cash_and_bank",
      isPaymentAccount: true,
      updatedAt: new Date(),
    })
    .where(eq(financeAccount.id, input.accountId));

  return created.id;
}

async function ensureOwnerCashBankPaymentAccounts(input: {
  ownerId: string;
  ownerType: AccountingOwnerType;
}) {
  const cashBankCategories = await db.query.financeCategory.findMany({
    where: (table, { and: andFn, eq: eqFn, isNull: isNullFn, or: orFn }) =>
      andFn(
        eqFn(table.accountType, "asset"),
        orFn(
          eqFn(table.code, "asset-cash-bank"),
          sql`lower(${table.name}) = 'cash and bank'`,
        ),
        orFn(
          andFn(isNullFn(table.ownerId), isNullFn(table.ownerType)),
          andFn(
            eqFn(table.ownerId, input.ownerId),
            eqFn(table.ownerType, input.ownerType),
          ),
        ),
      ),
  });

  if (cashBankCategories.length === 0) {
    return;
  }

  const categoryIds = cashBankCategories.map((category) => category.id);
  const accounts = await db
    .select({
      code: financeAccount.code,
      currentBalance: financeAccount.currentBalance,
      id: financeAccount.id,
      name: financeAccount.name,
      openingBalance: financeAccount.openingBalance,
    })
    .from(financeAccount)
    .where(
      and(
        eq(financeAccount.accountType, "asset"),
        eq(financeAccount.ownerId, input.ownerId),
        eq(financeAccount.ownerType, input.ownerType),
        or(
          eq(financeAccount.balanceSheetLine, "cash_and_bank"),
          inArray(financeAccount.categoryId, categoryIds),
        ),
      ),
    );

  for (const account of accounts) {
    await ensureCashBankPaymentAccountForFinanceAccount({
      accountCode: account.code,
      accountId: account.id,
      accountName: account.name,
      currentBalance: account.currentBalance,
      openingBalance: account.openingBalance,
      ownerId: input.ownerId,
      ownerType: input.ownerType,
    });
  }
}

async function getNextExpenseNumberPrefix(ownerId: string) {
  const prefix = `EXP-${localDateStamp()}-`;
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(expense)
    .where(
      and(
        eq(expense.ownerId, ownerId),
        ilike(expense.expenseNumber, `${prefix}%`),
      ),
    );

  return {
    nextSequence: (result?.count ?? 0) + 1,
    prefix,
  };
}

function buildExpenseNumber(prefix: string, sequence: number) {
  return `${prefix}${String(sequence).padStart(3, "0")}`;
}

function buildProductSaleItems(
  items: Array<{
    description?: string | null;
    productCost: string | number;
    productName: string;
    saleAmount: string | number;
  }>,
): ProductSaleItem[] {
  return items
    .map((item) => ({
      description: item.description?.trim() || "Product Sold",
      productCost: Math.max(0, parseMoney(item.productCost)),
      productName: item.productName.trim(),
      saleAmount: parseMoney(item.saleAmount),
    }))
    .filter((item) => item.saleAmount > 0 && item.productName.length > 0);
}

async function resolveExpenseCategoryId(ownerId: string, name: string) {
  const categoryName = name.trim();
  const slug = slugify(categoryName) || "miscellaneous-expenses";

  const existing = await db.query.expenseCategory.findFirst({
    where: (table, { and: andFn, eq: eqFn, isNull: isNullFn, or: orFn }) =>
      andFn(
        eqFn(table.slug, slug),
        orFn(
          eqFn(table.isSystem, true),
          isNullFn(table.ownerId),
          eqFn(table.ownerId, ownerId),
        ),
      ),
  });

  if (existing) {
    return existing.id;
  }

  const [created] = await db
    .insert(expenseCategory)
    .values({
      isSystem: false,
      name: categoryName,
      ownerId,
      slug,
    })
    .returning({ id: expenseCategory.id });

  if (!created) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Failed to create expense category",
    });
  }

  return created.id;
}

async function resolveFixedAssetCategoryId() {
  await ensureDefaultFinanceAccounts();

  const category = await db.query.financeCategory.findFirst({
    where: (table, { and: andFn, eq: eqFn, isNull: isNullFn }) =>
      andFn(
        eqFn(table.code, "asset-fixed"),
        isNullFn(table.ownerId),
        isNullFn(table.ownerType),
      ),
  });

  if (!category) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Fixed asset category is not configured",
    });
  }

  return category.id;
}

async function resolveLoanPayableCategoryId() {
  await ensureDefaultFinanceAccounts();

  const category = await db.query.financeCategory.findFirst({
    where: (table, { and: andFn, eq: eqFn, isNull: isNullFn }) =>
      andFn(
        eqFn(table.code, "liability-loan-payable"),
        isNullFn(table.ownerId),
        isNullFn(table.ownerType),
      ),
  });

  if (!category) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Loan payable category is not configured",
    });
  }

  return category.id;
}

async function resolveLoanPayableCategoryIds(input: {
  ownerId: string;
  ownerType: AccountingOwnerType;
}) {
  await ensureDefaultFinanceAccounts();

  const categories = await db.query.financeCategory.findMany({
    where: (table, { and: andFn, eq: eqFn, or: orFn }) =>
      andFn(
        eqFn(table.accountType, "liability"),
        orFn(
          eqFn(table.code, "liability-loan-payable"),
          sql`lower(${table.name}) = 'loan payable'`,
        ),
        scopeWhere(table, input.ownerId, input.ownerType),
      ),
  });
  const categoryIds = categories.map((category) => category.id);

  return categoryIds.length > 0
    ? categoryIds
    : [await resolveLoanPayableCategoryId()];
}

async function resolveSupplierAdvanceCategoryId() {
  await ensureDefaultFinanceAccounts();

  const category = await db.query.financeCategory.findFirst({
    where: (table, { and: andFn, eq: eqFn, isNull: isNullFn }) =>
      andFn(
        eqFn(table.code, "asset-supplier-advance"),
        isNullFn(table.ownerId),
        isNullFn(table.ownerType),
      ),
  });

  if (!category) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Supplier advance category is not configured",
    });
  }

  return category.id;
}

async function resolveCustomerAdvanceCategoryId() {
  await ensureDefaultFinanceAccounts();

  const category = await db.query.financeCategory.findFirst({
    where: (table, { and: andFn, eq: eqFn, isNull: isNullFn }) =>
      andFn(
        eqFn(table.code, "liability-customer-advance"),
        isNullFn(table.ownerId),
        isNullFn(table.ownerType),
      ),
  });

  if (!category) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Customer advance category is not configured",
    });
  }

  return category.id;
}

async function resolveInventoryCategoryId() {
  await ensureDefaultFinanceAccounts();

  const category = await db.query.financeCategory.findFirst({
    where: (table, { and: andFn, eq: eqFn, isNull: isNullFn }) =>
      andFn(
        eqFn(table.code, "asset-inventory"),
        isNullFn(table.ownerId),
        isNullFn(table.ownerType),
      ),
  });

  if (!category) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Inventory category is not configured",
    });
  }

  return category.id;
}

async function resolveAccountsReceivableCategoryId() {
  await ensureDefaultFinanceAccounts();

  const category = await db.query.financeCategory.findFirst({
    where: (table, { and: andFn, eq: eqFn, isNull: isNullFn }) =>
      andFn(
        eqFn(table.code, "asset-accounts-receivable"),
        isNullFn(table.ownerId),
        isNullFn(table.ownerType),
      ),
  });

  if (!category) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Accounts receivable category is not configured",
    });
  }

  return category.id;
}

async function resolveAccountsPayableCategoryId() {
  await ensureDefaultFinanceAccounts();

  const category = await db.query.financeCategory.findFirst({
    where: (table, { and: andFn, eq: eqFn, isNull: isNullFn }) =>
      andFn(
        eqFn(table.code, "liability-accounts-payable"),
        isNullFn(table.ownerId),
        isNullFn(table.ownerType),
      ),
  });

  if (!category) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Accounts payable category is not configured",
    });
  }

  return category.id;
}

async function ensureOwnerFixedAssetAccount(input: {
  accountName: string;
  categoryId: number;
  ownerId: string;
  ownerType: AccountingOwnerType;
}): Promise<ResolvedFixedAssetAccount> {
  const name = input.accountName.trim() || "Furniture";

  const existing = await db.query.financeAccount.findFirst({
    where: (table, { and: andFn, eq: eqFn }) =>
      andFn(
        eqFn(table.accountType, "asset"),
        eqFn(table.categoryId, input.categoryId),
        eqFn(table.name, name),
        eqFn(table.ownerId, input.ownerId),
        eqFn(table.ownerType, input.ownerType),
      ),
  });

  if (existing) {
    if (existing.balanceSheetLine !== "fixed_assets") {
      await db
        .update(financeAccount)
        .set({
          balanceSheetLine: "fixed_assets",
          updatedAt: new Date(),
        })
        .where(eq(financeAccount.id, existing.id));
    }

    return {
      currentBalance: parseMoney(existing.currentBalance),
      id: existing.id,
      name: existing.name,
    };
  }

  const code = await generateUniqueCode(
    financeAccount,
    input.ownerId,
    input.ownerType,
    `asset-${slugify(name) || "fixed-asset"}`,
  );

  const [created] = await db
    .insert(financeAccount)
    .values({
      accountType: "asset",
      balanceSheetLine: "fixed_assets",
      categoryId: input.categoryId,
      code,
      currentBalance: "0.00",
      description: "Fixed asset account for furniture and equipment.",
      isActive: true,
      isPaymentAccount: false,
      isSystem: false,
      name,
      normalBalance: "debit",
      openingBalance: "0.00",
      ownerId: input.ownerId,
      ownerType: input.ownerType,
      parentAccountId: null,
      profitAndLossLine: null,
      sortOrder: 910,
    })
    .returning({
      id: financeAccount.id,
    });

  if (!created) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Failed to create fixed asset account",
    });
  }

  return {
    currentBalance: 0,
    id: created.id,
    name,
  };
}

async function resolveFixedAssetAccount(input: {
  accountId?: number | null;
  accountName: string;
  ownerId: string;
  ownerType: AccountingOwnerType;
}): Promise<ResolvedFixedAssetAccount> {
  const categoryId = await resolveFixedAssetCategoryId();

  if (typeof input.accountId === "number" && Number.isFinite(input.accountId)) {
    const accountId = input.accountId;
    const selected = await db.query.financeAccount.findFirst({
      where: (table, { and: andFn, eq: eqFn, isNull: isNullFn, or: orFn }) =>
        andFn(
          eqFn(table.id, accountId),
          eqFn(table.accountType, "asset"),
          orFn(
            eqFn(table.balanceSheetLine, "fixed_assets"),
            eqFn(table.categoryId, categoryId),
          ),
          orFn(
            andFn(isNullFn(table.ownerId), isNullFn(table.ownerType)),
            andFn(
              eqFn(table.ownerId, input.ownerId),
              eqFn(table.ownerType, input.ownerType),
            ),
          ),
        ),
    });

    if (!selected) {
      throw new ORPCError("NOT_FOUND", {
        message: "Fixed asset account not found",
      });
    }

    if (selected.ownerId === input.ownerId) {
      return {
        currentBalance: parseMoney(selected.currentBalance),
        id: selected.id,
        name: selected.name,
      };
    }

    return ensureOwnerFixedAssetAccount({
      accountName: input.accountName.trim() || selected.name,
      categoryId,
      ownerId: input.ownerId,
      ownerType: input.ownerType,
    });
  }

  return ensureOwnerFixedAssetAccount({
    accountName: input.accountName,
    categoryId,
    ownerId: input.ownerId,
    ownerType: input.ownerType,
  });
}

async function ensureOwnerLoanAccount(input: {
  accountName: string;
  categoryId: number;
  ownerId: string;
  ownerType: AccountingOwnerType;
}): Promise<ResolvedLoanAccount> {
  const name = input.accountName.trim() || "Business Loan";

  const existing = await db.query.financeAccount.findFirst({
    where: (table, { and: andFn, eq: eqFn }) =>
      andFn(
        eqFn(table.accountType, "liability"),
        eqFn(table.categoryId, input.categoryId),
        eqFn(table.name, name),
        eqFn(table.ownerId, input.ownerId),
        eqFn(table.ownerType, input.ownerType),
      ),
  });

  if (existing) {
    if (existing.balanceSheetLine !== "loan_payable") {
      await db
        .update(financeAccount)
        .set({
          balanceSheetLine: "loan_payable",
          updatedAt: new Date(),
        })
        .where(eq(financeAccount.id, existing.id));
    }

    return {
      currentBalance: parseMoney(existing.currentBalance),
      id: existing.id,
      name: existing.name,
    };
  }

  const code = await generateUniqueCode(
    financeAccount,
    input.ownerId,
    input.ownerType,
    `loan-${slugify(name) || "business-loan"}`,
  );

  const [created] = await db
    .insert(financeAccount)
    .values({
      accountType: "liability",
      balanceSheetLine: "loan_payable",
      categoryId: input.categoryId,
      code,
      currentBalance: "0.00",
      description: "Loan payable account for cash or bank loans received.",
      isActive: true,
      isPaymentAccount: false,
      isSystem: false,
      name,
      normalBalance: "credit",
      openingBalance: "0.00",
      ownerId: input.ownerId,
      ownerType: input.ownerType,
      parentAccountId: null,
      profitAndLossLine: null,
      sortOrder: 920,
    })
    .returning({
      id: financeAccount.id,
    });

  if (!created) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Failed to create loan account",
    });
  }

  return {
    currentBalance: 0,
    id: created.id,
    name,
  };
}

async function resolveLoanAccount(input: {
  accountName: string;
  ownerId: string;
  ownerType: AccountingOwnerType;
}): Promise<ResolvedLoanAccount> {
  const categoryId = await resolveLoanPayableCategoryId();
  const categoryIds = await resolveLoanPayableCategoryIds({
    ownerId: input.ownerId,
    ownerType: input.ownerType,
  });
  const accountName = input.accountName.trim();

  if (accountName) {
    const selected = await db.query.financeAccount.findFirst({
      where: (table, { and: andFn, eq: eqFn, isNull: isNullFn, or: orFn }) =>
        andFn(
          eqFn(table.accountType, "liability"),
          eqFn(table.name, accountName),
          orFn(
            eqFn(table.balanceSheetLine, "loan_payable"),
            inArray(table.categoryId, categoryIds),
          ),
          orFn(
            andFn(isNullFn(table.ownerId), isNullFn(table.ownerType)),
            andFn(
              eqFn(table.ownerId, input.ownerId),
              eqFn(table.ownerType, input.ownerType),
            ),
          ),
        ),
      orderBy: (table, { desc: descFn }) => [descFn(table.ownerId)],
    });

    if (selected?.ownerId === input.ownerId) {
      return {
        currentBalance: parseMoney(selected.currentBalance),
        id: selected.id,
        name: selected.name,
      };
    }

    if (selected) {
      return ensureOwnerLoanAccount({
        accountName: selected.name,
        categoryId,
        ownerId: input.ownerId,
        ownerType: input.ownerType,
      });
    }
  }

  return ensureOwnerLoanAccount({
    accountName: input.accountName,
    categoryId,
    ownerId: input.ownerId,
    ownerType: input.ownerType,
  });
}

async function ensureOwnerSupplierAdvanceAccount(input: {
  categoryId: number;
  ownerId: string;
  ownerType: AccountingOwnerType;
}): Promise<ResolvedSupplierAdvanceAccount> {
  const name = "Supplier Advance";

  const existing = await db.query.financeAccount.findFirst({
    where: (table, { and: andFn, eq: eqFn }) =>
      andFn(
        eqFn(table.accountType, "asset"),
        eqFn(table.categoryId, input.categoryId),
        eqFn(table.name, name),
        eqFn(table.ownerId, input.ownerId),
        eqFn(table.ownerType, input.ownerType),
      ),
  });

  if (existing) {
    if (existing.balanceSheetLine !== "supplier_advance") {
      await db
        .update(financeAccount)
        .set({
          balanceSheetLine: "supplier_advance",
          updatedAt: new Date(),
        })
        .where(eq(financeAccount.id, existing.id));
    }

    return {
      currentBalance: parseMoney(existing.currentBalance),
      id: existing.id,
      name: existing.name,
    };
  }

  const code = await generateUniqueCode(
    financeAccount,
    input.ownerId,
    input.ownerType,
    "asset-supplier-advance",
  );

  const [created] = await db
    .insert(financeAccount)
    .values({
      accountType: "asset",
      balanceSheetLine: "supplier_advance",
      categoryId: input.categoryId,
      code,
      currentBalance: "0.00",
      description: "Supplier advances paid before bills are applied.",
      isActive: true,
      isPaymentAccount: false,
      isSystem: false,
      name,
      normalBalance: "debit",
      openingBalance: "0.00",
      ownerId: input.ownerId,
      ownerType: input.ownerType,
      parentAccountId: null,
      profitAndLossLine: null,
      sortOrder: 905,
    })
    .returning({
      id: financeAccount.id,
    });

  if (!created) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Failed to create supplier advance account",
    });
  }

  return {
    currentBalance: 0,
    id: created.id,
    name,
  };
}

async function resolveSupplierAdvanceAccount(input: {
  ownerId: string;
  ownerType: AccountingOwnerType;
}): Promise<ResolvedSupplierAdvanceAccount> {
  const categoryId = await resolveSupplierAdvanceCategoryId();

  return ensureOwnerSupplierAdvanceAccount({
    categoryId,
    ownerId: input.ownerId,
    ownerType: input.ownerType,
  });
}

async function ensureOwnerCustomerAdvanceAccount(input: {
  categoryId: number;
  ownerId: string;
  ownerType: AccountingOwnerType;
}): Promise<ResolvedCustomerAdvanceAccount> {
  const name = "Customer Advance";

  const existing = await db.query.financeAccount.findFirst({
    where: (table, { and: andFn, eq: eqFn }) =>
      andFn(
        eqFn(table.accountType, "liability"),
        eqFn(table.categoryId, input.categoryId),
        eqFn(table.name, name),
        eqFn(table.ownerId, input.ownerId),
        eqFn(table.ownerType, input.ownerType),
      ),
  });

  if (existing) {
    if (existing.balanceSheetLine !== "customer_advance") {
      await db
        .update(financeAccount)
        .set({
          balanceSheetLine: "customer_advance",
          updatedAt: new Date(),
        })
        .where(eq(financeAccount.id, existing.id));
    }

    return {
      currentBalance: parseMoney(existing.currentBalance),
      id: existing.id,
      name: existing.name,
    };
  }

  const code = await generateUniqueCode(
    financeAccount,
    input.ownerId,
    input.ownerType,
    "liability-customer-advance",
  );

  const [created] = await db
    .insert(financeAccount)
    .values({
      accountType: "liability",
      balanceSheetLine: "customer_advance",
      categoryId: input.categoryId,
      code,
      currentBalance: "0.00",
      description: "Customer advances received before revenue is earned.",
      isActive: true,
      isPaymentAccount: false,
      isSystem: false,
      name,
      normalBalance: "credit",
      openingBalance: "0.00",
      ownerId: input.ownerId,
      ownerType: input.ownerType,
      parentAccountId: null,
      profitAndLossLine: null,
      sortOrder: 906,
    })
    .returning({
      id: financeAccount.id,
    });

  if (!created) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Failed to create customer advance account",
    });
  }

  return {
    currentBalance: 0,
    id: created.id,
    name,
  };
}

async function resolveCustomerAdvanceAccount(input: {
  ownerId: string;
  ownerType: AccountingOwnerType;
}): Promise<ResolvedCustomerAdvanceAccount> {
  const categoryId = await resolveCustomerAdvanceCategoryId();

  return ensureOwnerCustomerAdvanceAccount({
    categoryId,
    ownerId: input.ownerId,
    ownerType: input.ownerType,
  });
}

async function ensureOwnerInventoryAccount(input: {
  categoryId: number;
  ownerId: string;
  ownerType: AccountingOwnerType;
}): Promise<ResolvedInventoryAccount> {
  const name = "Inventory";

  const existing = await db.query.financeAccount.findFirst({
    where: (table, { and: andFn, eq: eqFn }) =>
      andFn(
        eqFn(table.accountType, "asset"),
        eqFn(table.categoryId, input.categoryId),
        eqFn(table.name, name),
        eqFn(table.ownerId, input.ownerId),
        eqFn(table.ownerType, input.ownerType),
      ),
  });

  if (existing) {
    if (existing.balanceSheetLine !== "inventory") {
      await db
        .update(financeAccount)
        .set({
          balanceSheetLine: "inventory",
          updatedAt: new Date(),
        })
        .where(eq(financeAccount.id, existing.id));
    }

    return {
      currentBalance: parseMoney(existing.currentBalance),
      id: existing.id,
      name: existing.name,
    };
  }

  const code = await generateUniqueCode(
    financeAccount,
    input.ownerId,
    input.ownerType,
    "asset-inventory",
  );

  const [created] = await db
    .insert(financeAccount)
    .values({
      accountType: "asset",
      balanceSheetLine: "inventory",
      categoryId: input.categoryId,
      code,
      currentBalance: "0.00",
      description: "Product inventory value held for sale.",
      isActive: true,
      isPaymentAccount: false,
      isSystem: false,
      name,
      normalBalance: "debit",
      openingBalance: "0.00",
      ownerId: input.ownerId,
      ownerType: input.ownerType,
      parentAccountId: null,
      profitAndLossLine: null,
      sortOrder: 880,
    })
    .returning({
      id: financeAccount.id,
    });

  if (!created) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Failed to create inventory account",
    });
  }

  return {
    currentBalance: 0,
    id: created.id,
    name,
  };
}

async function resolveInventoryAccount(input: {
  ownerId: string;
  ownerType: AccountingOwnerType;
}): Promise<ResolvedInventoryAccount> {
  const categoryId = await resolveInventoryCategoryId();

  return ensureOwnerInventoryAccount({
    categoryId,
    ownerId: input.ownerId,
    ownerType: input.ownerType,
  });
}

async function ensureOwnerAccountsReceivableAccount(input: {
  categoryId: number;
  ownerId: string;
  ownerType: AccountingOwnerType;
}): Promise<ResolvedReceivableAccount> {
  const name = "Accounts Receivable";

  const existing = await db.query.financeAccount.findFirst({
    where: (table, { and: andFn, eq: eqFn }) =>
      andFn(
        eqFn(table.accountType, "asset"),
        eqFn(table.categoryId, input.categoryId),
        eqFn(table.name, name),
        eqFn(table.ownerId, input.ownerId),
        eqFn(table.ownerType, input.ownerType),
      ),
  });

  if (existing) {
    if (existing.balanceSheetLine !== "accounts_receivable") {
      await db
        .update(financeAccount)
        .set({
          balanceSheetLine: "accounts_receivable",
          updatedAt: new Date(),
        })
        .where(eq(financeAccount.id, existing.id));
    }

    return {
      currentBalance: parseMoney(existing.currentBalance),
      id: existing.id,
      name: existing.name,
    };
  }

  const code = await generateUniqueCode(
    financeAccount,
    input.ownerId,
    input.ownerType,
    "asset-accounts-receivable",
  );

  const [created] = await db
    .insert(financeAccount)
    .values({
      accountType: "asset",
      balanceSheetLine: "accounts_receivable",
      categoryId: input.categoryId,
      code,
      currentBalance: "0.00",
      description: "Customer due balances from unpaid product sales.",
      isActive: true,
      isPaymentAccount: false,
      isSystem: false,
      name,
      normalBalance: "debit",
      openingBalance: "0.00",
      ownerId: input.ownerId,
      ownerType: input.ownerType,
      parentAccountId: null,
      profitAndLossLine: null,
      sortOrder: 885,
    })
    .returning({
      id: financeAccount.id,
    });

  if (!created) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Failed to create accounts receivable account",
    });
  }

  return {
    currentBalance: 0,
    id: created.id,
    name,
  };
}

async function resolveAccountsReceivableAccount(input: {
  ownerId: string;
  ownerType: AccountingOwnerType;
}): Promise<ResolvedReceivableAccount> {
  const categoryId = await resolveAccountsReceivableCategoryId();

  return ensureOwnerAccountsReceivableAccount({
    categoryId,
    ownerId: input.ownerId,
    ownerType: input.ownerType,
  });
}

async function ensureOwnerAccountsPayableAccount(input: {
  categoryId: number;
  ownerId: string;
  ownerType: AccountingOwnerType;
}): Promise<ResolvedPayableAccount> {
  const name = "Accounts Payable";

  const existing = await db.query.financeAccount.findFirst({
    where: (table, { and: andFn, eq: eqFn }) =>
      andFn(
        eqFn(table.accountType, "liability"),
        eqFn(table.categoryId, input.categoryId),
        eqFn(table.name, name),
        eqFn(table.ownerId, input.ownerId),
        eqFn(table.ownerType, input.ownerType),
      ),
  });

  if (existing) {
    if (existing.balanceSheetLine !== "accounts_payable") {
      await db
        .update(financeAccount)
        .set({
          balanceSheetLine: "accounts_payable",
          updatedAt: new Date(),
        })
        .where(eq(financeAccount.id, existing.id));
    }

    return {
      currentBalance: parseMoney(existing.currentBalance),
      id: existing.id,
      name: existing.name,
    };
  }

  const code = await generateUniqueCode(
    financeAccount,
    input.ownerId,
    input.ownerType,
    "liability-accounts-payable",
  );

  const [created] = await db
    .insert(financeAccount)
    .values({
      accountType: "liability",
      balanceSheetLine: "accounts_payable",
      categoryId: input.categoryId,
      code,
      currentBalance: "0.00",
      description: "Supplier due balances from unpaid product purchases.",
      isActive: true,
      isPaymentAccount: false,
      isSystem: false,
      name,
      normalBalance: "credit",
      openingBalance: "0.00",
      ownerId: input.ownerId,
      ownerType: input.ownerType,
      parentAccountId: null,
      profitAndLossLine: null,
      sortOrder: 900,
    })
    .returning({
      id: financeAccount.id,
    });

  if (!created) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Failed to create accounts payable account",
    });
  }

  return {
    currentBalance: 0,
    id: created.id,
    name,
  };
}

async function resolveAccountsPayableAccount(input: {
  ownerId: string;
  ownerType: AccountingOwnerType;
}): Promise<ResolvedPayableAccount> {
  const categoryId = await resolveAccountsPayableCategoryId();

  return ensureOwnerAccountsPayableAccount({
    categoryId,
    ownerId: input.ownerId,
    ownerType: input.ownerType,
  });
}

export const financeRouter = {
  getChartOfAccounts: protectedProcedure
    .route({
      method: "POST",
      path: "/finance/chart-of-accounts",
      tags: ["Finance"],
      summary: "Get chart of accounts",
    })
    .input(z.object({}).optional())
    .handler(async ({ context }) => {
      const ownerId = context.session.user.id;
      const ownerType = resolveOwnerScope(context.session.user.role);

      await ensureDefaultFinanceAccounts();

      const [categories, accounts] = await Promise.all([
        db.query.financeCategory.findMany({
          where: (
            table,
            { and: andFn, eq: eqFn, isNull: isNullFn, or: orFn },
          ) =>
            orFn(
              andFn(isNullFn(table.ownerId), isNullFn(table.ownerType)),
              andFn(
                eqFn(table.ownerId, ownerId),
                eqFn(table.ownerType, ownerType),
              ),
            ),
          orderBy: (table, { asc: ascFn }) => [
            ascFn(table.accountType),
            ascFn(table.sortOrder),
            ascFn(table.name),
          ],
        }),
        db.query.financeAccount.findMany({
          where: (
            table,
            { and: andFn, eq: eqFn, isNull: isNullFn, or: orFn },
          ) =>
            andFn(
              orFn(
                andFn(isNullFn(table.ownerId), isNullFn(table.ownerType)),
                andFn(
                  eqFn(table.ownerId, ownerId),
                  eqFn(table.ownerType, ownerType),
                ),
              ),
              // hide system cogs from the chart UI
              sql`${table.accountType} <> 'cogs'`,
            ),
          orderBy: (table, { asc: ascFn }) => [
            ascFn(table.accountType),
            ascFn(table.sortOrder),
            ascFn(table.name),
          ],
        }),
      ]);

      return {
        accounts: accounts.map((account) => ({
          accountType: toUiAccountType(account.accountType),
          amount: parseMoney(account.currentBalance),
          categoryId: String(account.categoryId),
          description: account.description ?? "",
          id: String(account.id),
          isSubaccount: Boolean(account.parentAccountId),
          name: account.name,
          parentAccountId: account.parentAccountId
            ? String(account.parentAccountId)
            : "",
        })),
        categories: categories
          .filter((category) => category.accountType !== "cogs")
          .map((category) => ({
            accountType: toUiAccountType(category.accountType),
            id: String(category.id),
            isDefault: category.isSystem,
            name: category.name,
          })),
      };
    }),

  getPaymentAccounts: protectedProcedure
    .route({
      method: "POST",
      path: "/finance/payment-accounts",
      tags: ["Finance"],
      summary: "Get payment accounts",
    })
    .input(z.object({}).optional())
    .handler(async ({ context }) => {
      const ownerId = context.session.user.id;
      const ownerType = resolveOwnerScope(context.session.user.role);

      let paymentAccounts = await db.query.financePaymentAccount.findMany({
        where: (table, { and: andFn, eq: eqFn }) =>
          andFn(eqFn(table.ownerId, ownerId), eqFn(table.ownerType, ownerType)),
        orderBy: (table, { desc: descFn, asc: ascFn }) => [
          descFn(table.isDefault),
          ascFn(table.type),
          ascFn(table.name),
        ],
      });

      if (
        !paymentAccounts.some(
          (account) => account.type === "cash" || account.type === "bank",
        )
      ) {
        await ensurePaymentAccountsReady({ ownerId, ownerType });

        paymentAccounts = await db.query.financePaymentAccount.findMany({
          where: (table, { and: andFn, eq: eqFn }) =>
            andFn(
              eqFn(table.ownerId, ownerId),
              eqFn(table.ownerType, ownerType),
            ),
          orderBy: (table, { desc: descFn, asc: ascFn }) => [
            descFn(table.isDefault),
            ascFn(table.type),
            ascFn(table.name),
          ],
        });
      }

      return {
        paymentAccounts: paymentAccounts
          .filter(
            (account) => account.type === "cash" || account.type === "bank",
          )
          .map((account) => ({
            balance: parseMoney(account.currentBalance),
            id: String(account.id),
            isDefault: account.isDefault,
            name: account.name,
            type: account.type as "cash" | "bank",
          })),
      };
    }),

  getGeneralLedger: protectedProcedure
    .route({
      method: "POST",
      path: "/finance/general-ledger",
      tags: ["Finance"],
      summary: "General ledger",
    })
    .input(
      z.object({
        accountId: z.union([z.string(), z.number()]).optional().nullable(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .handler(async ({ context, input }) => {
      const ownerId = context.session.user.id;
      const ownerType = resolveOwnerScope(context.session.user.role);
      const startDateTime = new Date(`${input.startDate}T00:00:00.000`);
      const endDateTime = new Date(`${input.endDate}T23:59:59.999`);
      const selectedAccountId =
        input.accountId && input.accountId !== "all"
          ? Number(input.accountId)
          : null;

      const [accountRows, paymentRows, ledgerRows] = await Promise.all([
        db
          .select({
            accountType: financeAccount.accountType,
            categoryName: financeCategory.name,
            currentBalance: financeAccount.currentBalance,
            id: financeAccount.id,
            isPaymentAccount: financeAccount.isPaymentAccount,
            name: financeAccount.name,
            openingBalance: financeAccount.openingBalance,
            sortOrder: financeAccount.sortOrder,
          })
          .from(financeAccount)
          .innerJoin(
            financeCategory,
            eq(financeAccount.categoryId, financeCategory.id),
          )
          .where(
            and(
              eq(financeAccount.ownerId, ownerId),
              eq(financeAccount.ownerType, ownerType),
              eq(financeAccount.isActive, true),
            ),
          )
          .orderBy(
            asc(financeAccount.accountType),
            asc(financeAccount.sortOrder),
            asc(financeAccount.name),
          ),
        db.query.financePaymentAccount.findMany({
          where: (table, { and: andFn, eq: eqFn }) =>
            andFn(
              eqFn(table.ownerId, ownerId),
              eqFn(table.ownerType, ownerType),
              eqFn(table.isActive, true),
            ),
        }),
        db.query.financialLedger.findMany({
          where: (table, { and: andFn, eq: eqFn, gte: gteFn, lte: lteFn }) =>
            andFn(
              eqFn(table.ownerId, ownerId),
              eqFn(table.ownerType, ownerType),
              gteFn(table.createdAt, startDateTime),
              lteFn(table.createdAt, endDateTime),
            ),
          orderBy: (table, { asc: ascFn }) => [
            ascFn(table.createdAt),
            ascFn(table.id),
          ],
        }),
      ]);

      const paymentById = new Map(paymentRows.map((row) => [row.id, row]));
      const paymentByName = new Map(
        paymentRows.map((row) => [
          normalizePaymentAccountLookup(row.name),
          row,
        ]),
      );
      const paymentByFinanceAccountId = new Map(
        paymentRows.map((row) => [row.financeAccountId, row]),
      );
      const accountsById = new Map(
        accountRows.map((account) => [account.id, account]),
      );
      const ledgerByAccount = new Map<
        number,
        Array<{
          amount: string;
          balance: string;
          createdAt: Date;
          date: string;
          description: string;
          direction: "credit" | "debit";
          id: number;
          referenceId: number;
          referenceType: string;
          signedAmount: string;
          transactionType: string;
        }>
      >();

      for (const row of ledgerRows) {
        const accountIds = new Set<number>();
        const referencedPayment = paymentById.get(row.referenceId);

        if (referencedPayment?.financeAccountId) {
          accountIds.add(referencedPayment.financeAccountId);
        }

        if (accountsById.has(row.referenceId)) {
          accountIds.add(row.referenceId);
        }

        const namedPaymentAccount = extractLedgerAccountName(row.description);
        if (namedPaymentAccount) {
          const paymentAccount = paymentByName.get(
            normalizePaymentAccountLookup(namedPaymentAccount),
          );
          if (paymentAccount?.financeAccountId) {
            accountIds.add(paymentAccount.financeAccountId);
          }
        }

        for (const accountId of accountIds) {
          const account = accountsById.get(accountId);
          if (!account) {
            continue;
          }

          const amount = parseMoney(row.amount);
          const signedAmount = signedLedgerAmount({
            accountType: account.accountType,
            amount,
            direction: row.direction,
            isPaymentAccount: account.isPaymentAccount,
          });
          const currentRows = ledgerByAccount.get(accountId) ?? [];

          currentRows.push({
            amount: toMoney(amount),
            balance: "0.00",
            createdAt: row.createdAt,
            date: ledgerDateValue(row.createdAt),
            description: row.description ?? "",
            direction: row.direction,
            id: row.id,
            referenceId: row.referenceId,
            referenceType: row.referenceType,
            signedAmount: toMoney(signedAmount),
            transactionType: formatLedgerEntryType(row.entryType),
          });
          ledgerByAccount.set(accountId, currentRows);
        }
      }

      const accounts = accountRows
        .map((account) => {
          const rows = ledgerByAccount.get(account.id) ?? [];
          const paymentAccount = account.isPaymentAccount
            ? paymentByFinanceAccountId.get(account.id)
            : null;
          const currentBalance = parseMoney(
            paymentAccount?.currentBalance ?? account.currentBalance,
          );
          const periodMovement = rows.reduce(
            (sum, row) => sum + parseMoney(row.signedAmount),
            0,
          );
          const openingBalance = currentBalance - periodMovement;
          let runningBalance = openingBalance;
          const transactions = rows.map((row) => {
            runningBalance += parseMoney(row.signedAmount);

            return {
              ...row,
              balance: toMoney(runningBalance),
            };
          });

          return {
            accountType: toUiAccountType(account.accountType),
            balance: toMoney(currentBalance),
            category: account.categoryName,
            id: String(account.id),
            name: account.name,
            openingBalance: toMoney(openingBalance),
            transactions,
          };
        })
        .filter((account) => {
          if (selectedAccountId) {
            return Number(account.id) === selectedAccountId;
          }

          return parseMoney(account.balance) !== 0;
        });

      return {
        accounts,
        period: {
          endDate: input.endDate,
          startDate: input.startDate,
        },
      };
    }),

  updateLedgerTransaction: protectedProcedure
    .route({
      method: "POST",
      path: "/finance/general-ledger/transactions/update",
      tags: ["Finance"],
      summary: "Update ledger transaction amount",
    })
    .input(
      z.object({
        amount: z.union([z.string(), z.number()]),
        id: z.number().int().positive(),
      }),
    )
    .handler(async ({ context, input }) => {
      const ownerId = context.session.user.id;
      const ownerType = resolveOwnerScope(context.session.user.role);
      const nextAmount = parseMoney(input.amount);

      if (nextAmount <= 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter a transaction amount greater than 0",
        });
      }

      const row = await db.query.financialLedger.findFirst({
        where: (table, { and: andFn, eq: eqFn }) =>
          andFn(
            eqFn(table.id, input.id),
            eqFn(table.ownerId, ownerId),
            eqFn(table.ownerType, ownerType),
          ),
      });

      if (!row) {
        throw new ORPCError("NOT_FOUND", {
          message: "Ledger transaction not found",
        });
      }

      const previousAmount = parseMoney(row.amount);
      const delta = nextAmount - previousAmount;
      const targets = await resolveLedgerBalanceTargets({
        description: row.description,
        ownerId,
        ownerType,
        referenceId: row.referenceId,
        referenceType: row.referenceType,
      });

      await db.transaction(async (tx) => {
        for (const account of targets.paymentTargets) {
          const signedDelta = signedLedgerAmount({
            amount: delta,
            direction: row.direction,
            isPaymentAccount: true,
          });

          await tx
            .update(financePaymentAccount)
            .set({
              currentBalance: toMoney(
                parseMoney(account.currentBalance) + signedDelta,
              ),
              updatedAt: new Date(),
            })
            .where(eq(financePaymentAccount.id, account.id));
        }

        for (const account of targets.financeTargets) {
          const signedDelta = signedLedgerAmount({
            accountType: account.accountType,
            amount: delta,
            direction: row.direction,
            isPaymentAccount: false,
          });

          await tx
            .update(financeAccount)
            .set({
              currentBalance: toMoney(
                parseMoney(account.currentBalance) + signedDelta,
              ),
              updatedAt: new Date(),
            })
            .where(eq(financeAccount.id, account.id));
        }

        await tx
          .update(financialLedger)
          .set({
            amount: toMoney(nextAmount),
            balanceAfter:
              row.balanceAfter === null
                ? null
                : toMoney(
                    parseMoney(row.balanceAfter) +
                      signedLedgerAmount({
                        amount: delta,
                        direction: row.direction,
                        isPaymentAccount: true,
                      }),
                  ),
          })
          .where(eq(financialLedger.id, row.id));

        if (row.referenceType === "expense") {
          await tx
            .update(expense)
            .set({
              amount: toMoney(nextAmount),
              updatedAt: new Date(),
            })
            .where(eq(expense.id, row.referenceId));
        }
      });

      return {
        amount: toMoney(nextAmount),
        message: "Ledger transaction updated",
      };
    }),

  deleteLedgerTransaction: protectedProcedure
    .route({
      method: "POST",
      path: "/finance/general-ledger/transactions/delete",
      tags: ["Finance"],
      summary: "Delete ledger transaction",
    })
    .input(z.object({ id: z.number().int().positive() }))
    .handler(async ({ context, input }) => {
      const ownerId = context.session.user.id;
      const ownerType = resolveOwnerScope(context.session.user.role);
      const row = await db.query.financialLedger.findFirst({
        where: (table, { and: andFn, eq: eqFn }) =>
          andFn(
            eqFn(table.id, input.id),
            eqFn(table.ownerId, ownerId),
            eqFn(table.ownerType, ownerType),
          ),
      });

      if (!row) {
        throw new ORPCError("NOT_FOUND", {
          message: "Ledger transaction not found",
        });
      }
      const targets = await resolveLedgerBalanceTargets({
        description: row.description,
        ownerId,
        ownerType,
        referenceId: row.referenceId,
        referenceType: row.referenceType,
      });

      await db.transaction(async (tx) => {
        for (const account of targets.paymentTargets) {
          const signedAmount = signedLedgerAmount({
            amount: parseMoney(row.amount),
            direction: row.direction,
            isPaymentAccount: true,
          });

          await tx
            .update(financePaymentAccount)
            .set({
              currentBalance: toMoney(
                parseMoney(account.currentBalance) - signedAmount,
              ),
              updatedAt: new Date(),
            })
            .where(eq(financePaymentAccount.id, account.id));
        }

        for (const account of targets.financeTargets) {
          const signedAmount = signedLedgerAmount({
            accountType: account.accountType,
            amount: parseMoney(row.amount),
            direction: row.direction,
            isPaymentAccount: false,
          });

          await tx
            .update(financeAccount)
            .set({
              currentBalance: toMoney(
                parseMoney(account.currentBalance) - signedAmount,
              ),
              updatedAt: new Date(),
            })
            .where(eq(financeAccount.id, account.id));
        }

        if (row.referenceType === "expense") {
          await tx.delete(expense).where(eq(expense.id, row.referenceId));
        }

        await tx.delete(financialLedger).where(eq(financialLedger.id, row.id));
      });

      return { message: "Ledger transaction deleted" };
    }),

  getFixedAssetAccounts: protectedProcedure
    .route({
      method: "POST",
      path: "/finance/fixed-asset-accounts",
      tags: ["Finance"],
      summary: "Get fixed asset accounts",
    })
    .input(z.object({}).optional())
    .handler(async ({ context }) => {
      const ownerId = context.session.user.id;
      const ownerType = resolveOwnerScope(context.session.user.role);
      const categoryId = await resolveFixedAssetCategoryId();

      const accounts = await db.query.financeAccount.findMany({
        where: (table, { and: andFn, eq: eqFn, isNull: isNullFn, or: orFn }) =>
          andFn(
            eqFn(table.accountType, "asset"),
            orFn(
              eqFn(table.balanceSheetLine, "fixed_assets"),
              eqFn(table.categoryId, categoryId),
            ),
            orFn(
              andFn(isNullFn(table.ownerId), isNullFn(table.ownerType)),
              andFn(
                eqFn(table.ownerId, ownerId),
                eqFn(table.ownerType, ownerType),
              ),
            ),
          ),
        orderBy: (table, { asc: ascFn, desc: descFn }) => [
          descFn(table.ownerId),
          ascFn(table.sortOrder),
          ascFn(table.name),
        ],
      });

      return {
        accounts: accounts.map((account) => ({
          balance: parseMoney(account.currentBalance),
          id: String(account.id),
          isDefault: account.isSystem,
          name: account.name,
        })),
      };
    }),

  getLoanAccounts: protectedProcedure
    .route({
      method: "POST",
      path: "/finance/loan-accounts",
      tags: ["Finance"],
      summary: "Get loan payable accounts",
    })
    .input(z.object({}).optional())
    .handler(async ({ context }) => {
      const ownerId = context.session.user.id;
      const ownerType = resolveOwnerScope(context.session.user.role);
      const categoryIds = await resolveLoanPayableCategoryIds({
        ownerId,
        ownerType,
      });

      const accounts = await db.query.financeAccount.findMany({
        where: (table, { and: andFn, eq: eqFn, isNull: isNullFn, or: orFn }) =>
          andFn(
            eqFn(table.accountType, "liability"),
            orFn(
              eqFn(table.balanceSheetLine, "loan_payable"),
              inArray(table.categoryId, categoryIds),
            ),
            orFn(
              andFn(isNullFn(table.ownerId), isNullFn(table.ownerType)),
              andFn(
                eqFn(table.ownerId, ownerId),
                eqFn(table.ownerType, ownerType),
              ),
            ),
          ),
        orderBy: (table, { asc: ascFn, desc: descFn }) => [
          descFn(table.ownerId),
          ascFn(table.sortOrder),
          ascFn(table.name),
        ],
      });

      return {
        accounts: accounts.map((account) => ({
          balance: parseMoney(account.currentBalance),
          id: String(account.id),
          isDefault: account.isSystem,
          name: account.name,
        })),
      };
    }),

  createDaybookExpense: protectedProcedure
    .route({
      method: "POST",
      path: "/finance/daybook-expenses/create",
      tags: ["Finance"],
      summary: "Create daybook expense",
      description:
        "Create paid daybook expense rows and reduce the selected cash or bank payment account.",
    })
    .input(
      z.object({
        lines: z
          .array(
            z.object({
              amount: z.union([z.string(), z.number()]),
              category: z.string().min(1).max(160),
              description: z.string().max(300).optional().nullable(),
            }),
          )
          .min(1),
        memo: z.string().max(1000).optional().nullable(),
        payee: z.string().max(200).optional().nullable(),
        paymentAccountId: z.union([z.string(), z.number()]),
        paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        paymentMethod: z.enum(PAYMENT_METHODS),
        referenceNo: z.string().max(100).optional().nullable(),
        supplierId: z.number().int().optional().nullable(),
      }),
    )
    .handler(async ({ context, input }) => {
      const ownerId = context.session.user.id;
      const ownerType = resolveOwnerScope(context.session.user.role);
      const directPaymentAccountId = Number(input.paymentAccountId);
      const paymentAccountId =
        Number.isFinite(directPaymentAccountId) && directPaymentAccountId > 0
          ? directPaymentAccountId
          : await (async () => {
              await ensurePaymentAccountsReady({ ownerId, ownerType });

              return resolvePaymentAccountId({
                ownerId,
                ownerType,
                paymentAccountId: input.paymentAccountId,
              });
            })();

      const paymentAccount = await db.query.financePaymentAccount.findFirst({
        where: (table, { and: andFn, eq: eqFn }) =>
          andFn(
            eqFn(table.id, paymentAccountId),
            eqFn(table.ownerId, ownerId),
            eqFn(table.ownerType, ownerType),
          ),
      });

      if (
        !paymentAccount ||
        (paymentAccount.type !== "cash" && paymentAccount.type !== "bank")
      ) {
        throw new ORPCError("NOT_FOUND", {
          message: "Cash or bank payment account not found",
        });
      }

      if (paymentAccount.type !== input.paymentMethod) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Payment method must match the selected payment account",
        });
      }

      const validLines = input.lines
        .map((line) => ({
          amount: parseMoney(line.amount),
          category: line.category.trim(),
          description: line.description?.trim() ?? "",
        }))
        .filter((line) => line.amount > 0 && line.category.length > 0);

      if (validLines.length === 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter at least one expense amount",
        });
      }

      const total = validLines.reduce((sum, line) => sum + line.amount, 0);
      const balanceBefore = parseMoney(paymentAccount.currentBalance);
      const balanceAfter = balanceBefore - total;
      assertSufficientPaymentBalance({
        accountName: paymentAccount.name,
        balanceBefore,
        total,
      });
      const payeeName = input.payee?.trim();
      const expenseSupplier =
        ownerType === "shop" && (input.supplierId || payeeName)
          ? await db.query.supplier.findFirst({
              where: input.supplierId
                ? and(
                    eq(supplier.addedBy, ownerId),
                    eq(supplier.id, input.supplierId),
                  )
                : and(
                    eq(supplier.addedBy, ownerId),
                    ilike(supplier.name, payeeName ?? ""),
                  ),
            })
          : null;
      const { nextSequence, prefix } =
        await getNextExpenseNumberPrefix(ownerId);
      let runningBalance = balanceBefore;
      const createdExpenses = [];

      for (const [index, line] of validLines.entries()) {
        const categoryId = await resolveExpenseCategoryId(
          ownerId,
          line.category,
        );
        const expenseNumber = buildExpenseNumber(prefix, nextSequence + index);
        const lineBalanceBefore = runningBalance;
        const lineBalanceAfter = runningBalance - line.amount;
        const title = line.description || line.category;

        const [created] = await db
          .insert(expense)
          .values({
            amount: toMoney(line.amount),
            attachment: null,
            categoryId,
            expenseNumber,
            note: input.memo?.trim() || null,
            ownerId,
            ownerType,
            payeeId: null,
            paymentDate: input.paymentDate,
            paymentMethod: input.paymentMethod,
            referenceNo: input.referenceNo?.trim() || null,
            title,
          })
          .returning({
            amount: expense.amount,
            expenseNumber: expense.expenseNumber,
            id: expense.id,
            paymentDate: expense.paymentDate,
            title: expense.title,
          });

        if (!created) {
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Failed to create daybook expense",
          });
        }

        await db.insert(financialLedger).values({
          amount: toMoney(line.amount),
          balanceAfter: toMoney(lineBalanceAfter),
          balanceBefore: toMoney(lineBalanceBefore),
          description: [
            `Expense: ${title} (${line.category})`,
            input.payee?.trim() ? `Payee: ${input.payee.trim()}` : null,
            `Payment account: ${paymentAccount.name}`,
          ]
            .filter(Boolean)
            .join(" | "),
          direction: "debit",
          entryType: "expense",
          ownerId,
          ownerType,
          referenceId: created.id,
          referenceType: "expense",
        });

        createdExpenses.push(created);
        runningBalance = lineBalanceAfter;
      }

      await db
        .update(financePaymentAccount)
        .set({
          currentBalance: toMoney(balanceAfter),
          updatedAt: new Date(),
        })
        .where(eq(financePaymentAccount.id, paymentAccount.id));

      if (expenseSupplier) {
        const currentPayable = parseMoney(expenseSupplier.currentPayable);
        const nextPayable = Math.max(0, currentPayable - total);

        await db
          .update(supplier)
          .set({
            currentPayable: toMoney(nextPayable),
            updatedAt: new Date(),
          })
          .where(eq(supplier.id, expenseSupplier.id));

        await db.insert(financialLedger).values({
          amount: toMoney(total),
          description: [
            "Supplier expense payment",
            `Supplier: ${expenseSupplier.name}`,
            input.referenceNo?.trim()
              ? `Reference: ${input.referenceNo.trim()}`
              : null,
            `Payment account: ${paymentAccount.name}`,
          ]
            .filter(Boolean)
            .join(" | "),
          direction: "debit",
          entryType: "supplier_payment",
          ownerId,
          ownerType,
          referenceId: expenseSupplier.id,
          referenceType: "supplier_payment",
        });
      }

      return {
        balanceAfter: toMoney(balanceAfter),
        expenses: createdExpenses,
        message: "Expense saved and reports updated",
        total: toMoney(total),
      };
    }),

  createFixedAssetPurchase: protectedProcedure
    .route({
      method: "POST",
      path: "/finance/fixed-asset-purchases/create",
      tags: ["Finance"],
      summary: "Create fixed asset purchase",
      description:
        "Record a paid fixed asset purchase without changing Profit & Loss.",
    })
    .input(
      z.object({
        billNo: z.string().max(120).optional().nullable(),
        lines: z
          .array(
            z.object({
              accountId: z
                .union([z.string(), z.number()])
                .optional()
                .nullable(),
              accountName: z.string().min(1).max(180),
              price: z.union([z.string(), z.number()]),
              productName: z.string().min(1).max(220),
            }),
          )
          .min(1),
        notes: z.string().max(1000).optional().nullable(),
        paymentAccountId: z.union([z.string(), z.number()]),
        paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        paymentMethod: z.enum(PAYMENT_METHODS),
        referenceNo: z.string().max(120).optional().nullable(),
        supplier: z.string().max(200).optional().nullable(),
      }),
    )
    .handler(async ({ context, input }) => {
      const ownerId = context.session.user.id;
      const ownerType = resolveOwnerScope(context.session.user.role);
      const paymentAccountId = Number(input.paymentAccountId);

      if (!Number.isFinite(paymentAccountId)) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Select a valid payment account",
        });
      }

      await ensureDefaultFinancePaymentAccounts({ ownerId, ownerType });

      const paymentAccount = await db.query.financePaymentAccount.findFirst({
        where: (table, { and: andFn, eq: eqFn }) =>
          andFn(
            eqFn(table.id, paymentAccountId),
            eqFn(table.ownerId, ownerId),
            eqFn(table.ownerType, ownerType),
          ),
      });

      if (
        !paymentAccount ||
        (paymentAccount.type !== "cash" && paymentAccount.type !== "bank")
      ) {
        throw new ORPCError("NOT_FOUND", {
          message: "Cash or bank payment account not found",
        });
      }

      if (paymentAccount.type !== input.paymentMethod) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Payment method must match the selected payment account",
        });
      }

      const validLines = input.lines
        .map((line) => ({
          accountId:
            line.accountId === null || line.accountId === undefined
              ? null
              : Number(line.accountId),
          accountName: line.accountName.trim(),
          price: parseMoney(line.price),
          productName: line.productName.trim(),
        }))
        .filter(
          (line) =>
            line.price > 0 &&
            line.accountName.length > 0 &&
            line.productName.length > 0,
        );

      if (validLines.length === 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter at least one fixed asset amount",
        });
      }

      const assetLines: FixedAssetPurchaseLine[] = [];
      for (const line of validLines) {
        const account = await resolveFixedAssetAccount({
          accountId:
            line.accountId && Number.isFinite(line.accountId)
              ? line.accountId
              : null,
          accountName: line.accountName,
          ownerId,
          ownerType,
        });

        assetLines.push({
          ...line,
          account,
        });
      }

      const total = assetLines.reduce((sum, line) => sum + line.price, 0);
      const balanceBefore = parseMoney(paymentAccount.currentBalance);
      const balanceAfter = balanceBefore - total;
      assertSufficientPaymentBalance({
        accountName: paymentAccount.name,
        balanceBefore,
        total,
      });
      const accountTotals = new Map<
        number,
        { accountName: string; currentBalance: number; total: number }
      >();

      for (const line of assetLines) {
        const existing = accountTotals.get(line.account.id);
        accountTotals.set(line.account.id, {
          accountName: line.account.name,
          currentBalance:
            existing?.currentBalance ?? line.account.currentBalance,
          total: (existing?.total ?? 0) + line.price,
        });
      }

      await db.transaction(async (tx) => {
        await tx
          .update(financePaymentAccount)
          .set({
            currentBalance: toMoney(balanceAfter),
            updatedAt: new Date(),
          })
          .where(eq(financePaymentAccount.id, paymentAccount.id));

        for (const [accountId, account] of accountTotals) {
          await tx
            .update(financeAccount)
            .set({
              balanceSheetLine: "fixed_assets",
              currentBalance: toMoney(account.currentBalance + account.total),
              updatedAt: new Date(),
            })
            .where(eq(financeAccount.id, accountId));
        }

        await tx.insert(financialLedger).values({
          amount: toMoney(total),
          balanceAfter: toMoney(balanceAfter),
          balanceBefore: toMoney(balanceBefore),
          description: [
            "Fixed asset purchase",
            input.supplier?.trim()
              ? `Supplier: ${input.supplier.trim()}`
              : null,
            input.billNo?.trim() ? `Bill: ${input.billNo.trim()}` : null,
            input.referenceNo?.trim()
              ? `Reference: ${input.referenceNo.trim()}`
              : null,
            `Assets: ${assetLines
              .map((line) => `${line.productName} (${line.account.name})`)
              .join(", ")}`,
          ]
            .filter(Boolean)
            .join(" | "),
          direction: "debit",
          entryType: "adjustment",
          ownerId,
          ownerType,
          referenceId: paymentAccount.id,
          referenceType: "adjustment",
        });
      });

      return {
        assets: assetLines.map((line) => ({
          accountId: String(line.account.id),
          accountName: line.account.name,
          amount: toMoney(line.price),
          productName: line.productName,
        })),
        balanceAfter: toMoney(balanceAfter),
        message: "Fixed asset purchase saved and Balance Sheet updated",
        total: toMoney(total),
      };
    }),

  createProductPurchase: protectedProcedure
    .route({
      method: "POST",
      path: "/finance/product-purchases/create",
      tags: ["Finance"],
      summary: "Create product purchase",
      description:
        "Record a product purchase as Product Purchase Cost without creating operating expense rows.",
    })
    .input(
      z.object({
        billNo: z.string().max(120).optional().nullable(),
        items: z
          .array(
            z.object({
              amount: z.union([z.string(), z.number()]),
              description: z.string().max(260).optional().nullable(),
              productName: z.string().min(1).max(220),
            }),
          )
          .min(1),
        notes: z.string().max(1000).optional().nullable(),
        paymentAccountId: z
          .union([z.string(), z.number()])
          .optional()
          .nullable(),
        paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        paymentMethod: z.enum(PAYMENT_METHODS).optional().nullable(),
        paymentType: z.enum(PRODUCT_PURCHASE_PAYMENT_TYPES).default("cash"),
        referenceNo: z.string().max(120).optional().nullable(),
        supplier: z.string().max(200).optional().nullable(),
      }),
    )
    .handler(async ({ context, input }) => {
      const ownerId = context.session.user.id;
      const ownerType = resolveOwnerScope(context.session.user.role);
      const isDuePurchase = input.paymentType === "due";
      const paymentAccountId = Number(input.paymentAccountId);

      await ensureDefaultFinancePaymentAccounts({ ownerId, ownerType });

      const paymentAccount = isDuePurchase
        ? null
        : await db.query.financePaymentAccount.findFirst({
            where: (table, { and: andFn, eq: eqFn }) =>
              andFn(
                eqFn(table.id, paymentAccountId),
                eqFn(table.ownerId, ownerId),
                eqFn(table.ownerType, ownerType),
              ),
          });

      if (!isDuePurchase) {
        if (!Number.isFinite(paymentAccountId)) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Select a valid payment account",
          });
        }

        if (
          !paymentAccount ||
          (paymentAccount.type !== "cash" && paymentAccount.type !== "bank")
        ) {
          throw new ORPCError("NOT_FOUND", {
            message: "Cash or bank payment account not found",
          });
        }

        if (paymentAccount.type !== input.paymentMethod) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Payment method must match the selected payment account",
          });
        }
      }

      const validItems = input.items
        .map((item) => ({
          amount: parseMoney(item.amount),
          description: item.description?.trim() || "Product Purchased",
          productName: item.productName.trim(),
        }))
        .filter((item) => item.amount > 0 && item.productName.length > 0);

      if (validItems.length === 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter at least one product purchase amount",
        });
      }

      const total = validItems.reduce((sum, item) => sum + item.amount, 0);
      const balanceBefore = paymentAccount
        ? parseMoney(paymentAccount.currentBalance)
        : 0;
      const balanceAfter = paymentAccount ? balanceBefore - total : 0;
      if (paymentAccount) {
        assertSufficientPaymentBalance({
          accountName: paymentAccount.name,
          balanceBefore,
          total,
        });
      }
      const accountsPayable = isDuePurchase
        ? await resolveAccountsPayableAccount({ ownerId, ownerType })
        : null;

      await db.transaction(async (tx) => {
        if (paymentAccount) {
          await tx
            .update(financePaymentAccount)
            .set({
              currentBalance: toMoney(balanceAfter),
              updatedAt: new Date(),
            })
            .where(eq(financePaymentAccount.id, paymentAccount.id));
        }

        if (accountsPayable) {
          await tx
            .update(financeAccount)
            .set({
              balanceSheetLine: "accounts_payable",
              currentBalance: toMoney(accountsPayable.currentBalance + total),
              updatedAt: new Date(),
            })
            .where(eq(financeAccount.id, accountsPayable.id));
        }

        await tx.insert(financialLedger).values({
          amount: toMoney(total),
          balanceAfter: paymentAccount ? toMoney(balanceAfter) : null,
          balanceBefore: paymentAccount ? toMoney(balanceBefore) : null,
          description: [
            isDuePurchase ? "Product purchase due" : "Product purchase",
            input.supplier?.trim()
              ? `Supplier: ${input.supplier.trim()}`
              : null,
            input.billNo?.trim() ? `Bill: ${input.billNo.trim()}` : null,
            input.referenceNo?.trim()
              ? `Reference: ${input.referenceNo.trim()}`
              : null,
            `Items: ${validItems
              .map((item) => `${item.productName} (${item.description})`)
              .join(", ")}`,
          ]
            .filter(Boolean)
            .join(" | "),
          direction: "debit",
          entryType: isDuePurchase ? "purchase_credit" : "purchase_cash",
          ownerId,
          ownerType,
          referenceId: paymentAccount?.id ?? accountsPayable?.id ?? 0,
          referenceType: "adjustment",
        });
      });

      return {
        balanceAfter: paymentAccount ? toMoney(balanceAfter) : null,
        payableAfter: accountsPayable
          ? toMoney(accountsPayable.currentBalance + total)
          : null,
        items: validItems.map((item) => ({
          amount: toMoney(item.amount),
          description: item.description,
          productName: item.productName,
        })),
        message: isDuePurchase
          ? "Product purchase due saved and Accounts Payable updated"
          : "Product purchase saved and Profit & Loss updated",
        total: toMoney(total),
      };
    }),

  createProductSale: protectedProcedure
    .route({
      method: "POST",
      path: "/finance/product-sales/create",
      tags: ["Finance"],
      summary: "Create product sale",
      description:
        "Record a product sale, recognize Product Sales and COGS, reduce inventory, and update cash or Accounts Receivable.",
    })
    .input(
      z.object({
        customer: z.string().max(200).optional().nullable(),
        items: z
          .array(
            z.object({
              description: z.string().max(260).optional().nullable(),
              productCost: z.union([z.string(), z.number()]),
              productName: z.string().min(1).max(220),
              saleAmount: z.union([z.string(), z.number()]),
            }),
          )
          .min(1),
        notes: z.string().max(1000).optional().nullable(),
        paymentAccountId: z
          .union([z.string(), z.number()])
          .optional()
          .nullable(),
        paymentMethod: z.enum(PAYMENT_METHODS).optional().nullable(),
        paymentType: z.enum(PRODUCT_SALE_PAYMENT_TYPES).default("cash"),
        referenceNo: z.string().max(120).optional().nullable(),
        saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        saleNo: z.string().max(120).optional().nullable(),
      }),
    )
    .handler(async ({ context, input }) => {
      const ownerId = context.session.user.id;
      const ownerType = resolveOwnerScope(context.session.user.role);
      const isDueSale = input.paymentType === "due";
      const paymentAccountId = Number(input.paymentAccountId);

      await ensureDefaultFinancePaymentAccounts({ ownerId, ownerType });

      const paymentAccount = isDueSale
        ? null
        : await db.query.financePaymentAccount.findFirst({
            where: (table, { and: andFn, eq: eqFn }) =>
              andFn(
                eqFn(table.id, paymentAccountId),
                eqFn(table.ownerId, ownerId),
                eqFn(table.ownerType, ownerType),
              ),
          });

      if (!isDueSale) {
        if (!Number.isFinite(paymentAccountId)) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Select a valid payment account",
          });
        }

        if (
          !paymentAccount ||
          (paymentAccount.type !== "cash" && paymentAccount.type !== "bank")
        ) {
          throw new ORPCError("NOT_FOUND", {
            message: "Cash or bank payment account not found",
          });
        }

        if (paymentAccount.type !== input.paymentMethod) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Payment method must match the selected payment account",
          });
        }
      }

      const saleItems = buildProductSaleItems(input.items);

      if (saleItems.length === 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter at least one product sale amount",
        });
      }

      const saleTotal = saleItems.reduce(
        (sum, item) => sum + item.saleAmount,
        0,
      );
      const productCostTotal = saleItems.reduce(
        (sum, item) => sum + item.productCost,
        0,
      );
      const grossProfit = saleTotal - productCostTotal;
      const inventoryAccount = await resolveInventoryAccount({
        ownerId,
        ownerType,
      });
      const accountsReceivable = isDueSale
        ? await resolveAccountsReceivableAccount({ ownerId, ownerType })
        : null;
      const balanceBefore = paymentAccount
        ? parseMoney(paymentAccount.currentBalance)
        : 0;
      const balanceAfter = paymentAccount ? balanceBefore + saleTotal : 0;
      const receivableAfter = accountsReceivable
        ? accountsReceivable.currentBalance + saleTotal
        : null;
      const inventoryAfter = inventoryAccount.currentBalance - productCostTotal;
      const saleDescription = [
        isDueSale ? "Product sale due" : "Product sale",
        input.customer?.trim() ? `Customer: ${input.customer.trim()}` : null,
        input.saleNo?.trim() ? `Sale: ${input.saleNo.trim()}` : null,
        input.referenceNo?.trim()
          ? `Reference: ${input.referenceNo.trim()}`
          : null,
        `Payment type: ${input.paymentType}`,
        `Items: ${saleItems
          .map((item) => `${item.productName} (${item.description})`)
          .join(", ")}`,
      ]
        .filter(Boolean)
        .join(" | ");

      await db.transaction(async (tx) => {
        if (paymentAccount) {
          await tx
            .update(financePaymentAccount)
            .set({
              currentBalance: toMoney(balanceAfter),
              updatedAt: new Date(),
            })
            .where(eq(financePaymentAccount.id, paymentAccount.id));
        }

        if (accountsReceivable && receivableAfter !== null) {
          await tx
            .update(financeAccount)
            .set({
              balanceSheetLine: "accounts_receivable",
              currentBalance: toMoney(receivableAfter),
              updatedAt: new Date(),
            })
            .where(eq(financeAccount.id, accountsReceivable.id));
        }

        await tx
          .update(financeAccount)
          .set({
            balanceSheetLine: "inventory",
            currentBalance: toMoney(inventoryAfter),
            updatedAt: new Date(),
          })
          .where(eq(financeAccount.id, inventoryAccount.id));

        await tx.insert(financialLedger).values({
          amount: toMoney(saleTotal),
          balanceAfter: paymentAccount ? toMoney(balanceAfter) : null,
          balanceBefore: paymentAccount ? toMoney(balanceBefore) : null,
          description: saleDescription,
          direction: "credit",
          entryType: "sale",
          ownerId,
          ownerType,
          referenceId:
            paymentAccount?.id ?? accountsReceivable?.id ?? inventoryAccount.id,
          referenceType: "adjustment",
        });

        if (productCostTotal > 0) {
          await tx.insert(financialLedger).values({
            amount: toMoney(productCostTotal),
            balanceAfter: paymentAccount ? "0.00" : null,
            balanceBefore: paymentAccount ? "0.00" : null,
            description: `${saleDescription} | COGS`,
            direction: "debit",
            entryType: "sale",
            ownerId,
            ownerType,
            referenceId: inventoryAccount.id,
            referenceType: "adjustment",
          });
        }
      });

      return {
        balanceAfter: paymentAccount ? toMoney(balanceAfter) : null,
        grossProfit: toMoney(grossProfit),
        inventoryAfter: toMoney(inventoryAfter),
        items: saleItems.map((item) => ({
          description: item.description,
          productCost: toMoney(item.productCost),
          productName: item.productName,
          saleAmount: toMoney(item.saleAmount),
        })),
        message: isDueSale
          ? "Product sale due saved and Accounts Receivable updated"
          : "Product sale saved and Profit & Loss updated",
        receivableAfter:
          receivableAfter === null ? null : toMoney(receivableAfter),
        saleTotal: toMoney(saleTotal),
        totalCost: toMoney(productCostTotal),
      };
    }),

  createLoanReceived: protectedProcedure
    .route({
      method: "POST",
      path: "/finance/loans/received/create",
      tags: ["Finance"],
      summary: "Create loan received",
      description: "Record loan proceeds without changing Profit & Loss.",
    })
    .input(
      z.object({
        lender: z.string().max(200).optional().nullable(),
        lines: z
          .array(
            z.object({
              amount: z.union([z.string(), z.number()]),
              description: z.string().max(260).optional().nullable(),
              loanType: z.string().min(1).max(180),
            }),
          )
          .min(1),
        loanNo: z.string().max(120).optional().nullable(),
        notes: z.string().max(1000).optional().nullable(),
        paymentAccountId: z.union([z.string(), z.number()]),
        paymentMethod: z.enum(PAYMENT_METHODS),
        receiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        referenceNo: z.string().max(120).optional().nullable(),
      }),
    )
    .handler(async ({ context, input }) => {
      const ownerId = context.session.user.id;
      const ownerType = resolveOwnerScope(context.session.user.role);
      const paymentAccountId = Number(input.paymentAccountId);

      if (!Number.isFinite(paymentAccountId)) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Select a valid deposit account",
        });
      }

      await ensureDefaultFinancePaymentAccounts({ ownerId, ownerType });

      const paymentAccount = await db.query.financePaymentAccount.findFirst({
        where: (table, { and: andFn, eq: eqFn }) =>
          andFn(
            eqFn(table.id, paymentAccountId),
            eqFn(table.ownerId, ownerId),
            eqFn(table.ownerType, ownerType),
          ),
      });

      if (
        !paymentAccount ||
        (paymentAccount.type !== "cash" && paymentAccount.type !== "bank")
      ) {
        throw new ORPCError("NOT_FOUND", {
          message: "Cash or bank deposit account not found",
        });
      }

      if (paymentAccount.type !== input.paymentMethod) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Payment method must match the selected deposit account",
        });
      }

      const validLines = input.lines
        .map((line) => ({
          amount: parseMoney(line.amount),
          description: line.description?.trim() || "Loan Received",
          loanType: line.loanType.trim(),
        }))
        .filter((line) => line.amount > 0 && line.loanType.length > 0);

      if (validLines.length === 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter at least one loan amount",
        });
      }

      const loanLines: LoanReceivedLine[] = [];
      for (const line of validLines) {
        const account = await resolveLoanAccount({
          accountName: line.loanType,
          ownerId,
          ownerType,
        });

        loanLines.push({
          ...line,
          account,
        });
      }

      const total = loanLines.reduce((sum, line) => sum + line.amount, 0);
      const balanceBefore = parseMoney(paymentAccount.currentBalance);
      const balanceAfter = balanceBefore + total;
      const accountTotals = new Map<
        number,
        { currentBalance: number; total: number }
      >();

      for (const line of loanLines) {
        const existing = accountTotals.get(line.account.id);
        accountTotals.set(line.account.id, {
          currentBalance:
            existing?.currentBalance ?? line.account.currentBalance,
          total: (existing?.total ?? 0) + line.amount,
        });
      }

      await db.transaction(async (tx) => {
        await tx
          .update(financePaymentAccount)
          .set({
            currentBalance: toMoney(balanceAfter),
            updatedAt: new Date(),
          })
          .where(eq(financePaymentAccount.id, paymentAccount.id));

        for (const [accountId, account] of accountTotals) {
          await tx
            .update(financeAccount)
            .set({
              balanceSheetLine: "loan_payable",
              currentBalance: toMoney(account.currentBalance + account.total),
              updatedAt: new Date(),
            })
            .where(eq(financeAccount.id, accountId));
        }

        await tx.insert(financialLedger).values({
          amount: toMoney(total),
          balanceAfter: toMoney(balanceAfter),
          balanceBefore: toMoney(balanceBefore),
          description: [
            "Loan received",
            input.lender?.trim() ? `Lender: ${input.lender.trim()}` : null,
            input.loanNo?.trim() ? `Loan: ${input.loanNo.trim()}` : null,
            input.referenceNo?.trim()
              ? `Reference: ${input.referenceNo.trim()}`
              : null,
            `Loans: ${loanLines
              .map((line) => `${line.loanType} (${line.description})`)
              .join(", ")}`,
          ]
            .filter(Boolean)
            .join(" | "),
          direction: "credit",
          entryType: "adjustment",
          ownerId,
          ownerType,
          referenceId: paymentAccount.id,
          referenceType: "adjustment",
        });
      });

      return {
        balanceAfter: toMoney(balanceAfter),
        loans: loanLines.map((line) => ({
          accountId: String(line.account.id),
          amount: toMoney(line.amount),
          description: line.description,
          loanType: line.account.name,
        })),
        message: "Loan received saved and Balance Sheet updated",
        total: toMoney(total),
      };
    }),

  createSupplierAdvancePayment: protectedProcedure
    .route({
      method: "POST",
      path: "/finance/supplier-advances/create",
      tags: ["Finance"],
      summary: "Create supplier advance payment",
      description:
        "Record cash or bank advance paid to a supplier without changing Profit & Loss.",
    })
    .input(
      z.object({
        advanceNo: z.string().max(120).optional().nullable(),
        amount: z.union([z.string(), z.number()]),
        notes: z.string().max(1000).optional().nullable(),
        paymentAccountId: z.union([z.string(), z.number()]),
        paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        paymentMethod: z.enum(PAYMENT_METHODS),
        referenceNo: z.string().max(120).optional().nullable(),
        supplier: z.string().max(200).optional().nullable(),
      }),
    )
    .handler(async ({ context, input }) => {
      const ownerId = context.session.user.id;
      const ownerType = resolveOwnerScope(context.session.user.role);
      const paymentAccountId = Number(input.paymentAccountId);
      const amount = parseMoney(input.amount);

      if (!Number.isFinite(paymentAccountId)) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Select a valid payment account",
        });
      }

      if (amount <= 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter a supplier advance amount",
        });
      }

      await ensureDefaultFinancePaymentAccounts({ ownerId, ownerType });

      const paymentAccount = await db.query.financePaymentAccount.findFirst({
        where: (table, { and: andFn, eq: eqFn }) =>
          andFn(
            eqFn(table.id, paymentAccountId),
            eqFn(table.ownerId, ownerId),
            eqFn(table.ownerType, ownerType),
          ),
      });

      if (
        !paymentAccount ||
        (paymentAccount.type !== "cash" && paymentAccount.type !== "bank")
      ) {
        throw new ORPCError("NOT_FOUND", {
          message: "Cash or bank payment account not found",
        });
      }

      if (paymentAccount.type !== input.paymentMethod) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Payment method must match the selected payment account",
        });
      }

      const supplierAdvanceAccount = await resolveSupplierAdvanceAccount({
        ownerId,
        ownerType,
      });
      const balanceBefore = parseMoney(paymentAccount.currentBalance);
      const balanceAfter = balanceBefore - amount;
      assertSufficientPaymentBalance({
        accountName: paymentAccount.name,
        balanceBefore,
        total: amount,
      });
      const advanceAfter = supplierAdvanceAccount.currentBalance + amount;

      await db.transaction(async (tx) => {
        await tx
          .update(financePaymentAccount)
          .set({
            currentBalance: toMoney(balanceAfter),
            updatedAt: new Date(),
          })
          .where(eq(financePaymentAccount.id, paymentAccount.id));

        await tx
          .update(financeAccount)
          .set({
            balanceSheetLine: "supplier_advance",
            currentBalance: toMoney(advanceAfter),
            updatedAt: new Date(),
          })
          .where(eq(financeAccount.id, supplierAdvanceAccount.id));

        await tx.insert(financialLedger).values({
          amount: toMoney(amount),
          balanceAfter: toMoney(balanceAfter),
          balanceBefore: toMoney(balanceBefore),
          description: [
            "Supplier advance payment",
            input.supplier?.trim()
              ? `Supplier: ${input.supplier.trim()}`
              : null,
            input.advanceNo?.trim()
              ? `Advance: ${input.advanceNo.trim()}`
              : null,
            input.referenceNo?.trim()
              ? `Reference: ${input.referenceNo.trim()}`
              : null,
            `Payment account: ${paymentAccount.name}`,
          ]
            .filter(Boolean)
            .join(" | "),
          direction: "debit",
          entryType: "adjustment",
          ownerId,
          ownerType,
          referenceId: supplierAdvanceAccount.id,
          referenceType: "adjustment",
        });
      });

      return {
        advanceAfter: toMoney(advanceAfter),
        balanceAfter: toMoney(balanceAfter),
        message: "Supplier advance payment saved and Balance Sheet updated",
        supplierAdvanceAccountId: String(supplierAdvanceAccount.id),
        total: toMoney(amount),
      };
    }),

  createCustomerAdvancePayment: protectedProcedure
    .route({
      method: "POST",
      path: "/finance/customer-advances/create",
      tags: ["Finance"],
      summary: "Create customer advance payment",
      description:
        "Record cash or bank advance received from a customer without changing Profit & Loss.",
    })
    .input(
      z.object({
        advanceType: z.string().max(160).optional().nullable(),
        amount: z.union([z.string(), z.number()]),
        customer: z.string().max(200).optional().nullable(),
        customerId: z.string().max(120).optional().nullable(),
        depositAccountId: z.union([z.string(), z.number()]),
        description: z.string().max(500).optional().nullable(),
        notes: z.string().max(1000).optional().nullable(),
        paymentMethod: z.enum(PAYMENT_METHODS),
        receiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        referenceNo: z.string().max(120).optional().nullable(),
      }),
    )
    .handler(async ({ context, input }) => {
      const ownerId = context.session.user.id;
      const ownerType = resolveOwnerScope(context.session.user.role);
      const depositAccountId = Number(input.depositAccountId);
      const amount = parseMoney(input.amount);

      if (!Number.isFinite(depositAccountId)) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Select a valid deposit account",
        });
      }

      if (amount <= 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter a customer advance amount",
        });
      }

      await ensureDefaultFinancePaymentAccounts({ ownerId, ownerType });

      const depositAccount = await db.query.financePaymentAccount.findFirst({
        where: (table, { and: andFn, eq: eqFn }) =>
          andFn(
            eqFn(table.id, depositAccountId),
            eqFn(table.ownerId, ownerId),
            eqFn(table.ownerType, ownerType),
          ),
      });

      if (
        !depositAccount ||
        (depositAccount.type !== "cash" && depositAccount.type !== "bank")
      ) {
        throw new ORPCError("NOT_FOUND", {
          message: "Cash or bank deposit account not found",
        });
      }

      if (depositAccount.type !== input.paymentMethod) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Payment method must match the selected deposit account",
        });
      }

      const customerAdvanceAccount = await resolveCustomerAdvanceAccount({
        ownerId,
        ownerType,
      });
      const balanceBefore = parseMoney(depositAccount.currentBalance);
      const balanceAfter = balanceBefore + amount;
      const advanceAfter = customerAdvanceAccount.currentBalance + amount;

      await db.transaction(async (tx) => {
        await tx
          .update(financePaymentAccount)
          .set({
            currentBalance: toMoney(balanceAfter),
            updatedAt: new Date(),
          })
          .where(eq(financePaymentAccount.id, depositAccount.id));

        await tx
          .update(financeAccount)
          .set({
            balanceSheetLine: "customer_advance",
            currentBalance: toMoney(advanceAfter),
            updatedAt: new Date(),
          })
          .where(eq(financeAccount.id, customerAdvanceAccount.id));

        await tx.insert(financialLedger).values({
          amount: toMoney(amount),
          balanceAfter: toMoney(balanceAfter),
          balanceBefore: toMoney(balanceBefore),
          description: [
            "Customer advance payment",
            input.customer?.trim()
              ? `Customer: ${input.customer.trim()}`
              : null,
            input.customerId?.trim()
              ? `Customer ID: ${input.customerId.trim()}`
              : null,
            input.advanceType?.trim()
              ? `Advance type: ${input.advanceType.trim()}`
              : null,
            input.referenceNo?.trim()
              ? `Reference: ${input.referenceNo.trim()}`
              : null,
            input.description?.trim()
              ? `Description: ${input.description.trim()}`
              : null,
            `Deposit account: ${depositAccount.name}`,
          ]
            .filter(Boolean)
            .join(" | "),
          direction: "credit",
          entryType: "adjustment",
          ownerId,
          ownerType,
          referenceId: customerAdvanceAccount.id,
          referenceType: "adjustment",
        });
      });

      return {
        balanceAfter: toMoney(balanceAfter),
        customerAdvanceAccountId: String(customerAdvanceAccount.id),
        customerAdvanceAfter: toMoney(advanceAfter),
        message: "Customer advance payment saved and Balance Sheet updated",
        total: toMoney(amount),
      };
    }),

  createCategory: protectedProcedure
    .route({
      method: "POST",
      path: "/finance/categories/create",
      tags: ["Finance"],
      summary: "Create finance category",
    })
    .input(
      z.object({
        accountType: z.enum(UI_ACCOUNT_TYPES),
        name: z.string().min(1).max(160),
      }),
    )
    .handler(async ({ context, input }) => {
      const ownerId = context.session.user.id;
      const ownerType = resolveOwnerScope(context.session.user.role);
      const accountType = toDbAccountType(input.accountType);
      const name = input.name.trim();
      const baseCode = `${accountType}-${slugify(name)}`;

      const existing = await db.query.financeCategory.findFirst({
        where: (table, { and: andFn, eq: eqFn, isNull: isNullFn, or: orFn }) =>
          andFn(
            eqFn(table.accountType, accountType),
            eqFn(table.name, name),
            orFn(
              andFn(isNullFn(table.ownerId), isNullFn(table.ownerType)),
              andFn(
                eqFn(table.ownerId, ownerId),
                eqFn(table.ownerType, ownerType),
              ),
            ),
          ),
      });

      if (existing) {
        return {
          category: {
            accountType: input.accountType,
            id: String(existing.id),
            isDefault: existing.isSystem,
            name: existing.name,
          },
          message: "Category already exists",
        };
      }

      const code = await generateUniqueCode(
        financeCategory,
        ownerId,
        ownerType,
        baseCode,
      );

      const [created] = await db
        .insert(financeCategory)
        .values({
          accountType,
          code,
          description: null,
          isActive: true,
          isSystem: false,
          name,
          ownerId,
          ownerType,
          sortOrder: 900,
        })
        .returning({ id: financeCategory.id });

      if (!created) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Failed to create finance category",
        });
      }

      return {
        category: {
          accountType: input.accountType,
          id: String(created.id),
          isDefault: false,
          name,
        },
        message: "Category created",
      };
    }),

  createAccount: protectedProcedure
    .route({
      method: "POST",
      path: "/finance/accounts/create",
      tags: ["Finance"],
      summary: "Create finance account",
    })
    .input(
      z.object({
        accountType: z.enum(UI_ACCOUNT_TYPES),
        amount: z.union([z.string(), z.number()]).optional(),
        categoryId: z.union([z.string(), z.number()]),
        description: z.string().optional().nullable(),
        isSubaccount: z.boolean().optional().default(false),
        name: z.string().min(1).max(180),
        parentAccountId: z.string().optional().nullable(),
      }),
    )
    .handler(async ({ context, input }) => {
      const ownerId = context.session.user.id;
      const ownerType = resolveOwnerScope(context.session.user.role);
      const parsedCategoryId = Number(input.categoryId);
      if (!Number.isFinite(parsedCategoryId)) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Select a valid category",
        });
      }

      const category = await db.query.financeCategory.findFirst({
        where: and(
          eq(financeCategory.id, parsedCategoryId),
          or(
            and(
              isNull(financeCategory.ownerId),
              isNull(financeCategory.ownerType),
            ),
            and(
              eq(financeCategory.ownerId, ownerId),
              eq(financeCategory.ownerType, ownerType),
            ),
          ),
        ),
      });

      if (!category) {
        throw new ORPCError("NOT_FOUND", {
          message: "Finance category not found",
        });
      }

      const accountType = toDbAccountType(input.accountType);
      const name = input.name.trim();
      const baseCode = `${accountType}-${slugify(name)}`;

      const existing = await db.query.financeAccount.findFirst({
        where: (table, { and: andFn, eq: eqFn, isNull: isNullFn, or: orFn }) =>
          andFn(
            eqFn(table.accountType, accountType),
            eqFn(table.name, name),
            eqFn(table.categoryId, parsedCategoryId),
            orFn(
              andFn(isNullFn(table.ownerId), isNullFn(table.ownerType)),
              andFn(
                eqFn(table.ownerId, ownerId),
                eqFn(table.ownerType, ownerType),
              ),
            ),
          ),
      });

      if (existing) {
        if (isCashAndBankCategory(category)) {
          await ensureCashBankPaymentAccountForFinanceAccount({
            accountCode: existing.code,
            accountId: existing.id,
            accountName: existing.name,
            currentBalance: existing.currentBalance,
            openingBalance: existing.openingBalance,
            ownerId,
            ownerType,
          });
        }

        return {
          account: {
            accountType: input.accountType,
            amount: parseMoney(existing.currentBalance),
            categoryId: String(existing.categoryId),
            description: existing.description ?? "",
            id: String(existing.id),
            isSubaccount: Boolean(existing.parentAccountId),
            name: existing.name,
            parentAccountId: existing.parentAccountId
              ? String(existing.parentAccountId)
              : "",
          },
          message: "Account already exists",
        };
      }

      const code = await generateUniqueCode(
        financeAccount,
        ownerId,
        ownerType,
        baseCode,
      );
      const openingBalance = parseMoney(input.amount);
      const reportLines = resolveAccountReportLines({
        accountType,
        categoryCode: category.code,
        categoryName: category.name,
      });
      const shouldCreatePaymentAccount = isCashAndBankCategory(category);
      if (shouldCreatePaymentAccount && openingBalance < 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Cash and bank account balance cannot be less than 0",
        });
      }

      const [created] = await db
        .insert(financeAccount)
        .values({
          accountType,
          balanceSheetLine: reportLines.balanceSheetLine,
          categoryId: parsedCategoryId,
          code,
          currentBalance: String(openingBalance),
          description: input.description?.trim() || null,
          isActive: true,
          isPaymentAccount: shouldCreatePaymentAccount,
          isSystem: false,
          name,
          normalBalance:
            accountType === "liability" ||
            accountType === "equity" ||
            accountType === "income"
              ? "credit"
              : "debit",
          openingBalance: String(openingBalance),
          ownerId,
          ownerType,
          parentAccountId: null,
          profitAndLossLine: reportLines.profitAndLossLine,
          sortOrder: 900,
        })
        .returning({ id: financeAccount.id });

      if (!created) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Failed to create finance account",
        });
      }

      if (shouldCreatePaymentAccount) {
        await ensureCashBankPaymentAccountForFinanceAccount({
          accountCode: code,
          accountId: created.id,
          accountName: name,
          currentBalance: openingBalance,
          openingBalance,
          ownerId,
          ownerType,
        });
      }

      return {
        account: {
          accountType: input.accountType,
          amount: openingBalance,
          categoryId: String(parsedCategoryId),
          description: input.description?.trim() || "",
          id: String(created.id),
          isSubaccount: Boolean(input.isSubaccount),
          name,
          parentAccountId: input.parentAccountId ?? "",
        },
        message: "Account created",
      };
    }),

  updateAccount: protectedProcedure
    .route({
      method: "POST",
      path: "/finance/accounts/update",
      tags: ["Finance"],
      summary: "Update finance account",
    })
    .input(
      z.object({
        accountType: z.enum(UI_ACCOUNT_TYPES),
        amount: z.union([z.string(), z.number()]).optional(),
        categoryId: z.union([z.string(), z.number()]),
        description: z.string().optional().nullable(),
        id: z.union([z.string(), z.number()]),
        isSubaccount: z.boolean().optional().default(false),
        name: z.string().min(1).max(180),
        parentAccountId: z.string().optional().nullable(),
      }),
    )
    .handler(async ({ context, input }) => {
      const ownerId = context.session.user.id;
      const ownerType = resolveOwnerScope(context.session.user.role);
      const parsedAccountId = Number(input.id);
      const parsedCategoryId = Number(input.categoryId);

      if (!Number.isFinite(parsedAccountId)) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Select a valid account",
        });
      }

      if (!Number.isFinite(parsedCategoryId)) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Select a valid category",
        });
      }

      const account = await db.query.financeAccount.findFirst({
        where: (table, { and: andFn, eq: eqFn, isNull: isNullFn, or: orFn }) =>
          andFn(
            eqFn(table.id, parsedAccountId),
            orFn(
              andFn(isNullFn(table.ownerId), isNullFn(table.ownerType)),
              andFn(
                eqFn(table.ownerId, ownerId),
                eqFn(table.ownerType, ownerType),
              ),
            ),
          ),
      });

      if (!account) {
        throw new ORPCError("NOT_FOUND", {
          message: "Finance account not found",
        });
      }

      const category = await db.query.financeCategory.findFirst({
        where: and(
          eq(financeCategory.id, parsedCategoryId),
          or(
            and(
              isNull(financeCategory.ownerId),
              isNull(financeCategory.ownerType),
            ),
            and(
              eq(financeCategory.ownerId, ownerId),
              eq(financeCategory.ownerType, ownerType),
            ),
          ),
        ),
      });

      if (!category) {
        throw new ORPCError("NOT_FOUND", {
          message: "Finance category not found",
        });
      }

      const accountType = toDbAccountType(input.accountType);
      if (category.accountType !== accountType) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Category does not match account type",
        });
      }

      const name = input.name.trim();
      const duplicate = await db.query.financeAccount.findFirst({
        where: (table, { and: andFn, eq: eqFn, isNull: isNullFn, or: orFn }) =>
          andFn(
            ne(table.id, parsedAccountId),
            eqFn(table.accountType, accountType),
            eqFn(table.name, name),
            eqFn(table.categoryId, parsedCategoryId),
            orFn(
              andFn(isNullFn(table.ownerId), isNullFn(table.ownerType)),
              andFn(
                eqFn(table.ownerId, ownerId),
                eqFn(table.ownerType, ownerType),
              ),
            ),
          ),
      });

      if (duplicate) {
        throw new ORPCError("CONFLICT", {
          message: "Account already exists",
        });
      }

      const amount = parseMoney(input.amount);
      const reportLines = resolveAccountReportLines({
        accountType,
        categoryCode: category.code,
        categoryName: category.name,
      });
      const shouldCreatePaymentAccount = isCashAndBankCategory(category);
      if (shouldCreatePaymentAccount && amount < 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Cash and bank account balance cannot be less than 0",
        });
      }

      await db
        .update(financeAccount)
        .set({
          accountType,
          balanceSheetLine: reportLines.balanceSheetLine,
          categoryId: parsedCategoryId,
          currentBalance: String(amount),
          description: input.description?.trim() || null,
          isPaymentAccount: shouldCreatePaymentAccount,
          name,
          normalBalance:
            accountType === "liability" ||
            accountType === "equity" ||
            accountType === "income"
              ? "credit"
              : "debit",
          openingBalance: String(amount),
          parentAccountId: null,
          profitAndLossLine: reportLines.profitAndLossLine,
          updatedAt: new Date(),
        })
        .where(eq(financeAccount.id, parsedAccountId));

      if (shouldCreatePaymentAccount) {
        await ensureCashBankPaymentAccountForFinanceAccount({
          accountCode: account.code,
          accountId: parsedAccountId,
          accountName: name,
          currentBalance: amount,
          openingBalance: amount,
          ownerId,
          ownerType,
        });

        await db
          .update(financePaymentAccount)
          .set({
            currentBalance: toMoney(amount),
            isActive: true,
            name,
            openingBalance: toMoney(amount),
            type: resolveCashBankPaymentAccountType(name),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(financePaymentAccount.financeAccountId, parsedAccountId),
              eq(financePaymentAccount.ownerId, ownerId),
              eq(financePaymentAccount.ownerType, ownerType),
            ),
          );
      } else if (account.isPaymentAccount) {
        await db
          .update(financePaymentAccount)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq(financePaymentAccount.financeAccountId, parsedAccountId),
              eq(financePaymentAccount.ownerId, ownerId),
              eq(financePaymentAccount.ownerType, ownerType),
            ),
          );
      }

      return {
        account: {
          accountType: input.accountType,
          amount,
          categoryId: String(parsedCategoryId),
          description: input.description?.trim() || "",
          id: String(parsedAccountId),
          isSubaccount: Boolean(input.isSubaccount),
          name,
          parentAccountId: input.parentAccountId ?? "",
        },
        message: "Account updated",
      };
    }),
};
