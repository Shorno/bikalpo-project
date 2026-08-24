import type { AccountingOwnerType } from "@bikalpo-project/db/accounting";
import { ACCOUNTING_POSTING_RULES } from "@bikalpo-project/db/accounting";
import { ensureDefaultFinanceAccounts } from "@bikalpo-project/db/accounting-seed";
import {
  financeAccount,
  financePaymentAccount,
  journalEntry,
  journalLine,
} from "@bikalpo-project/db/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

export type PurchaseAccountingTransaction =
  | "supplier_advance_payment"
  | "purchase_receipt"
  | "supplier_advance_applied"
  | "supplier_advance_refunded"
  | "supplier_payment"
  | "purchase_return_due"
  | "purchase_return_paid"
  | "supplier_refund_received";

export type PurchasePostingLine = {
  accountCode: string;
  credit: number;
  debit: number;
};

export function calculatePurchaseAccountBalanceDelta(input: {
  credit: number;
  debit: number;
  normalBalance: "credit" | "debit";
}) {
  return input.normalBalance === "debit"
    ? input.debit - input.credit
    : input.credit - input.debit;
}

function toMoney(value: number) {
  return (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2);
}

function shortHash(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

async function resolveOwnerPostingAccounts(
  tx: any,
  input: {
    accountCodes: string[];
    ownerId: string;
    ownerType: AccountingOwnerType;
  },
) {
  const loadOwnerAccounts = () =>
    tx.query.financeAccount.findMany({
      where: and(
        eq(financeAccount.ownerId, input.ownerId),
        eq(financeAccount.ownerType, input.ownerType),
        inArray(financeAccount.code, input.accountCodes),
      ),
    });

  let ownerAccounts = await loadOwnerAccounts();
  const ownerCodes = new Set(
    ownerAccounts.map(
      (account: typeof financeAccount.$inferSelect) => account.code,
    ),
  );
  let missingCodes = input.accountCodes.filter((code) => !ownerCodes.has(code));

  if (missingCodes.length > 0) {
    let templates = await tx.query.financeAccount.findMany({
      where: and(
        isNull(financeAccount.ownerId),
        isNull(financeAccount.ownerType),
        inArray(financeAccount.code, missingCodes),
      ),
    });

    if (templates.length !== missingCodes.length) {
      await ensureDefaultFinanceAccounts(tx);
      templates = await tx.query.financeAccount.findMany({
        where: and(
          isNull(financeAccount.ownerId),
          isNull(financeAccount.ownerType),
          inArray(financeAccount.code, missingCodes),
        ),
      });
    }

    const templatesByCode = new Map<string, typeof financeAccount.$inferSelect>(
      templates.map(
        (
          account: typeof financeAccount.$inferSelect,
        ): [string, typeof financeAccount.$inferSelect] => [
          account.code,
          account,
        ],
      ),
    );
    for (const code of missingCodes) {
      const template = templatesByCode.get(code);
      if (!template) {
        throw new Error(`Finance account ${code} is not configured`);
      }

      await tx
        .insert(financeAccount)
        .values({
          accountType: template.accountType,
          balanceSheetLine: template.balanceSheetLine,
          categoryId: template.categoryId,
          code: template.code,
          currentBalance: "0.00",
          description: template.description,
          isActive: true,
          isPaymentAccount: template.isPaymentAccount,
          isSystem: false,
          name: template.name,
          normalBalance: template.normalBalance,
          openingBalance: "0.00",
          ownerId: input.ownerId,
          ownerType: input.ownerType,
          parentAccountId: null,
          profitAndLossLine: template.profitAndLossLine,
          sortOrder: template.sortOrder,
        })
        .onConflictDoNothing({
          target: [
            financeAccount.ownerId,
            financeAccount.ownerType,
            financeAccount.code,
          ],
        });
    }

    ownerAccounts = await loadOwnerAccounts();
    const refreshedCodes = new Set(
      ownerAccounts.map(
        (account: typeof financeAccount.$inferSelect) => account.code,
      ),
    );
    missingCodes = input.accountCodes.filter(
      (code) => !refreshedCodes.has(code),
    );
    if (missingCodes.length > 0) {
      throw new Error(
        `Finance accounts are not configured for this business: ${missingCodes.join(", ")}`,
      );
    }
  }

  return new Map<string, typeof financeAccount.$inferSelect>(
    ownerAccounts.map(
      (
        account: typeof financeAccount.$inferSelect,
      ): [string, typeof financeAccount.$inferSelect] => [
        account.code,
        account,
      ],
    ),
  );
}

export function buildPurchasePosting(input: {
  amount: number;
  transactionType: PurchaseAccountingTransaction;
}): PurchasePostingLine[] {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Purchase posting amount must be greater than zero");
  }

  const rule = ACCOUNTING_POSTING_RULES[input.transactionType];
  const amount = Number(toMoney(input.amount));
  const lines = rule.lines.map((line) => ({
    accountCode: line.accountCode,
    credit: line.side === "credit" ? amount : 0,
    debit: line.side === "debit" ? amount : 0,
  }));

  const debit = lines.reduce((sum, line) => sum + line.debit, 0);
  const credit = lines.reduce((sum, line) => sum + line.credit, 0);
  if (toMoney(debit) !== toMoney(credit)) {
    throw new Error(`Unbalanced purchase posting for ${input.transactionType}`);
  }

  return lines;
}

export async function postPurchaseJournal(
  tx: any,
  input: {
    actorId?: string | null;
    amount: number;
    idempotencyKey: string;
    memo: string;
    ownerId: string;
    ownerType: AccountingOwnerType;
    paymentAccountId?: number | null;
    sourceId: string;
    sourceType: "payment" | "purchase" | "purchase_event" | "purchase_return";
    transactionDate: string;
    transactionType: PurchaseAccountingTransaction;
  },
) {
  const posting = buildPurchasePosting(input);
  const journalNumber = `PJ-${shortHash(`${input.ownerType}:${input.ownerId}`)}-${shortHash(input.idempotencyKey)}`;

  const existing = await tx.query.journalEntry.findFirst({
    where: eq(journalEntry.journalNumber, journalNumber),
  });
  if (existing) return existing;

  const paymentAccount = input.paymentAccountId
    ? await tx.query.financePaymentAccount.findFirst({
        where: and(
          eq(financePaymentAccount.id, input.paymentAccountId),
          eq(financePaymentAccount.ownerId, input.ownerId),
          eq(financePaymentAccount.ownerType, input.ownerType),
          eq(financePaymentAccount.isActive, true),
        ),
        with: { financeAccount: true },
      })
    : null;

  const codes = [...new Set(posting.map((line) => line.accountCode))];
  const accountsByCode = await resolveOwnerPostingAccounts(tx, {
    accountCodes: codes,
    ownerId: input.ownerId,
    ownerType: input.ownerType,
  });

  const resolvedLines = posting.map((line) => {
    const account =
      line.accountCode === "1001-cash-on-hand" && paymentAccount?.financeAccount
        ? paymentAccount.financeAccount
        : accountsByCode.get(line.accountCode);
    if (!account) {
      throw new Error(`Finance account ${line.accountCode} is not configured`);
    }
    return { account, ...line };
  });

  if (paymentAccount) {
    const cashLine = resolvedLines.find(
      (line) => line.account.id === paymentAccount.financeAccountId,
    );
    if (!cashLine) {
      throw new Error("Selected payment account is not used by this posting");
    }
    const delta = cashLine.debit - cashLine.credit;
    const updated = await tx
      .update(financePaymentAccount)
      .set({
        currentBalance: sql`${financePaymentAccount.currentBalance}::numeric + ${delta}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(financePaymentAccount.id, paymentAccount.id),
          delta >= 0
            ? sql`true`
            : sql`${financePaymentAccount.currentBalance}::numeric >= ${Math.abs(delta)}`,
        ),
      )
      .returning({ id: financePaymentAccount.id });
    if (updated.length === 0) {
      throw new Error(`${paymentAccount.name} has insufficient balance`);
    }
  }

  for (const line of resolvedLines) {
    const delta = calculatePurchaseAccountBalanceDelta({
      credit: line.credit,
      debit: line.debit,
      normalBalance: line.account.normalBalance,
    });
    await tx
      .update(financeAccount)
      .set({
        currentBalance: sql`${financeAccount.currentBalance}::numeric + ${delta}`,
        updatedAt: new Date(),
      })
      .where(eq(financeAccount.id, line.account.id));
  }

  const [created] = await tx
    .insert(journalEntry)
    .values({
      journalNumber,
      ownerId: input.ownerId,
      ownerType: input.ownerType,
      transactionType: input.transactionType,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      transactionDate: input.transactionDate,
      memo: input.memo,
      status: "posted",
      createdById: input.actorId ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to create purchase journal");

  await tx.insert(journalLine).values(
    resolvedLines.map((line, index) => ({
      journalEntryId: created.id,
      financeAccountId: line.account.id,
      accountCode: line.account.code,
      accountName: line.account.name,
      accountType: line.account.accountType,
      normalBalance: line.account.normalBalance,
      debit: toMoney(line.debit),
      credit: toMoney(line.credit),
      memo: input.memo,
      lineOrder: index + 1,
    })),
  );

  return created;
}
