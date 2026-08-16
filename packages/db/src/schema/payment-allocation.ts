import { relations } from "drizzle-orm";
import {
	decimal,
	index,
	integer,
	pgTable,
	serial,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { invoice } from "./invoice";
import { payment } from "./payment";

export const paymentAllocation = pgTable(
	"payment_allocation",
	{
		id: serial("id").primaryKey(),
		paymentId: integer("payment_id")
			.notNull()
			.references(() => payment.id, { onDelete: "cascade" }),
		invoiceId: integer("invoice_id")
			.notNull()
			.references(() => invoice.id, { onDelete: "restrict" }),
		amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("paymentAllocation_payment_invoice_unique").on(
			table.paymentId,
			table.invoiceId,
		),
		index("paymentAllocation_invoice_idx").on(table.invoiceId),
	],
);

export const paymentAllocationRelations = relations(
	paymentAllocation,
	({ one }) => ({
		payment: one(payment, {
			fields: [paymentAllocation.paymentId],
			references: [payment.id],
		}),
		invoice: one(invoice, {
			fields: [paymentAllocation.invoiceId],
			references: [invoice.id],
		}),
	}),
);

export type PaymentAllocation = typeof paymentAllocation.$inferSelect;
