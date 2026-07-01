import { auth, setCredentialPassword } from "@bikalpo-project/auth";
import { db } from "@bikalpo-project/db";
import {
	customerAssignment,
	deliveryArea,
	deliveryGroup,
	deliveryGroupInvoice,
	invoice,
	salesmanAreaAssignment,
	shopWarehouseConnection,
	user,
	warehouseWarehouseConnection,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import { z } from "zod";

import { warehouseProcedure } from "../index";

// ────────────────────────────────────────────────────────────────
// Schemas
// ────────────────────────────────────────────────────────────────

const employeeRoleSchema = z.enum(["salesman", "deliveryman"]);

const createEmployeeSchema = z.object({
	name: z.string().min(2).max(100).trim(),
	email: z.string().email().trim(),
	password: z.string().min(8).max(100),
	phoneNumber: z.string().max(20).optional(),
	role: employeeRoleSchema,
});

const updateEmployeeSchema = z.object({
	id: z.string(),
	name: z.string().min(2).max(100).trim().optional(),
	phoneNumber: z.string().max(20).optional(),
});

const resetPasswordSchema = z.object({
	userId: z.string(),
	newPassword: z.string().min(8).max(100),
});

const toggleBanSchema = z.object({
	userId: z.string(),
	banned: z.boolean(),
	reason: z.string().optional(),
});

const deleteEmployeeSchema = z.object({
	id: z.string(),
});

const assignSalesmanAreaSchema = z.object({
	salesmanId: z.string(),
	areaId: z.number().int().positive(),
});

const getAssignableSalesmanCustomersSchema = z.object({
	salesmanId: z.string(),
	search: z.string().trim().max(100).optional(),
});

const assignSalesmanCustomersSchema = z.object({
	salesmanId: z.string(),
	customerIds: z.array(z.string()).min(1, "Select at least one customer"),
});

type WarehouseCustomerType = "retailer" | "warehouse";

type WarehouseCustomerSource = {
	id: string;
	customerType: WarehouseCustomerType;
	connectionId: number;
	displayName: string;
	contactName: string;
	email: string;
	phoneNumber: string | null;
	address: string | null;
	connectedAt: Date | null;
};

async function getWarehouseCustomerSources({
	warehouseId,
	customerIds,
	search,
}: {
	warehouseId: string;
	customerIds?: string[];
	search?: string;
}) {
	const normalizedSearch = search?.trim().toLowerCase();

	const retailerConditions: SQL[] = [
		eq(shopWarehouseConnection.warehouseId, warehouseId),
		eq(shopWarehouseConnection.status, "active"),
	];
	const warehouseConditions: SQL[] = [
		eq(warehouseWarehouseConnection.supplierWarehouseId, warehouseId),
		eq(warehouseWarehouseConnection.status, "active"),
	];

	if (customerIds?.length) {
		retailerConditions.push(inArray(shopWarehouseConnection.shopId, customerIds));
		warehouseConditions.push(
			inArray(warehouseWarehouseConnection.buyerWarehouseId, customerIds),
		);
	}

	if (normalizedSearch) {
		const searchPattern = `%${normalizedSearch}%`;
		retailerConditions.push(
			sql`(LOWER(COALESCE(${user.shopName}, '')) LIKE ${searchPattern} OR LOWER(${user.name}) LIKE ${searchPattern} OR COALESCE(${user.phoneNumber}, '') LIKE ${searchPattern})`,
		);
		warehouseConditions.push(
			sql`(LOWER(COALESCE(${user.warehouseName}, '')) LIKE ${searchPattern} OR LOWER(${user.name}) LIKE ${searchPattern} OR COALESCE(${user.phoneNumber}, '') LIKE ${searchPattern})`,
		);
	}

	const [retailers, warehouses] = await Promise.all([
		db
			.select({
				id: user.id,
				customerType: sql<WarehouseCustomerType>`'retailer'`,
				connectionId: shopWarehouseConnection.id,
				displayName: sql<string>`COALESCE(${user.shopName}, ${user.name})`,
				contactName: user.name,
				email: user.email,
				phoneNumber: user.phoneNumber,
				address: user.shopAddress,
				connectedAt: shopWarehouseConnection.connectedAt,
			})
			.from(shopWarehouseConnection)
			.innerJoin(user, eq(shopWarehouseConnection.shopId, user.id))
			.where(and(...retailerConditions)),
		db
			.select({
				id: user.id,
				customerType: sql<WarehouseCustomerType>`'warehouse'`,
				connectionId: warehouseWarehouseConnection.id,
				displayName: sql<string>`COALESCE(${user.warehouseName}, ${user.name})`,
				contactName: user.name,
				email: user.email,
				phoneNumber: user.phoneNumber,
				address: user.warehouseAddress,
				connectedAt: warehouseWarehouseConnection.connectedAt,
			})
			.from(warehouseWarehouseConnection)
			.innerJoin(
				user,
				eq(warehouseWarehouseConnection.buyerWarehouseId, user.id),
			)
			.where(and(...warehouseConditions)),
	]);

	return [...retailers, ...warehouses]
		.map((customer) => ({
			...customer,
			displayName: customer.displayName || customer.contactName,
		}))
		.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

async function getSalesmanOrThrow(warehouseId: string, salesmanId: string) {
	const [salesman] = await db
		.select({ id: user.id })
		.from(user)
		.where(
			and(
				eq(user.id, salesmanId),
				eq(user.warehouseId, warehouseId),
				eq(user.role, "salesman"),
			),
		);

	if (!salesman) {
		throw new ORPCError("NOT_FOUND", { message: "Salesman not found" });
	}

	return salesman;
}

async function withAssignmentStatus(
	customers: WarehouseCustomerSource[],
	warehouseId: string,
	salesmanId: string,
) {
	if (customers.length === 0) return [];

	const customerIds = customers.map((customer) => customer.id);
	const assignments = await db
		.select({
			customerId: customerAssignment.customerId,
			salesmanId: customerAssignment.salesmanId,
		})
		.from(customerAssignment)
		.where(
			and(
				eq(customerAssignment.warehouseId, warehouseId),
				inArray(customerAssignment.customerId, customerIds),
			),
		);

	const salesmanIds = Array.from(
		new Set(assignments.map((assignment) => assignment.salesmanId)),
	);
	const assignedSalesmen =
		salesmanIds.length > 0
			? await db
					.select({ id: user.id, name: user.name })
					.from(user)
					.where(inArray(user.id, salesmanIds))
			: [];

	const salesmanNameById = new Map(
		assignedSalesmen.map((salesman) => [salesman.id, salesman.name]),
	);
	const assignmentByCustomerId = new Map(
		assignments.map((assignment) => [assignment.customerId, assignment]),
	);

	return customers.map((customer) => {
		const assignment = assignmentByCustomerId.get(customer.id);
		const assignedSalesmanId = assignment?.salesmanId ?? null;
		const isAssignedToThisSalesman = assignedSalesmanId === salesmanId;

		return {
			...customer,
			assignedSalesmanId,
			assignedSalesmanName: assignedSalesmanId
				? salesmanNameById.get(assignedSalesmanId) ?? "Assigned salesman"
				: null,
			isAssigned: Boolean(assignedSalesmanId),
			isAssignedToThisSalesman,
			isAssignable: !assignedSalesmanId,
		};
	});
}

// ────────────────────────────────────────────────────────────────
// Router
// ────────────────────────────────────────────────────────────────

export const warehouseEmployeeRouter = {
	/**
	 * Get all employees (both salesmen and deliverymen) for this warehouse
	 */
	getAll: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/employees",
			tags: ["Warehouse Employee Management"],
			summary: "Get all warehouse employees",
			description:
				"Get all salesmen and deliverymen belonging to this warehouse",
		})
		.handler(async ({ context }) => {
			const warehouseId = context.session.user.id;

			const employees = await db
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					phoneNumber: user.phoneNumber,
					role: user.role,
					createdAt: user.createdAt,
					banned: user.banned,
				})
				.from(user)
				.where(
					and(
						eq(user.warehouseId, warehouseId),
						inArray(user.role, ["deliveryman", "salesman"]),
					),
				)
				.orderBy(user.name);

			const stats = {
				total: employees.length,
				deliverymen: employees.filter((e) => e.role === "deliveryman").length,
				salesmen: employees.filter((e) => e.role === "salesman").length,
				active: employees.filter((e) => !e.banned).length,
			};

			return {
				employees: employees.map((e) => ({
					...e,
					role: e.role || "unknown",
					banned: e.banned || false,
				})),
				stats,
			};
		}),

	/**
	 * Get salesmen for this warehouse with estimate and customer counts
	 */
	getSalesmen: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/employees/salesmen",
			tags: ["Warehouse Employee Management"],
			summary: "Get warehouse salesmen",
			description: "Get all salesmen belonging to this warehouse with stats",
		})
		.handler(async ({ context }) => {
			const warehouseId = context.session.user.id;

			const salesmenData = await db
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					phoneNumber: user.phoneNumber,
					createdAt: user.createdAt,
					banned: user.banned,
					assignedAreaId: deliveryArea.id,
					assignedAreaName: deliveryArea.name,
					assignedAreaStatus: deliveryArea.status,
					estimatesCount: sql<number>`COALESCE((
                        SELECT COUNT(*)::int FROM estimate WHERE estimate.salesman_id = "user"."id"
                    ), 0)`,
					assignedCustomersCount: sql<number>`COALESCE((
                        SELECT COUNT(*)::int FROM customer_assignment
                        WHERE customer_assignment.salesman_id = "user"."id"
                        AND customer_assignment.warehouse_id = ${warehouseId}
                    ), 0)`,
				})
				.from(user)
				.leftJoin(
					salesmanAreaAssignment,
					and(
						eq(salesmanAreaAssignment.salesmanId, user.id),
						eq(salesmanAreaAssignment.warehouseId, warehouseId),
					),
				)
				.leftJoin(
					deliveryArea,
					and(
						eq(deliveryArea.id, salesmanAreaAssignment.areaId),
						eq(deliveryArea.warehouseId, warehouseId),
					),
				)
				.where(
					and(eq(user.warehouseId, warehouseId), eq(user.role, "salesman")),
				)
				.orderBy(user.name);

			const totalEstimates = salesmenData.reduce(
				(sum, s) => sum + (s.estimatesCount || 0),
				0,
			);
			const activeCount = salesmenData.filter((s) => !s.banned).length;
			const assignedSalesmen = salesmenData.filter(
				(s) => s.assignedAreaId !== null,
			).length;
			const assignedCustomers = salesmenData.reduce(
				(sum, s) => sum + (s.assignedCustomersCount || 0),
				0,
			);

			return {
				salesmen: salesmenData.map((s) => ({
					id: s.id,
					name: s.name,
					email: s.email,
					phoneNumber: s.phoneNumber,
					createdAt: s.createdAt,
					banned: s.banned || false,
					estimatesCount: s.estimatesCount || 0,
					assignedCustomersCount: s.assignedCustomersCount || 0,
					assignedArea: s.assignedAreaId
						? {
								id: s.assignedAreaId,
								name: s.assignedAreaName ?? "Unnamed area",
								status: s.assignedAreaStatus ?? "inactive",
							}
						: null,
				})),
				stats: {
					total: salesmenData.length,
					totalEstimates,
					activeCount,
					assignedSalesmen,
					assignedCustomers,
				},
			};
		}),

	/**
	 * Get deliverymen for this warehouse with delivery counts
	 */
	getDeliverymen: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/employees/deliverymen",
			tags: ["Warehouse Employee Management"],
			summary: "Get warehouse deliverymen",
			description: "Get all deliverymen belonging to this warehouse with stats",
		})
		.handler(async ({ context }) => {
			const warehouseId = context.session.user.id;

			const deliverymenData = await db
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					phoneNumber: user.phoneNumber,
					createdAt: user.createdAt,
					banned: user.banned,
					deliveriesCount: sql<number>`COALESCE((
                        SELECT COUNT(*)::int FROM delivery_group WHERE delivery_group.deliveryman_id = "user"."id"
                    ), 0)`,
				})
				.from(user)
				.where(
					and(eq(user.warehouseId, warehouseId), eq(user.role, "deliveryman")),
				)
				.orderBy(user.name);

			const totalDeliveries = deliverymenData.reduce(
				(sum, d) => sum + (d.deliveriesCount || 0),
				0,
			);
			const activeCount = deliverymenData.filter((d) => !d.banned).length;

			return {
				deliverymen: deliverymenData.map((d) => ({
					...d,
					banned: d.banned || false,
					deliveriesCount: d.deliveriesCount || 0,
				})),
				stats: {
					total: deliverymenData.length,
					totalDeliveries,
					activeCount,
				},
			};
		}),

	/**
	 * Get deliveryman detail by ID (scoped to warehouse)
	 */
	getDeliverymanById: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/employees/deliveryman/{id}",
			tags: ["Warehouse Employee Management"],
			summary: "Get deliveryman by ID",
			description: "Get deliveryman details with delivery history",
		})
		.input(z.object({ id: z.string() }))
		.handler(async ({ input, context }) => {
			const warehouseId = context.session.user.id;

			const [deliverymanData] = await db
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					phoneNumber: user.phoneNumber,
					serviceArea: user.serviceArea,
					createdAt: user.createdAt,
					banned: user.banned,
					deliveriesCount: sql<number>`COALESCE((
                        SELECT COUNT(*)::int FROM delivery_group WHERE delivery_group.deliveryman_id = "user"."id"
                    ), 0)`,
				})
				.from(user)
				.where(
					and(
						eq(user.id, input.id),
						eq(user.warehouseId, warehouseId),
						eq(user.role, "deliveryman"),
					),
				);

			if (!deliverymanData) {
				throw new ORPCError("NOT_FOUND", { message: "Deliveryman not found" });
			}

			// Get delivery groups
			const groups = await db
				.select({
					id: deliveryGroup.id,
					groupName: deliveryGroup.groupName,
					status: deliveryGroup.status,
					vehicleType: deliveryGroup.vehicleType,
					createdAt: deliveryGroup.createdAt,
					completedAt: deliveryGroup.completedAt,
				})
				.from(deliveryGroup)
				.where(eq(deliveryGroup.deliverymanId, input.id))
				.orderBy(desc(deliveryGroup.createdAt));

			const groupsWithDetails = await Promise.all(
				groups.map(async (g) => {
					const invoiceDetails = await db
						.select({
							count: sql<number>`COUNT(*)::int`,
							total: sql<number>`COALESCE(SUM("invoice"."grand_total"::numeric), 0)`,
						})
						.from(deliveryGroupInvoice)
						.innerJoin(invoice, eq(deliveryGroupInvoice.invoiceId, invoice.id))
						.where(eq(deliveryGroupInvoice.groupId, g.id));

					return {
						...g,
						invoiceCount: invoiceDetails[0]?.count || 0,
						totalValue: Number(invoiceDetails[0]?.total) || 0,
					};
				}),
			);

			const activeStatuses = ["assigned", "out_for_delivery", "partial"];
			const activeGroup =
				groupsWithDetails.find((g) => activeStatuses.includes(g.status)) ||
				null;
			const deliveryHistory = groupsWithDetails.filter(
				(g) => !activeStatuses.includes(g.status),
			);

			return {
				deliveryman: {
					...deliverymanData,
					banned: deliverymanData.banned || false,
					deliveriesCount: deliverymanData.deliveriesCount || 0,
					activeGroup,
					deliveryHistory,
				},
			};
		}),

	/**
	 * Get salesman detail by ID (scoped to warehouse)
	 */
	getSalesmanById: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/employees/salesman/{id}",
			tags: ["Warehouse Employee Management"],
			summary: "Get salesman by ID",
			description: "Get salesman details with assigned customers",
		})
		.input(z.object({ id: z.string() }))
		.handler(async ({ input, context }) => {
			const warehouseId = context.session.user.id;

			const [salesmanData] = await db
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					phoneNumber: user.phoneNumber,
					createdAt: user.createdAt,
					banned: user.banned,
					assignedAreaId: deliveryArea.id,
					assignedAreaName: deliveryArea.name,
					assignedAreaStatus: deliveryArea.status,
					estimatesCount: sql<number>`COALESCE((
                        SELECT COUNT(*)::int FROM estimate WHERE estimate.salesman_id = "user"."id"
                    ), 0)`,
				})
				.from(user)
				.leftJoin(
					salesmanAreaAssignment,
					and(
						eq(salesmanAreaAssignment.salesmanId, user.id),
						eq(salesmanAreaAssignment.warehouseId, warehouseId),
					),
				)
				.leftJoin(
					deliveryArea,
					and(
						eq(deliveryArea.id, salesmanAreaAssignment.areaId),
						eq(deliveryArea.warehouseId, warehouseId),
					),
				)
				.where(
					and(
						eq(user.id, input.id),
						eq(user.warehouseId, warehouseId),
						eq(user.role, "salesman"),
					),
				);

			if (!salesmanData) {
				throw new ORPCError("NOT_FOUND", { message: "Salesman not found" });
			}

			// Get assigned customers
			const assignedCustomerRows = await db
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					phoneNumber: user.phoneNumber,
					shopName: user.shopName,
					warehouseName: user.warehouseName,
					assignedAt: customerAssignment.assignedAt,
				})
				.from(customerAssignment)
				.innerJoin(user, eq(customerAssignment.customerId, user.id))
				.where(
					and(
						eq(customerAssignment.salesmanId, input.id),
						eq(customerAssignment.warehouseId, warehouseId),
					),
				)
				.orderBy(desc(customerAssignment.assignedAt));

			const customerSourceRows =
				assignedCustomerRows.length > 0
					? await getWarehouseCustomerSources({
							warehouseId,
							customerIds: assignedCustomerRows.map((customer) => customer.id),
						})
					: [];
			const customerSourceById = new Map(
				customerSourceRows.map((customer) => [customer.id, customer]),
			);
			const assignedCustomers = assignedCustomerRows.map((customer) => {
				const source = customerSourceById.get(customer.id);
				const customerType =
					source?.customerType ??
					(customer.warehouseName ? "warehouse" : "retailer");

				return {
					id: customer.id,
					name: customer.name,
					email: customer.email,
					phoneNumber: customer.phoneNumber,
					shopName: customer.shopName,
					warehouseName: customer.warehouseName,
					customerType,
					displayName:
						source?.displayName ??
						customer.warehouseName ??
						customer.shopName ??
						customer.name,
					assignedAt: customer.assignedAt,
				};
			});

			return {
				salesman: {
					id: salesmanData.id,
					name: salesmanData.name,
					email: salesmanData.email,
					phoneNumber: salesmanData.phoneNumber,
					createdAt: salesmanData.createdAt,
					banned: salesmanData.banned || false,
					estimatesCount: salesmanData.estimatesCount || 0,
					assignedArea: salesmanData.assignedAreaId
						? {
								id: salesmanData.assignedAreaId,
								name: salesmanData.assignedAreaName ?? "Unnamed area",
								status: salesmanData.assignedAreaStatus ?? "inactive",
							}
						: null,
					assignedCustomers,
					assignedCustomersCount: assignedCustomers.length,
				},
			};
		}),

	/**
	 * Assign a delivery area to a salesman
	 */
	assignSalesmanArea: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/employees/salesman/assign-area",
			tags: ["Warehouse Employee Management"],
			summary: "Assign delivery area to salesman",
			description: "Assign or replace the delivery area assigned to a salesman",
		})
		.input(assignSalesmanAreaSchema)
		.handler(async ({ input, context }) => {
			const warehouseId = context.session.user.id;

			const [salesman] = await db
				.select({ id: user.id })
				.from(user)
				.where(
					and(
						eq(user.id, input.salesmanId),
						eq(user.warehouseId, warehouseId),
						eq(user.role, "salesman"),
					),
				);

			if (!salesman) {
				throw new ORPCError("NOT_FOUND", { message: "Salesman not found" });
			}

			const [area] = await db
				.select({
					id: deliveryArea.id,
					name: deliveryArea.name,
					status: deliveryArea.status,
				})
				.from(deliveryArea)
				.where(
					and(
						eq(deliveryArea.id, input.areaId),
						eq(deliveryArea.warehouseId, warehouseId),
					),
				);

			if (!area) {
				throw new ORPCError("NOT_FOUND", {
					message: "Delivery area not found",
				});
			}

			const [existingAssignment] = await db
				.select({ id: salesmanAreaAssignment.id })
				.from(salesmanAreaAssignment)
				.where(
					and(
						eq(salesmanAreaAssignment.salesmanId, input.salesmanId),
						eq(salesmanAreaAssignment.warehouseId, warehouseId),
					),
				);

			if (existingAssignment) {
				await db
					.update(salesmanAreaAssignment)
					.set({
						areaId: input.areaId,
						assignedBy: warehouseId,
						assignedAt: new Date(),
					})
					.where(eq(salesmanAreaAssignment.id, existingAssignment.id));
			} else {
				await db.insert(salesmanAreaAssignment).values({
					warehouseId,
					salesmanId: input.salesmanId,
					areaId: input.areaId,
					assignedBy: warehouseId,
				});
			}

			return {
				message: "Area assigned successfully",
				assignedArea: area,
			};
		}),

	/**
	 * Get connected retailer and warehouse customers available for assignment
	 */
	getAssignableSalesmanCustomers: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/employees/salesman/assignable-customers",
			tags: ["Warehouse Employee Management"],
			summary: "Get assignable customers for a salesman",
			description:
				"Get this warehouse's active retailer and buyer-warehouse customers with assignment status",
		})
		.input(getAssignableSalesmanCustomersSchema)
		.handler(async ({ input, context }) => {
			const warehouseId = context.session.user.id;
			await getSalesmanOrThrow(warehouseId, input.salesmanId);

			const customers = await getWarehouseCustomerSources({
				warehouseId,
				search: input.search,
			});

			return {
				customers: await withAssignmentStatus(
					customers,
					warehouseId,
					input.salesmanId,
				),
			};
		}),

	/**
	 * Assign connected customers to a salesman
	 */
	assignSalesmanCustomers: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/employees/salesman/assign-customers",
			tags: ["Warehouse Employee Management"],
			summary: "Assign customers to salesman",
			description:
				"Assign active connected retailer or buyer-warehouse customers to one warehouse salesman",
		})
		.input(assignSalesmanCustomersSchema)
		.handler(async ({ input, context }) => {
			const warehouseId = context.session.user.id;
			await getSalesmanOrThrow(warehouseId, input.salesmanId);

			const customerIds = Array.from(new Set(input.customerIds));
			const customerSources = await getWarehouseCustomerSources({
				warehouseId,
				customerIds,
			});
			const eligibleCustomerIds = new Set(
				customerSources.map((customer) => customer.id),
			);
			const invalidCustomerIds = customerIds.filter(
				(customerId) => !eligibleCustomerIds.has(customerId),
			);

			if (invalidCustomerIds.length > 0) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Some selected customers are not active customers of this warehouse",
				});
			}

			const existingAssignments = await db
				.select({
					customerId: customerAssignment.customerId,
					salesmanId: customerAssignment.salesmanId,
				})
				.from(customerAssignment)
				.where(
					and(
						eq(customerAssignment.warehouseId, warehouseId),
						inArray(customerAssignment.customerId, customerIds),
					),
				);

			const conflictingAssignments = existingAssignments.filter(
				(assignment) => assignment.salesmanId !== input.salesmanId,
			);

			if (conflictingAssignments.length > 0) {
				throw new ORPCError("CONFLICT", {
					message:
						"One or more selected customers are already assigned to another salesman",
				});
			}

			const alreadyAssignedToThisSalesman = new Set(
				existingAssignments.map((assignment) => assignment.customerId),
			);
			const newCustomerIds = customerIds.filter(
				(customerId) => !alreadyAssignedToThisSalesman.has(customerId),
			);

			if (newCustomerIds.length > 0) {
				await db.insert(customerAssignment).values(
					newCustomerIds.map((customerId) => ({
						warehouseId,
						customerId,
						salesmanId: input.salesmanId,
						assignedBy: warehouseId,
					})),
				);
			}

			return {
				message:
					newCustomerIds.length > 0
						? `${newCustomerIds.length} customer(s) assigned successfully`
						: "Selected customers are already assigned to this salesman",
				assignedCount: newCustomerIds.length,
				skippedCount: customerIds.length - newCustomerIds.length,
			};
		}),

	/**
	 * Create a new warehouse employee (salesman or deliveryman)
	 */
	create: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/employees",
			tags: ["Warehouse Employee Management"],
			summary: "Create warehouse employee",
			description: "Create a new salesman or deliveryman for this warehouse",
		})
		.input(createEmployeeSchema)
		.handler(async ({ input, context }) => {
			const warehouseId = context.session.user.id;

			// Create user via Better Auth admin API
			const newUser = await auth.api.createUser({
				body: {
					email: input.email,
					password: input.password,
					name: input.name,
					role: input.role,
					data: {
						phoneNumber: input.phoneNumber || null,
					},
				},
			});

			if (!newUser?.user) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create employee",
				});
			}

			// Link the employee to this warehouse
			await db
				.update(user)
				.set({ warehouseId })
				.where(eq(user.id, newUser.user.id));

			return {
				message: "Employee created successfully",
				employee: {
					id: newUser.user.id,
					name: newUser.user.name,
					email: newUser.user.email,
					phoneNumber:
						(newUser.user as { phoneNumber?: string | null }).phoneNumber ||
						null,
					role: input.role,
					createdAt: newUser.user.createdAt,
					banned: false,
				},
			};
		}),

	/**
	 * Update warehouse employee details
	 */
	update: warehouseProcedure
		.route({
			method: "PUT",
			path: "/warehouse/employees/{id}",
			tags: ["Warehouse Employee Management"],
			summary: "Update warehouse employee",
			description: "Update employee name and phone number",
		})
		.input(updateEmployeeSchema)
		.handler(async ({ input, context }) => {
			const warehouseId = context.session.user.id;

			// Verify employee belongs to this warehouse
			const [employee] = await db
				.select({ id: user.id })
				.from(user)
				.where(and(eq(user.id, input.id), eq(user.warehouseId, warehouseId)));

			if (!employee) {
				throw new ORPCError("NOT_FOUND", { message: "Employee not found" });
			}

			const updateData: Record<string, string | null> = {};
			if (input.name !== undefined) updateData.name = input.name;
			if (input.phoneNumber !== undefined)
				updateData.phoneNumber = input.phoneNumber;

			if (Object.keys(updateData).length === 0) {
				return { message: "No changes to apply" };
			}

			await db.update(user).set(updateData).where(eq(user.id, input.id));

			return { message: "Employee updated successfully" };
		}),

	/**
	 * Delete a warehouse employee
	 */
	delete: warehouseProcedure
		.route({
			method: "DELETE",
			path: "/warehouse/employees/{id}",
			tags: ["Warehouse Employee Management"],
			summary: "Delete warehouse employee",
			description: "Permanently delete a warehouse employee",
		})
		.input(deleteEmployeeSchema)
		.handler(async ({ input, context }) => {
			const warehouseId = context.session.user.id;

			// Verify employee belongs to this warehouse
			const [employee] = await db
				.select({ id: user.id })
				.from(user)
				.where(and(eq(user.id, input.id), eq(user.warehouseId, warehouseId)));

			if (!employee) {
				throw new ORPCError("NOT_FOUND", { message: "Employee not found" });
			}

			await auth.api.removeUser({
				body: { userId: input.id },
				headers: new Headers({
					Authorization: `Bearer ${context.session.session.token}`,
				}),
			});

			return { message: "Employee deleted successfully" };
		}),

	/**
	 * Reset warehouse employee password
	 */
	resetPassword: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/employees/reset-password",
			tags: ["Warehouse Employee Management"],
			summary: "Reset employee password",
			description: "Reset a warehouse employee's password",
		})
		.input(resetPasswordSchema)
		.handler(async ({ input, context }) => {
			const warehouseId = context.session.user.id;

			// Verify employee belongs to this warehouse
			const [employee] = await db
				.select({ id: user.id })
				.from(user)
				.where(
					and(
						eq(user.id, input.userId),
						eq(user.warehouseId, warehouseId),
						inArray(user.role, ["deliveryman", "salesman"]),
					),
				);

			if (!employee) {
				throw new ORPCError("NOT_FOUND", { message: "Employee not found" });
			}

			await setCredentialPassword(input.userId, input.newPassword);

			return { message: "Password reset successfully" };
		}),

	/**
	 * Ban or unban a warehouse employee
	 */
	toggleBan: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/employees/toggle-ban",
			tags: ["Warehouse Employee Management"],
			summary: "Ban or unban warehouse employee",
			description: "Toggle ban status for a warehouse employee",
		})
		.input(toggleBanSchema)
		.handler(async ({ input, context }) => {
			const warehouseId = context.session.user.id;

			// Verify employee belongs to this warehouse
			const [employee] = await db
				.select({ id: user.id })
				.from(user)
				.where(
					and(eq(user.id, input.userId), eq(user.warehouseId, warehouseId)),
				);

			if (!employee) {
				throw new ORPCError("NOT_FOUND", { message: "Employee not found" });
			}

			const headers = new Headers({
				Authorization: `Bearer ${context.session.session.token}`,
			});

			if (input.banned) {
				await auth.api.banUser({
					body: {
						userId: input.userId,
						banReason: input.reason || "Banned by warehouse manager",
					},
					headers,
				});
			} else {
				await auth.api.unbanUser({
					body: { userId: input.userId },
					headers,
				});
			}

			return {
				message: input.banned
					? "Employee banned successfully"
					: "Employee unbanned successfully",
			};
		}),
};
