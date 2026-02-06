import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

// Customer assignment table - links customers to salesmen
export const customerAssignment = pgTable(
  "customer_assignment",
  {
    id: serial("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    salesmanId: text("salesman_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
    assignedBy: text("assigned_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("customer_assignment_customer_idx").on(table.customerId),
    index("customer_assignment_salesman_idx").on(table.salesmanId),
    // Ensure each customer is only assigned to one salesman
    unique("customer_assignment_unique").on(table.customerId),
  ],
);

// Relations
export const customerAssignmentRelations = relations(
  customerAssignment,
  ({ one }) => ({
    customer: one(user, {
      fields: [customerAssignment.customerId],
      references: [user.id],
      relationName: "customerAssignments",
    }),
    salesman: one(user, {
      fields: [customerAssignment.salesmanId],
      references: [user.id],
      relationName: "salesmanAssignments",
    }),
    assignedByUser: one(user, {
      fields: [customerAssignment.assignedBy],
      references: [user.id],
      relationName: "assignmentsMade",
    }),
  }),
);

// Types
export type CustomerAssignment = typeof customerAssignment.$inferSelect;
export type NewCustomerAssignment = typeof customerAssignment.$inferInsert;
