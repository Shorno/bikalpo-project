import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const kycVerification = pgTable(
  "kyc_verification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").default("pending").notNull(), // pending | verified | failed
    adminNotes: text("admin_notes"),
    reviewedBy: text("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("kyc_verification_user_id_idx").on(table.userId),
    index("kyc_verification_status_idx").on(table.status),
  ],
);

export const kycVerificationRelations = relations(kycVerification, ({ one }) => ({
  user: one(user, {
    fields: [kycVerification.userId],
    references: [user.id],
  }),
  reviewer: one(user, {
    fields: [kycVerification.reviewedBy],
    references: [user.id],
  }),
}));
