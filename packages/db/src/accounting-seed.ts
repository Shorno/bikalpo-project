import { and, eq, isNull } from "drizzle-orm";
import { db } from "./index";
import {
  assertDefaultFinanceSeeds,
  DEFAULT_FINANCE_ACCOUNT_SEEDS,
  DEFAULT_FINANCE_CATEGORY_SEEDS,
} from "./accounting-defaults";
import { financeAccount, financeCategory } from "./schema";

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
