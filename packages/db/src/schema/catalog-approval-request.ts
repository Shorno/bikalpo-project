import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { timestamps } from "./columns.helpers";

export const catalogApprovalRequestTypeEnum = pgEnum(
  "catalog_approval_request_type",
  ["brand", "variant_option", "core_product"],
);

export const catalogApprovalStatusEnum = pgEnum("catalog_approval_status", [
  "pending",
  "approved",
  "rejected",
]);

export type CatalogApprovalRequestPayload = Record<string, unknown>;
export type CatalogApprovalEntitySnapshot = Record<string, unknown>;

export const catalogApprovalRequest = pgTable(
  "catalog_approval_request",
  {
    id: serial("id").primaryKey(),
    requestType: catalogApprovalRequestTypeEnum("request_type").notNull(),
    status: catalogApprovalStatusEnum("status").default("pending").notNull(),
    requestedBy: text("requested_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    payload: jsonb("payload").$type<CatalogApprovalRequestPayload>().notNull(),
    adminNote: text("admin_note"),
    reviewedBy: text("reviewed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at"),
    createdEntityId: integer("created_entity_id"),
    createdEntitySnapshot: jsonb(
      "created_entity_snapshot",
    ).$type<CatalogApprovalEntitySnapshot | null>(),
    ...timestamps,
  },
  (table) => [
    index("catalogApprovalRequest_requestedBy_idx").on(table.requestedBy),
    index("catalogApprovalRequest_requestType_idx").on(table.requestType),
    index("catalogApprovalRequest_status_idx").on(table.status),
    index("catalogApprovalRequest_createdAt_idx").on(table.createdAt),
  ],
);

export const catalogApprovalRequestRelations = relations(
  catalogApprovalRequest,
  ({ one }) => ({
    requester: one(user, {
      fields: [catalogApprovalRequest.requestedBy],
      references: [user.id],
      relationName: "catalogApprovalRequestRequester",
    }),
    reviewer: one(user, {
      fields: [catalogApprovalRequest.reviewedBy],
      references: [user.id],
      relationName: "catalogApprovalRequestReviewer",
    }),
  }),
);

export type CatalogApprovalRequest = typeof catalogApprovalRequest.$inferSelect;
export type NewCatalogApprovalRequest =
  typeof catalogApprovalRequest.$inferInsert;
export type CatalogApprovalRequestType =
  (typeof catalogApprovalRequestTypeEnum.enumValues)[number];
export type CatalogApprovalStatus =
  (typeof catalogApprovalStatusEnum.enumValues)[number];
