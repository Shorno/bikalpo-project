import { ACCOUNTING_POSTING_RULES } from "@bikalpo-project/db/accounting";
import type { AccountingOwnerType } from "@bikalpo-project/db/accounting";
import {
  financeAccount,
  financePaymentAccount,
  journalEntry,
  journalLine,
} from "@bikalpo-project/db/schema";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

export type PurchaseAccountingTransaction =
  | "supplier_advance_payment"
  | "purchase_receipt"
  | "supplier_advance_applied"
  | "supplier_payment"
  | "purchase_return_due"
  | "purchase_return_paid"
  | "supplier_refund_received";

export type PurchasePostingLine = {
  accountCode: string;
  credit: number;
  debit: number;
};

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
  const accountRows = await tx.query.financeAccount.findMany({
    where: and(
      inArray(financeAccount.code, codes),
      or(
        and(
          eq(financeAccount.ownerId, input.ownerId),
          eq(financeAccount.ownerType, input.ownerType),
        ),
        and(isNull(financeAccount.ownerId), isNull(financeAccount.ownerType)),
      ),
    ),
  });
  const accountsByCode = new Map<string, (typeof accountRows)[number]>();
  for (const account of accountRows) {
    const previous = accountsByCode.get(account.code);
    if (!previous || account.ownerId === input.ownerId) {
      accountsByCode.set(account.code, account);
    }
  }

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
