import { relations } from "drizzle-orm";
import {
	index,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { deliveryArea } from "./delivery-area";

// Links each warehouse salesman to one delivery area.
export const salesmanAreaAssignment = pgTable(
	"salesman_area_assignment",
	{
		id: serial("id").primaryKey(),
		warehouseId: text("warehouse_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		salesmanId: text("salesman_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		areaId: integer("area_id")
			.notNull()
			.references(() => deliveryArea.id, { onDelete: "cascade" }),
		assignedAt: timestamp("assigned_at").defaultNow().notNull(),
		assignedBy: text("assigned_by").references(() => user.id, {
			onDelete: "set null",
		}),
	},
	(table) => [
		index("salesman_area_assignment_warehouse_idx").on(table.warehouseId),
		index("salesman_area_assignment_area_idx").on(table.areaId),
		unique("salesman_area_assignment_salesman_unique").on(table.salesmanId),
	],
);

export const salesmanAreaAssignmentRelations = relations(
	salesmanAreaAssignment,
	({ one }) => ({
		warehouse: one(user, {
			fields: [salesmanAreaAssignment.warehouseId],
			references: [user.id],
			relationName: "salesmanAreaWarehouse",
		}),
		salesman: one(user, {
			fields: [salesmanAreaAssignment.salesmanId],
			references: [user.id],
			relationName: "salesmanAreaSalesman",
		}),
		area: one(deliveryArea, {
			fields: [salesmanAreaAssignment.areaId],
			references: [deliveryArea.id],
		}),
		assignedByUser: one(user, {
			fields: [salesmanAreaAssignment.assignedBy],
			references: [user.id],
			relationName: "salesmanAreaAssignedBy",
		}),
	}),
);

export type SalesmanAreaAssignment = typeof salesmanAreaAssignment.$inferSelect;
export type NewSalesmanAreaAssignment =
	typeof salesmanAreaAssignment.$inferInsert;
