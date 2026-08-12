import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { and, eq, isNull } from "drizzle-orm";
import { ACCOUNTING_OWNER_TYPES, type AccountingOwnerType } from "./accounting";
import {
  assertDefaultFinanceSeeds,
  DEFAULT_FINANCE_ACCOUNT_SEEDS,
  DEFAULT_FINANCE_CATEGORY_SEEDS,
} from "./accounting-defaults";
import { db } from "./index";
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

let defaultFinanceAccountsPromise: Promise<SeededFinanceAccountResult> | null =
  null;
const defaultFinancePaymentAccountsPromises = new Map<
  string,
  Promise<SeededFinancePaymentAccountResult>
>();

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

function isAccountingOwnerType(value: string): value is AccountingOwnerType {
  return ACCOUNTING_OWNER_TYPES.includes(value as AccountingOwnerType);
}

function shouldRunCli() {
  const entryPoint = process.argv[1];

  if (!entryPoint) {
    return false;
  }

  return import.meta.url === pathToFileURL(resolve(entryPoint)).href;
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
      await database
        .update(financeCategory)
        .set({
          accountType: seed.accountType,
          description: seed.description,
          isActive: true,
          isSystem: true,
          name: seed.name,
          sortOrder: seed.sortOrder,
        })
        .where(eq(financeCategory.id, existingCategory.id));

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

async function runAccountingSeedCli() {
  const ownerId = process.env.ACCOUNTING_SEED_OWNER_ID;
  const ownerType = process.env.ACCOUNTING_SEED_OWNER_TYPE ?? "shop";

  if (!isAccountingOwnerType(ownerType)) {
    throw new Error(
      `ACCOUNTING_SEED_OWNER_TYPE must be one of: ${ACCOUNTING_OWNER_TYPES.join(
        ", ",
      )}`,
    );
  }

  if (ownerId) {
    const paymentAccounts = await ensureDefaultFinancePaymentAccounts({
      ownerId,
      ownerType,
    });

    console.log(
      `Seeded finance categories: ${paymentAccounts.accounts.categories.created} created, ${paymentAccounts.accounts.categories.skipped} skipped`,
    );
    console.log(
      `Seeded finance accounts: ${paymentAccounts.accounts.created} created, ${paymentAccounts.accounts.skipped} skipped`,
    );
    console.log(
      `Seeded finance payment accounts: ${paymentAccounts.created} created, ${paymentAccounts.skipped} skipped`,
    );
    return;
  }

  const accounts = await ensureDefaultFinanceAccounts();

  console.log(
    `Seeded finance categories: ${accounts.categories.created} created, ${accounts.categories.skipped} skipped`,
  );
  console.log(
    `Seeded finance accounts: ${accounts.created} created, ${accounts.skipped} skipped`,
  );
  console.log(
    "Set ACCOUNTING_SEED_OWNER_ID to also seed owner payment accounts.",
  );
}

if (shouldRunCli()) {
  runAccountingSeedCli().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}

export async function ensureDefaultFinancePaymentAccounts({
  database = db,
  ownerId,
  ownerType,
}: SeedFinancePaymentAccountInput): Promise<SeededFinancePaymentAccountResult> {
  if (database === db) {
    const cacheKey = `${ownerType}:${ownerId}`;
    const cached = defaultFinancePaymentAccountsPromises.get(cacheKey);

    if (cached) {
      return cached;
    }

    const promise = ensureDefaultFinancePaymentAccountsUncached({
      database,
      ownerId,
      ownerType,
    }).catch((error: unknown) => {
      defaultFinancePaymentAccountsPromises.delete(cacheKey);
      throw error;
    });

    defaultFinancePaymentAccountsPromises.set(cacheKey, promise);
    return promise;
  }

  return ensureDefaultFinancePaymentAccountsUncached({
    database,
    ownerId,
    ownerType,
  });
}

async function ensureDefaultFinancePaymentAccountsUncached({
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
      await database
        .update(financePaymentAccount)
        .set({
          isActive: true,
          isDefault: seed.code === "1001-cash-on-hand",
          name: seed.name,
          type: resolvePaymentAccountType(seed.code),
        })
        .where(eq(financePaymentAccount.id, existingPaymentAccount.id));

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
  if (database === db) {
    if (defaultFinanceAccountsPromise) {
      return defaultFinanceAccountsPromise;
    }

    defaultFinanceAccountsPromise = ensureDefaultFinanceAccountsUncached(
      database,
    ).catch((error: unknown) => {
      defaultFinanceAccountsPromise = null;
      throw error;
    });

    return defaultFinanceAccountsPromise;
  }

  return ensureDefaultFinanceAccountsUncached(database);
}

async function ensureDefaultFinanceAccountsUncached(
  database: AccountingSeedDatabase = db,
): Promise<SeededFinanceAccountResult> {
  const categories = await ensureDefaultFinanceCategories(database);
  const idsByCode = new Map<string, number>();
  let created = 0;
  let skipped = 0;

  for (const seed of DEFAULT_FINANCE_ACCOUNT_SEEDS) {
    const categoryId = categories.idsByCode.get(seed.categoryCode);

    if (!categoryId) {
      throw new Error(
        `Missing category ${seed.categoryCode} for finance account ${seed.code}`,
      );
    }

    const existingAccount = await findSystemFinanceAccount(database, seed.code);

    if (existingAccount) {
      await database
        .update(financeAccount)
        .set({
          accountType: seed.accountType,
          balanceSheetLine: seed.balanceSheetLine ?? null,
          categoryId,
          description: seed.description,
          isActive: true,
          isPaymentAccount: seed.isPaymentAccount,
          isSystem: true,
          name: seed.name,
          normalBalance: seed.normalBalance,
          profitAndLossLine: seed.profitAndLossLine ?? null,
          sortOrder: seed.sortOrder,
        })
        .where(eq(financeAccount.id, existingAccount.id));

      idsByCode.set(seed.code, existingAccount.id);
      skipped += 1;
      continue;
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
