import {
	financeAccount,
	financePaymentAccount,
	financialLedger,
	journalEntry,
	journalLine,
} from "@bikalpo-project/db/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

type PaymentPostingLine = {
	kind: "payment";
	paymentAccountId: number;
	debit: number;
	credit: number;
};

type NamedPostingLine = {
	kind: "receivable" | "sales";
	debit: number;
	credit: number;
};

export type WarehousePosPostingLine = PaymentPostingLine | NamedPostingLine;

type PaymentAccountWithFinance = typeof financePaymentAccount.$inferSelect & {
	financeAccount: typeof financeAccount.$inferSelect;
};

type Database = typeof import("@bikalpo-project/db")["db"];
type WarehousePosTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

export function buildWarehousePosPosting(input: {
	total: number;
	due: number;
	payments: Array<{ paymentAccountId: number; appliedAmount: number }>;
}): WarehousePosPostingLine[] {
	const total = Number(input.total.toFixed(2));
	const due = Number(input.due.toFixed(2));
	const applied = Number(
		input.payments
			.reduce((sum, payment) => sum + payment.appliedAmount, 0)
			.toFixed(2),
	);
	if (Number((applied + due).toFixed(2)) !== total) {
		throw new Error("Warehouse POS payment and due amounts do not reconcile");
	}

	return [
		...input.payments
			.filter((payment) => payment.appliedAmount > 0)
			.map((payment) => ({
				kind: "payment" as const,
				paymentAccountId: payment.paymentAccountId,
				debit: Number(payment.appliedAmount.toFixed(2)),
				credit: 0,
			})),
		...(due > 0
			? [{ kind: "receivable" as const, debit: due, credit: 0 }]
			: []),
		{ kind: "sales" as const, debit: 0, credit: total },
	];
}

function toMoney(value: number) {
	return (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2);
}

async function resolveOwnerAccount(
	tx: WarehousePosTransaction,
	input: { code: string; ownerId: string },
) {
	const load = () =>
		tx.query.financeAccount.findFirst({
			where: and(
				eq(financeAccount.code, input.code),
				eq(financeAccount.ownerId, input.ownerId),
				eq(financeAccount.ownerType, "warehouse"),
			),
		});
	let account = await load();
	if (account) return account;

	const { ensureDefaultFinanceAccounts } = await import(
		"@bikalpo-project/db/accounting-seed"
	);
	await ensureDefaultFinanceAccounts(tx as unknown as Database);
	const template = await tx.query.financeAccount.findFirst({
		where: and(
			eq(financeAccount.code, input.code),
			isNull(financeAccount.ownerId),
			isNull(financeAccount.ownerType),
		),
	});
	if (!template)
		throw new Error(`Finance account ${input.code} is not configured`);

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
			ownerType: "warehouse",
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
	account = await load();
	if (!account)
		throw new Error(`Could not create finance account ${input.code}`);
	return account;
}

export async function postWarehousePosSaleAccounting(
	tx: WarehousePosTransaction,
	input: {
		actorId: string;
		due: number;
		invoiceNo: string;
		ownerId: string;
		payments: Array<{
			appliedAmount: number;
			paymentAccountId: number;
		}>;
		saleDate: string;
		saleId: number;
		total: number;
	},
) {
	const journalNumber = `WPOS-${input.saleId}`;
	const existing = await tx.query.journalEntry.findFirst({
		where: eq(journalEntry.journalNumber, journalNumber),
	});
	if (existing) return existing;

	const posting = buildWarehousePosPosting(input);
	const paymentAccountIds = input.payments.map(
		(payment) => payment.paymentAccountId,
	);
	const paymentAccounts = (
		paymentAccountIds.length
			? await tx.query.financePaymentAccount.findMany({
					where: and(
						inArray(financePaymentAccount.id, paymentAccountIds),
						eq(financePaymentAccount.ownerId, input.ownerId),
						eq(financePaymentAccount.ownerType, "warehouse"),
						eq(financePaymentAccount.isActive, true),
					),
					with: { financeAccount: true },
				})
			: []
	) as PaymentAccountWithFinance[];
	const paymentAccountById = new Map<number, PaymentAccountWithFinance>(
		paymentAccounts.map((account) => [account.id, account]),
	);
	if (paymentAccountById.size !== new Set(paymentAccountIds).size) {
		throw new Error("Select active payment accounts owned by this warehouse");
	}

	const receivableAccount =
		input.due > 0
			? await resolveOwnerAccount(tx, {
					code: "1101-accounts-receivable",
					ownerId: input.ownerId,
				})
			: null;
	const salesAccount = await resolveOwnerAccount(tx, {
		code: "4004-wholesale-sales",
		ownerId: input.ownerId,
	});
	const resolvedLines = posting.map((line) => {
		const account =
			line.kind === "payment"
				? paymentAccountById.get(line.paymentAccountId)?.financeAccount
				: line.kind === "receivable"
					? receivableAccount
					: salesAccount;
		if (!account)
			throw new Error(`Finance account for ${line.kind} is not configured`);
		return { ...line, account };
	});

	for (const payment of input.payments.filter(
		(candidate) => candidate.appliedAmount > 0,
	)) {
		const account = paymentAccountById.get(payment.paymentAccountId);
		if (!account) {
			throw new Error("Payment account is not configured for this warehouse");
		}
		const [updated] = await tx
			.update(financePaymentAccount)
			.set({
				currentBalance: sql`${financePaymentAccount.currentBalance}::numeric + ${payment.appliedAmount}`,
				updatedAt: new Date(),
			})
			.where(eq(financePaymentAccount.id, account.id))
			.returning({ currentBalance: financePaymentAccount.currentBalance });
		const balanceAfter = Number(updated?.currentBalance ?? 0);
		await tx.insert(financialLedger).values({
			amount: toMoney(payment.appliedAmount),
			balanceAfter: toMoney(balanceAfter),
			balanceBefore: toMoney(balanceAfter - payment.appliedAmount),
			description: `Warehouse POS sale ${input.invoiceNo} | Payment account: ${account.name}`,
			direction: "credit",
			entryType: "sale",
			ownerId: input.ownerId,
			ownerType: "warehouse",
			referenceId: account.id,
			referenceType: "adjustment",
		});
	}

	for (const line of resolvedLines) {
		const delta =
			line.account.normalBalance === "debit"
				? line.debit - line.credit
				: line.credit - line.debit;
		await tx
			.update(financeAccount)
			.set({
				currentBalance: sql`${financeAccount.currentBalance}::numeric + ${delta}`,
				updatedAt: new Date(),
			})
			.where(eq(financeAccount.id, line.account.id));
	}

	if (receivableAccount && input.due > 0) {
		const refreshed = await tx.query.financeAccount.findFirst({
			where: eq(financeAccount.id, receivableAccount.id),
		});
		const balanceAfter = Number(refreshed?.currentBalance ?? 0);
		await tx.insert(financialLedger).values({
			amount: toMoney(input.due),
			balanceAfter: toMoney(balanceAfter),
			balanceBefore: toMoney(balanceAfter - input.due),
			description: `Warehouse POS sale ${input.invoiceNo} | Accounts Receivable`,
			direction: "debit",
			entryType: "sale",
			ownerId: input.ownerId,
			ownerType: "warehouse",
			referenceId: receivableAccount.id,
			referenceType: "adjustment",
		});
	}

	const refreshedSales = await tx.query.financeAccount.findFirst({
		where: eq(financeAccount.id, salesAccount.id),
	});
	const salesBalanceAfter = Number(refreshedSales?.currentBalance ?? 0);
	await tx.insert(financialLedger).values({
		amount: toMoney(input.total),
		balanceAfter: toMoney(salesBalanceAfter),
		balanceBefore: toMoney(salesBalanceAfter - input.total),
		description: `Warehouse POS sale ${input.invoiceNo} | Wholesale Sales`,
		direction: "credit",
		entryType: "sale",
		ownerId: input.ownerId,
		ownerType: "warehouse",
		referenceId: salesAccount.id,
		referenceType: "adjustment",
	});

	const [created] = await tx
		.insert(journalEntry)
		.values({
			journalNumber,
			ownerId: input.ownerId,
			ownerType: "warehouse",
			transactionType: input.due > 0 ? "product_sale_due" : "product_sale_cash",
			sourceType: "adjustment",
			sourceId: String(input.saleId),
			transactionDate: input.saleDate,
			memo: `Warehouse POS sale ${input.invoiceNo}`,
			status: "posted",
			createdById: input.actorId,
		})
		.returning();
	if (!created) throw new Error("Could not create warehouse POS journal");

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
			memo: `Warehouse POS sale ${input.invoiceNo}`,
			lineOrder: index + 1,
		})),
	);

	return created;
}
