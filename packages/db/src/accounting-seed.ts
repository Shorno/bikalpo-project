import { and, eq, isNull } from "drizzle-orm";
import { db } from "./index";
import {
  assertDefaultFinanceSeeds,
  DEFAULT_FINANCE_CATEGORY_SEEDS,
} from "./accounting-defaults";
import { financeCategory } from "./schema";

export type AccountingSeedDatabase = typeof db;

export type SeededFinanceCategoryResult = {
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
