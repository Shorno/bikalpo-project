import { and, eq, isNull } from "drizzle-orm";
import { db } from "./index";
import {
  assertDefaultFinanceSeeds,
  DEFAULT_FINANCE_ACCOUNT_SEEDS,
  DEFAULT_FINANCE_CATEGORY_SEEDS,
} from "./accounting-defaults";
import type { AccountingOwnerType } from "./accounting";
import {
  financeAccount,
  financeCategory,
  financePaymentAccount,
} from "./schema";

export type AccountingSeedDatabase = typeof db;

export type SeededFinanceCategoryResult = {
  created: number;
  idsByCode: Map<string, number>;
  skipped: number;
};

export type SeededFinanceAccountResult = {
  categories: SeededFinanceCategoryResult;
  created: number;
  idsByCode: Map<string, number>;
  skipped: number;
};

export type SeededFinancePaymentAccountResult = {
  accounts: SeededFinanceAccountResult;
  created: number;
  idsByCode: Map<string, number>;
  skipped: number;
};

export type SeedFinancePaymentAccountInput = {
  database?: AccountingSeedDatabase;
  ownerId: string;
  ownerType: AccountingOwnerType;
};

async function findSystemFinanceCategory(
  database: AccountingSeedDatabase,
  code: string,
) {
  const [category] = await database
    .select({
      id: financeCategory.id,
    })
    .from(financeCategory)
    .where(
      and(
        eq(financeCategory.code, code),
        isNull(financeCategory.ownerId),
        isNull(financeCategory.ownerType),
      ),
    )
    .limit(1);

  return category;
}

async function findSystemFinanceAccount(
  database: AccountingSeedDatabase,
  code: string,
) {
  const [account] = await database
    .select({
      id: financeAccount.id,
    })
    .from(financeAccount)
    .where(
      and(
        eq(financeAccount.code, code),
        isNull(financeAccount.ownerId),
        isNull(financeAccount.ownerType),
      ),
    )
    .limit(1);

  return account;
}

async function findOwnerFinancePaymentAccount(
  database: AccountingSeedDatabase,
  input: Pick<SeedFinancePaymentAccountInput, "ownerId" | "ownerType">,
  code: string,
) {
  const [paymentAccount] = await database
    .select({
      id: financePaymentAccount.id,
    })
    .from(financePaymentAccount)
    .where(
      and(
        eq(financePaymentAccount.code, code),
        eq(financePaymentAccount.ownerId, input.ownerId),
        eq(financePaymentAccount.ownerType, input.ownerType),
      ),
    )
    .limit(1);

  return paymentAccount;
}

function resolvePaymentAccountType(code: string) {
  if (code.includes("bank")) {
    return "bank";
  }

  return "cash";
}

export async function ensureDefaultFinanceCategories(
  database: AccountingSeedDatabase = db,
): Promise<SeededFinanceCategoryResult> {
  assertDefaultFinanceSeeds();

  const idsByCode = new Map<string, number>();
  let created = 0;
  let skipped = 0;

  for (const seed of DEFAULT_FINANCE_CATEGORY_SEEDS) {
    const existingCategory = await findSystemFinanceCategory(
      database,
      seed.code,
    );

    if (existingCategory) {
      idsByCode.set(seed.code, existingCategory.id);
      skipped += 1;
      continue;
    }

    const [insertedCategory] = await database
      .insert(financeCategory)
      .values({
        accountType: seed.accountType,
        code: seed.code,
        description: seed.description,
        isActive: true,
        isSystem: true,
        name: seed.name,
        ownerId: null,
        ownerType: null,
        sortOrder: seed.sortOrder,
      })
      .returning({
        id: financeCategory.id,
      });

    if (!insertedCategory) {
      throw new Error(`Failed to seed finance category ${seed.code}`);
    }

    idsByCode.set(seed.code, insertedCategory.id);
    created += 1;
  }

  return {
    created,
    idsByCode,
    skipped,
  };
}

export async function ensureDefaultFinancePaymentAccounts({
  database = db,
  ownerId,
  ownerType,
}: SeedFinancePaymentAccountInput): Promise<SeededFinancePaymentAccountResult> {
  const accounts = await ensureDefaultFinanceAccounts(database);
  const idsByCode = new Map<string, number>();
  let created = 0;
  let skipped = 0;

  for (const seed of DEFAULT_FINANCE_ACCOUNT_SEEDS.filter(
    (accountSeed) => accountSeed.isPaymentAccount,
  )) {
    const existingPaymentAccount = await findOwnerFinancePaymentAccount(
      database,
      { ownerId, ownerType },
      seed.code,
    );

    if (existingPaymentAccount) {
      idsByCode.set(seed.code, existingPaymentAccount.id);
      skipped += 1;
      continue;
    }

    const financeAccountId = accounts.idsByCode.get(seed.code);

    if (!financeAccountId) {
      throw new Error(`Missing finance account ${seed.code}`);
    }

    const [insertedPaymentAccount] = await database
      .insert(financePaymentAccount)
      .values({
        code: seed.code,
        currentBalance: seed.openingBalance,
        financeAccountId,
        isActive: true,
        isDefault: seed.code === "1001-cash-on-hand",
        name: seed.name,
        openingBalance: seed.openingBalance,
        ownerId,
        ownerType,
        type: resolvePaymentAccountType(seed.code),
      })
      .returning({
        id: financePaymentAccount.id,
      });

    if (!insertedPaymentAccount) {
      throw new Error(`Failed to seed payment account ${seed.code}`);
    }

    idsByCode.set(seed.code, insertedPaymentAccount.id);
    created += 1;
  }

  return {
    accounts,
    created,
    idsByCode,
    skipped,
  };
}

export async function ensureDefaultFinanceAccounts(
  database: AccountingSeedDatabase = db,
): Promise<SeededFinanceAccountResult> {
  const categories = await ensureDefaultFinanceCategories(database);
  const idsByCode = new Map<string, number>();
  let created = 0;
  let skipped = 0;

  for (const seed of DEFAULT_FINANCE_ACCOUNT_SEEDS) {
    const existingAccount = await findSystemFinanceAccount(database, seed.code);

    if (existingAccount) {
      idsByCode.set(seed.code, existingAccount.id);
      skipped += 1;
      continue;
    }

    const categoryId = categories.idsByCode.get(seed.categoryCode);

    if (!categoryId) {
      throw new Error(
        `Missing category ${seed.categoryCode} for finance account ${seed.code}`,
      );
    }

    const [insertedAccount] = await database
      .insert(financeAccount)
      .values({
        accountType: seed.accountType,
        balanceSheetLine: seed.balanceSheetLine ?? null,
        categoryId,
        code: seed.code,
        currentBalance: seed.openingBalance,
        description: seed.description,
        isActive: true,
        isPaymentAccount: seed.isPaymentAccount,
        isSystem: true,
        name: seed.name,
        normalBalance: seed.normalBalance,
        openingBalance: seed.openingBalance,
        ownerId: null,
        ownerType: null,
        parentAccountId: null,
        profitAndLossLine: seed.profitAndLossLine ?? null,
        sortOrder: seed.sortOrder,
      })
      .returning({
        id: financeAccount.id,
      });

    if (!insertedAccount) {
      throw new Error(`Failed to seed finance account ${seed.code}`);
    }

    idsByCode.set(seed.code, insertedAccount.id);
    created += 1;
  }

  return {
    categories,
    created,
    idsByCode,
    skipped,
  };
}
