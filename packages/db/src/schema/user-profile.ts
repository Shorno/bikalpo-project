import { relations } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const userProfile = pgTable("user_profile", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
        .notNull()
        .unique()
        .references(() => user.id, { onDelete: "cascade" }),
    // Business Information
    businessName: text("business_name"),
    ownerName: text("owner_name"),
    phoneNumber: text("phone_number"),
    vatNumber: text("vat_number"),
    address: text("address"),
    // Social Links
    facebook: text("facebook"),
    whatsapp: text("whatsapp"),
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
});

export const userProfileRelations = relations(userProfile, ({ one }) => ({
    user: one(user, {
        fields: [userProfile.userId],
        references: [user.id],
    }),
}));

export type UserProfile = typeof userProfile.$inferSelect;
export type NewUserProfile = typeof userProfile.$inferInsert;
