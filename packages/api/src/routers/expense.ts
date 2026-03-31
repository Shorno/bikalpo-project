import { db } from "@bikalpo-project/db";
import { expense, expenseCategory, financialLedger } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { localDateStamp, localDateString } from "../utils/date";

/** Generate unique expense number: EXP-YYYYMMDD-NNN */
async function generateExpenseNumber(ownerId: string): Promise<string> {
    const today = new Date();
    const dateStr = localDateStamp(today);
    const prefix = `EXP-${dateStr}-`;

    const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(expense)
        .where(and(eq(expense.ownerId, ownerId), ilike(expense.expenseNumber, `${prefix}%`)));

    const seq = (result?.count ?? 0) + 1;
    return `${prefix}${String(seq).padStart(3, "0")}`;
}

/** System-seeded expense categories */
const SYSTEM_CATEGORIES = [
    { name: "Electricity", slug: "electricity" },
    { name: "Rent", slug: "rent" },
    { name: "Salary", slug: "salary" },
    { name: "Internet", slug: "internet" },
    { name: "Fuel", slug: "fuel" },
    { name: "Maintenance", slug: "maintenance" },
    { name: "Transport", slug: "transport" },
    { name: "Miscellaneous", slug: "miscellaneous" },
];

export const expenseRouter = {
    /** Create a paid expense — immediately impacts cash & ledger */
    createExpense: protectedProcedure
        .route({
            method: "POST",
            path: "/expenses",
            tags: ["Expense Management"],
            summary: "Create expense",
            description: "Create a paid expense entry. Cash reduced immediately.",
        })
        .input(
            z.object({
                title: z.string().min(1).max(200).trim(),
                categoryId: z.number().int(),
                payeeId: z.number().int().optional().nullable(),
                amount: z.string().min(1),
                paymentDate: z.string().optional(), // ISO date string, defaults to today
                paymentMethod: z.enum(["cash", "bank", "mobile_banking"]),
                referenceNo: z.string().max(100).optional().nullable(),
                attachment: z.string().optional().nullable(),
                note: z.string().optional().nullable(),
                ownerType: z.enum(["warehouse", "shop", "restaurant"]),
            }),
        )
        .handler(async ({ context, input }) => {
            const amount = parseFloat(input.amount);
            if (isNaN(amount) || amount <= 0) {
                throw new ORPCError("BAD_REQUEST", { message: "Amount must be greater than 0" });
            }

            // Verify category exists
            const cat = await db.query.expenseCategory.findFirst({
                where: eq(expenseCategory.id, input.categoryId),
            });
            if (!cat) throw new ORPCError("NOT_FOUND", { message: "Expense category not found" });

            const expenseNumber = await generateExpenseNumber(context.session.user.id);

            // Insert expense (always paid)
            const [created] = await db
                .insert(expense)
                .values({
                    expenseNumber,
                    title: input.title,
                    categoryId: input.categoryId,
                    payeeId: input.payeeId || null,
                    amount: input.amount,
                    paymentDate: input.paymentDate || localDateString(),
                    paymentMethod: input.paymentMethod,
                    referenceNo: input.referenceNo || null,
                    attachment: input.attachment || null,
                    note: input.note || null,
                    ownerId: context.session.user.id,
                    ownerType: input.ownerType,
                })
                .returning();

            // Create financial ledger entry (debit = money going out)
            await db.insert(financialLedger).values({
                entryType: "expense",
                amount: input.amount,
                direction: "debit",
                referenceType: "expense",
                referenceId: created!.id,
                description: `Expense: ${input.title} (${cat.name})`,
                ownerId: context.session.user.id,
                ownerType: input.ownerType,
            });

            return { expense: created, message: "Expense recorded successfully" };
        }),

    /** List expenses with filters */
    getExpenses: protectedProcedure
        .route({
            method: "POST",
            path: "/expenses/list",
            tags: ["Expense Management"],
            summary: "List expenses",
        })
        .input(
            z.object({
                search: z.string().optional(),
                categoryId: z.number().int().optional(),
                startDate: z.string().optional(),
                endDate: z.string().optional(),
                page: z.number().int().min(1).default(1),
                limit: z.number().int().min(1).max(100).default(20),
            }).optional(),
        )
        .handler(async ({ context, input }) => {
            const page = input?.page ?? 1;
            const limit = input?.limit ?? 20;
            const conditions = [
                eq(expense.ownerId, context.session.user.id),
                eq(expense.isVoided, false),
            ];

            if (input?.search?.trim()) {
                conditions.push(ilike(expense.title, `%${input.search.trim()}%`));
            }
            if (input?.categoryId) {
                conditions.push(eq(expense.categoryId, input.categoryId));
            }
            if (input?.startDate) {
                conditions.push(gte(expense.paymentDate, input.startDate));
            }
            if (input?.endDate) {
                conditions.push(lte(expense.paymentDate, input.endDate));
            }

            const where = and(...conditions);
            const offset = (page - 1) * limit;

            const [rows, countResult] = await Promise.all([
                db.query.expense.findMany({
                    where,
                    orderBy: [desc(expense.paymentDate), desc(expense.createdAt)],
                    offset,
                    limit,
                    with: {
                        category: { columns: { name: true, slug: true } },
                        payeeRef: { columns: { name: true } },
                    },
                }),
                db.select({ count: sql<number>`count(*)::int` }).from(expense).where(where),
            ]);

            return { expenses: rows, total: countResult[0]?.count ?? 0 };
        }),

    /** Get single expense by ID */
    getExpenseById: protectedProcedure
        .route({
            method: "POST",
            path: "/expenses/detail",
            tags: ["Expense Management"],
            summary: "Get expense by ID",
        })
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ context, input }) => {
            const found = await db.query.expense.findFirst({
                where: and(eq(expense.id, input.id), eq(expense.ownerId, context.session.user.id)),
                with: {
                    category: true,
                    payeeRef: true,
                },
            });
            if (!found) throw new ORPCError("NOT_FOUND", { message: "Expense not found" });
            return found;
        }),

    /** Void an expense — creates reversal ledger entry, no hard delete */
    voidExpense: protectedProcedure
        .route({
            method: "POST",
            path: "/expenses/void",
            tags: ["Expense Management"],
            summary: "Void expense",
            description: "Mark expense as voided. Creates an adjustment ledger entry.",
        })
        .input(
            z.object({
                id: z.number().int(),
                reason: z.string().min(1, "Void reason is required").max(500),
            }),
        )
        .handler(async ({ context, input }) => {
            const existing = await db.query.expense.findFirst({
                where: and(
                    eq(expense.id, input.id),
                    eq(expense.ownerId, context.session.user.id),
                    eq(expense.isVoided, false),
                ),
            });
            if (!existing) throw new ORPCError("NOT_FOUND", { message: "Expense not found or already voided" });

            // Mark as voided
            await db
                .update(expense)
                .set({ isVoided: true, voidReason: input.reason, updatedAt: new Date() })
                .where(eq(expense.id, input.id));

            // Create reversal ledger entry (credit = money coming back)
            await db.insert(financialLedger).values({
                entryType: "adjustment",
                amount: existing.amount,
                direction: "credit",
                referenceType: "adjustment",
                referenceId: existing.id,
                description: `VOID: ${existing.title} — ${input.reason}`,
                ownerId: context.session.user.id,
                ownerType: existing.ownerType,
            });

            return { message: "Expense voided. Adjustment entry created." };
        }),

    /** Get expense categories (system + user custom) */
    getCategories: protectedProcedure
        .route({
            method: "POST",
            path: "/expenses/categories",
            tags: ["Expense Management"],
            summary: "Get expense categories",
        })
        .input(z.object({}).optional())
        .handler(async ({ context }) => {
            // Ensure system categories exist
            const existingSystem = await db.query.expenseCategory.findMany({
                where: eq(expenseCategory.isSystem, true),
            });

            if (existingSystem.length === 0) {
                // Seed system categories on first call
                await db.insert(expenseCategory).values(
                    SYSTEM_CATEGORIES.map((c) => ({
                        ...c,
                        isSystem: true,
                        ownerId: null,
                    })),
                );
            }

            // Return system + user's custom categories
            return db.query.expenseCategory.findMany({
                where: (c, { eq: eq2, or, isNull }) =>
                    or(eq2(c.isSystem, true), eq2(c.ownerId, context.session.user.id), isNull(c.ownerId)),
                orderBy: (c, { asc }) => [asc(c.name)],
            });
        }),

    /** Create a custom expense category */
    createCategory: protectedProcedure
        .route({
            method: "POST",
            path: "/expenses/categories/create",
            tags: ["Expense Management"],
            summary: "Create expense category",
        })
        .input(
            z.object({
                name: z.string().min(1).max(100).trim(),
                slug: z.string().min(1).max(100).trim(),
            }),
        )
        .handler(async ({ context, input }) => {
            const [created] = await db
                .insert(expenseCategory)
                .values({
                    name: input.name,
                    slug: input.slug,
                    isSystem: false,
                    ownerId: context.session.user.id,
                })
                .returning();
            return { category: created, message: "Category created" };
        }),
};
