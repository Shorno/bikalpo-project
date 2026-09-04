import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

/** A retailer-defined named role scoped to exactly one shop. */
export const shopRole = pgTable(
  "shop_role",
  {
    id: serial("id").primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    isSystem: boolean("is_system").default(false).notNull(),
    legacyFunction: text("legacy_function"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shopRole_shop_name_unique").on(table.shopId, table.name),
    uniqueIndex("shopRole_shop_legacy_function_unique").on(
      table.shopId,
      table.legacyFunction,
    ).where(sql`${table.legacyFunction} is not null`),
    index("shopRole_shop_idx").on(table.shopId),
  ],
);

/** Better Auth resource/action grants attached to one shop role. */
export const shopRolePermission = pgTable(
  "shop_role_permission",
  {
    roleId: integer("role_id")
      .notNull()
      .references(() => shopRole.id, { onDelete: "cascade" }),
    resource: text("resource").notNull(),
    actions: text("actions").array().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.resource] }),
    index("shopRolePermission_role_idx").on(table.roleId),
  ],
);

/** One named role per shop staff member for a predictable initial model. */
export const shopUserRole = pgTable(
  "shop_user_role",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    shopId: text("shop_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => shopRole.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("shopUserRole_shop_idx").on(table.shopId),
    index("shopUserRole_role_idx").on(table.roleId),
  ],
);

/** Immutable record of role definition and assignment changes. */
export const shopPermissionAudit = pgTable(
  "shop_permission_audit",
  {
    id: serial("id").primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roleId: integer("role_id").references(() => shopRole.id, {
      onDelete: "set null",
    }),
    changedByUserId: text("changed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    event: text("event").notNull(),
    subjectUserId: text("subject_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    before: jsonb("before").$type<Record<string, unknown> | null>(),
    after: jsonb("after").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("shopPermissionAudit_shop_created_idx").on(
      table.shopId,
      table.createdAt,
    ),
  ],
);

export const shopRoleRelations = relations(shopRole, ({ one, many }) => ({
  shop: one(user, {
    fields: [shopRole.shopId],
    references: [user.id],
  }),
  permissions: many(shopRolePermission),
  assignments: many(shopUserRole),
}));

export const shopRolePermissionRelations = relations(
  shopRolePermission,
  ({ one }) => ({
    role: one(shopRole, {
      fields: [shopRolePermission.roleId],
      references: [shopRole.id],
    }),
  }),
);

export const shopUserRoleRelations = relations(shopUserRole, ({ one }) => ({
  user: one(user, {
    fields: [shopUserRole.userId],
    references: [user.id],
    relationName: "assignedShopRole",
  }),
  shop: one(user, {
    fields: [shopUserRole.shopId],
    references: [user.id],
    relationName: "shopRoleAssignments",
  }),
  role: one(shopRole, {
    fields: [shopUserRole.roleId],
    references: [shopRole.id],
  }),
}));

export type ShopRole = typeof shopRole.$inferSelect;
export type NewShopRole = typeof shopRole.$inferInsert;
export type ShopRolePermission = typeof shopRolePermission.$inferSelect;
export type ShopUserRole = typeof shopUserRole.$inferSelect;
