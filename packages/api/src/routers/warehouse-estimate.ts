import { db } from "@bikalpo-project/db";
import { estimate, order } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import {
	and,
	count,
	desc,
	eq,
	gte,
	inArray,
	lte,
	or,
	type SQL,
} from "drizzle-orm";
import { z } from "zod";
import { warehouseProcedure } from "../index";

const estimateStatusSchema = z.enum([
	"draft",
	"pending",
	"sent",
	"approved",
	"rejected",
	"converted",
]);

const dateRangeSchema = z
	.enum(["all", "today", "this_week", "this_month"])
	.default("this_month");

const discountLevelSchema = z
	.enum(["all", "above_5", "above_10"])
	.default("all");

const sortSchema = z
	.enum(["latest", "highest_value", "highest_discount"])
	.default("latest");

const directionSchema = z.enum(["all", "sent", "received"]).default("all");
const customerVisibleStatuses = ["sent", "approved", "converted"] as const;

const listEstimatesSchema = z.object({
	search: z.string().optional(),
	direction: directionSchema,
	status: z.union([estimateStatusSchema, z.literal("all")]).default("all"),
	discountLevel: discountLevelSchema,
	salesmanId: z.string().optional(),
	counterpartyId: z.string().optional(),
	customerId: z.string().optional(),
	dateRange: dateRangeSchema,
	sortBy: sortSchema,
	page: z.number().int().positive().default(1),
	limit: z.number().int().positive().max(100).default(20),
});

const detailSchema = z.object({
	id: z.number().int().positive(),
});

const reviewEstimateSchema = z.object({
	id: z.number().int().positive(),
	action: z.enum(["approve", "reject"]),
	discountPercent: z.number().min(0).max(100).optional(),
	note: z.string().trim().optional(),
});

const sendEstimateSchema = z.object({
	id: z.number().int().positive(),
});

function toNumber(value: string | number | null | undefined) {
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	if (!value) return 0;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function toMoney(value: number) {
	return Math.max(0, value).toFixed(2);
}

function getRisk(discountPercent: number): "low" | "medium" | "high" {
	if (discountPercent <= 5) return "low";
	if (discountPercent < 10) return "medium";
	return "high";
}

function getDateWindow(dateRange: z.infer<typeof dateRangeSchema>) {
	if (dateRange === "all") return null;

	const now = new Date();
	let start = new Date(now);
	let end = new Date(now);

	if (dateRange === "today") {
		start.setHours(0, 0, 0, 0);
		end.setHours(23, 59, 59, 999);
	}

	if (dateRange === "this_week") {
		start.setDate(now.getDate() - now.getDay());
		start.setHours(0, 0, 0, 0);
		end = new Date(start);
		end.setDate(start.getDate() + 6);
		end.setHours(23, 59, 59, 999);
	}

	if (dateRange === "this_month") {
		start = new Date(now.getFullYear(), now.getMonth(), 1);
		end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
		end.setHours(23, 59, 59, 999);
	}

	return { start, end };
}

function appendWarehouseNote(existing: string | null, note?: string) {
	if (!note) return existing;
	const text = `Warehouse: ${note}`;
	return existing ? `${existing}\n\n${text}` : text;
}

function getEstimateAccessCondition(
	warehouseId: string,
	direction: z.infer<typeof directionSchema>,
): SQL {
	if (direction === "sent") return eq(estimate.warehouseId, warehouseId);
	if (direction === "received") {
		return and(
			eq(estimate.customerId, warehouseId),
			inArray(estimate.status, customerVisibleStatuses),
		) as SQL;
	}

	const receivedCondition = and(
		eq(estimate.customerId, warehouseId),
		inArray(estimate.status, customerVisibleStatuses),
	) as SQL;

	return or(eq(estimate.warehouseId, warehouseId), receivedCondition) as SQL;
}

function getDirection(
	row: { warehouseId: string | null },
	warehouseId: string,
) {
	return row.warehouseId === warehouseId ? "sent" : "received";
}

function getDisplayName(
	value:
		| {
				name?: string | null;
				shopName?: string | null;
				warehouseName?: string | null;
		  }
		| null
		| undefined,
) {
	return value?.shopName ?? value?.warehouseName ?? value?.name ?? "";
}

function getCounterparty(
	row: {
		warehouseId: string | null;
		customer?: {
			id: string;
			name?: string | null;
			email?: string | null;
			phoneNumber?: string | null;
			shopName?: string | null;
			warehouseName?: string | null;
		} | null;
		warehouse?: {
			id: string;
			name?: string | null;
			email?: string | null;
			phoneNumber?: string | null;
			warehouseName?: string | null;
		} | null;
	},
	warehouseId: string,
) {
	if (getDirection(row, warehouseId) === "sent") {
		if (!row.customer) return null;
		return {
			id: row.customer.id,
			name: getDisplayName(row.customer),
			phoneNumber: row.customer.phoneNumber ?? null,
			email: row.customer.email ?? null,
			type: row.customer.warehouseName
				? ("warehouse" as const)
				: ("retailer" as const),
		};
	}

	if (!row.warehouse) return null;
	return {
		id: row.warehouse.id,
		name: getDisplayName(row.warehouse),
		phoneNumber: row.warehouse.phoneNumber ?? null,
		email: row.warehouse.email ?? null,
		type: "warehouse" as const,
	};
}

async function getWarehouseEstimate(
	id: number,
	warehouseId: string,
	options?: { requireOwner?: boolean },
) {
	const accessCondition = options?.requireOwner
		? eq(estimate.warehouseId, warehouseId)
		: getEstimateAccessCondition(warehouseId, "all");
	const estimateData = await db.query.estimate.findFirst({
		where: and(eq(estimate.id, id), accessCondition),
		with: {
			items: true,
			customer: {
				columns: {
					id: true,
					name: true,
					email: true,
					phoneNumber: true,
					shopName: true,
					warehouseName: true,
				},
			},
			salesman: {
				columns: {
					id: true,
					name: true,
					email: true,
					phoneNumber: true,
				},
			},
			warehouse: {
				columns: {
					id: true,
					name: true,
					email: true,
					phoneNumber: true,
					warehouseName: true,
				},
			},
		},
	});

	if (!estimateData) {
		throw new ORPCError("NOT_FOUND", { message: "Estimate not found" });
	}

	return estimateData;
}

export const warehouseEstimateRouter = {
	getPendingApprovalCount: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/estimates/pending-approval-count",
			tags: ["Warehouse Estimates"],
			summary: "Get pending estimate approval count",
			description:
				"Count salesman-created estimates waiting for warehouse approval",
		})
		.input(z.object({}))
		.handler(async ({ context }) => {
			const warehouseId = context.session.user.id;
			const [result] = await db
				.select({ count: count() })
				.from(estimate)
				.where(
					and(
						eq(estimate.warehouseId, warehouseId),
						eq(estimate.status, "pending"),
					),
				);

			return { pendingApprovalCount: Number(result?.count ?? 0) };
		}),

	listEstimates: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/estimates",
			tags: ["Warehouse Estimates"],
			summary: "List warehouse estimates",
			description: "List estimates created by salesmen for this warehouse",
		})
		.input(listEstimatesSchema)
		.handler(async ({ context, input }) => {
			const warehouseId = context.session.user.id;
			const conditions: SQL[] = [
				getEstimateAccessCondition(warehouseId, "all"),
			];
			const dateWindow = getDateWindow(input.dateRange);

			if (input.status !== "all") {
				conditions.push(eq(estimate.status, input.status));
			}
			if (input.salesmanId) {
				conditions.push(eq(estimate.salesmanId, input.salesmanId));
			}
			const counterpartyId = input.counterpartyId ?? input.customerId;
			if (counterpartyId) {
				if (input.direction === "sent") {
					conditions.push(eq(estimate.customerId, counterpartyId));
				} else if (input.direction === "received") {
					conditions.push(eq(estimate.warehouseId, counterpartyId));
				} else {
					conditions.push(
						or(
							eq(estimate.customerId, counterpartyId),
							eq(estimate.warehouseId, counterpartyId),
						) as SQL,
					);
				}
			}
			if (dateWindow?.start) {
				conditions.push(gte(estimate.createdAt, dateWindow.start));
			}
			if (dateWindow?.end) {
				conditions.push(lte(estimate.createdAt, dateWindow.end));
			}

			const rows = await db.query.estimate.findMany({
				where: and(...conditions),
				with: {
					items: true,
					customer: {
						columns: {
							id: true,
							name: true,
							email: true,
							phoneNumber: true,
							shopName: true,
							warehouseName: true,
						},
					},
					salesman: {
						columns: {
							id: true,
							name: true,
							email: true,
						},
					},
					warehouse: {
						columns: {
							id: true,
							name: true,
							email: true,
							phoneNumber: true,
							warehouseName: true,
						},
					},
				},
				orderBy: [desc(estimate.createdAt)],
			});

			const normalizedSearch = input.search?.trim().toLowerCase();
			const filteredForSummary = rows.filter((row) => {
				const discountPercent = toNumber(row.discountPercent);
				if (input.discountLevel === "above_5" && discountPercent <= 5) {
					return false;
				}
				if (input.discountLevel === "above_10" && discountPercent < 10) {
					return false;
				}
				if (!normalizedSearch) return true;
				const haystack = [
					row.estimateNumber,
					row.customer?.name,
					row.customer?.shopName,
					row.customer?.warehouseName,
					row.customer?.phoneNumber,
					row.salesman?.name,
					row.salesman?.email,
					row.warehouse?.name,
					row.warehouse?.warehouseName,
					row.warehouse?.email,
				]
					.filter(Boolean)
					.join(" ")
					.toLowerCase();
				return haystack.includes(normalizedSearch);
			});

			let filtered = filteredForSummary.filter((row) => {
				if (input.direction === "all") return true;
				return getDirection(row, warehouseId) === input.direction;
			});

			filtered = [...filtered].sort((left, right) => {
				if (input.sortBy === "highest_value") {
					return toNumber(right.total) - toNumber(left.total);
				}
				if (input.sortBy === "highest_discount") {
					return (
						toNumber(right.discountPercent) - toNumber(left.discountPercent)
					);
				}
				return right.createdAt.getTime() - left.createdAt.getTime();
			});

			const totalCount = filtered.length;
			const totalPages = Math.max(1, Math.ceil(totalCount / input.limit));
			const page = Math.min(input.page, totalPages);
			const offset = (page - 1) * input.limit;
			const pagedRows = filtered.slice(offset, offset + input.limit);

			const salesmenMap = new Map<
				string,
				{ id: string; name: string | null }
			>();
			const customersMap = new Map<
				string,
				{ id: string; name: string | null }
			>();
			const counterpartiesMap = new Map<
				string,
				{
					id: string;
					name: string | null;
					type: "retailer" | "warehouse";
				}
			>();
			for (const row of rows) {
				if (row.salesman) {
					salesmenMap.set(row.salesman.id, {
						id: row.salesman.id,
						name: row.salesman.name,
					});
				}
				if (row.customer) {
					customersMap.set(row.customer.id, {
						id: row.customer.id,
						name:
							row.customer.shopName ??
							row.customer.warehouseName ??
							row.customer.name,
					});
				}
				const counterparty = getCounterparty(row, warehouseId);
				if (counterparty) {
					counterpartiesMap.set(counterparty.id, {
						id: counterparty.id,
						name: counterparty.name,
						type: counterparty.type,
					});
				}
			}

			const summary = filteredForSummary.reduce(
				(acc, row) => {
					const discountPercent = toNumber(row.discountPercent);
					acc.total += 1;
					acc.totalValue += toNumber(row.total);
					if (row.status === "pending") acc.pending += 1;
					if (row.status === "approved") acc.approved += 1;
					if (row.status === "sent") acc.sent += 1;
					if (row.status === "converted") acc.converted += 1;
					if (discountPercent >= 10) acc.highRisk += 1;
					if (getDirection(row, warehouseId) === "sent") {
						acc.sentEstimates += 1;
					} else {
						acc.receivedEstimates += 1;
					}
					return acc;
				},
				{
					total: 0,
					pending: 0,
					approved: 0,
					sent: 0,
					converted: 0,
					highRisk: 0,
					totalValue: 0,
					sentEstimates: 0,
					receivedEstimates: 0,
				},
			);

			const salesmanStats = new Map<
				string,
				{ name: string; total: number; highDiscounts: number; lowRisk: number }
			>();
			for (const row of filteredForSummary) {
				const salesmanId = row.salesman?.id;
				if (!salesmanId) continue;
				const current = salesmanStats.get(salesmanId) ?? {
					name: row.salesman?.name ?? "Unnamed salesman",
					total: 0,
					highDiscounts: 0,
					lowRisk: 0,
				};
				const discountPercent = toNumber(row.discountPercent);
				current.total += 1;
				if (discountPercent > 5) current.highDiscounts += 1;
				if (discountPercent <= 5) current.lowRisk += 1;
				salesmanStats.set(salesmanId, current);
			}
			const salesmanInsightRows = Array.from(salesmanStats.values());
			const highDiscountSalesman = salesmanInsightRows
				.filter((row) => row.highDiscounts > 0)
				.sort((a, b) => b.highDiscounts - a.highDiscounts)[0];
			const stableSalesman = salesmanInsightRows
				.filter((row) => row.total > 0 && row.highDiscounts === 0)
				.sort((a, b) => b.lowRisk - a.lowRisk)[0];

			return {
				estimates: pagedRows.map((row) => ({
					...row,
					itemCount: row.items.length,
					risk: getRisk(toNumber(row.discountPercent)),
					direction: getDirection(row, warehouseId),
					canManage: row.warehouseId === warehouseId,
					counterparty: getCounterparty(row, warehouseId),
				})),
				summary,
				filterOptions: {
					salesmen: Array.from(salesmenMap.values()).sort((a, b) =>
						(a.name ?? "").localeCompare(b.name ?? ""),
					),
					customers: Array.from(customersMap.values()).sort((a, b) =>
						(a.name ?? "").localeCompare(b.name ?? ""),
					),
					counterparties: Array.from(counterpartiesMap.values()).sort((a, b) =>
						(a.name ?? "").localeCompare(b.name ?? ""),
					),
				},
				pagination: {
					page,
					limit: input.limit,
					totalCount,
					totalPages,
				},
				insights: {
					pendingReview: summary.pending,
					approvedNotSent: summary.approved,
					highDiscountSalesman: highDiscountSalesman
						? {
								name: highDiscountSalesman.name,
								count: highDiscountSalesman.highDiscounts,
							}
						: null,
					stableSalesman: stableSalesman
						? {
								name: stableSalesman.name,
								count: stableSalesman.lowRisk,
							}
						: null,
				},
				kpiRows: filteredForSummary.map((row) => ({
					estimateNumber: row.estimateNumber,
					date: row.createdAt,
					direction: getDirection(row, warehouseId),
					counterparty: getCounterparty(row, warehouseId)?.name ?? "",
					customer: getDisplayName(row.customer),
					salesman: row.salesman?.name ?? "",
					total: toNumber(row.total),
					discountPercent: toNumber(row.discountPercent),
					status: row.status,
					risk: getRisk(toNumber(row.discountPercent)),
				})),
				exportRows: filtered.map((row) => ({
					estimateNumber: row.estimateNumber,
					date: row.createdAt,
					direction: getDirection(row, warehouseId),
					counterparty: getCounterparty(row, warehouseId)?.name ?? "",
					customer: getDisplayName(row.customer),
					salesman: row.salesman?.name ?? "",
					total: toNumber(row.total),
					discountPercent: toNumber(row.discountPercent),
					status: row.status,
					risk: getRisk(toNumber(row.discountPercent)),
				})),
			};
		}),

	getEstimateDetail: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/estimates/{id}",
			tags: ["Warehouse Estimates"],
			summary: "Get warehouse estimate detail",
		})
		.input(detailSchema)
		.handler(async ({ context, input }) => {
			const warehouseId = context.session.user.id;
			const estimateData = await getWarehouseEstimate(input.id, warehouseId);
			const sourceWarehouseId = estimateData.warehouseId ?? warehouseId;

			const [customerOrders, salesmanEstimates] = await Promise.all([
				db.query.order.findMany({
					where: and(
						eq(order.userId, estimateData.customerId),
						eq(order.warehouseId, sourceWarehouseId),
					),
					columns: {
						id: true,
						total: true,
						paymentStatus: true,
						createdAt: true,
					},
					orderBy: [desc(order.createdAt)],
				}),
				db.query.estimate.findMany({
					where: and(
						eq(estimate.salesmanId, estimateData.salesmanId),
						eq(estimate.warehouseId, sourceWarehouseId),
					),
					columns: {
						id: true,
						status: true,
						discountPercent: true,
					},
				}),
			]);

			const highDiscounts = salesmanEstimates.filter(
				(row) => toNumber(row.discountPercent) > 5,
			).length;
			const resolvedEstimates = salesmanEstimates.filter((row) =>
				["sent", "approved", "converted", "rejected"].includes(row.status),
			).length;
			const approvedEstimates = salesmanEstimates.filter((row) =>
				["sent", "approved", "converted"].includes(row.status),
			).length;

			return {
				estimate: {
					...estimateData,
					risk: getRisk(toNumber(estimateData.discountPercent)),
					direction: getDirection(estimateData, warehouseId),
					canManage: estimateData.warehouseId === warehouseId,
					counterparty: getCounterparty(estimateData, warehouseId),
				},
				insights: {
					customer: {
						totalOrders: customerOrders.length,
						averageValue:
							customerOrders.length > 0
								? customerOrders.reduce(
										(sum, row) => sum + toNumber(row.total),
										0,
									) / customerOrders.length
								: 0,
						paymentType:
							customerOrders.find((row) => row.paymentStatus)?.paymentStatus ??
							null,
					},
					salesman: {
						totalEstimates: salesmanEstimates.length,
						highDiscounts,
						approvalRate:
							resolvedEstimates > 0
								? Math.round((approvedEstimates / resolvedEstimates) * 100)
								: 0,
						behavior:
							highDiscounts >= 5
								? "Risky behavior"
								: highDiscounts > 0
									? "Needs monitoring"
									: "Stable margin",
					},
				},
			};
		}),

	reviewEstimate: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/estimates/{id}/review",
			tags: ["Warehouse Estimates"],
			summary: "Approve or reject a warehouse estimate",
		})
		.input(reviewEstimateSchema)
		.handler(async ({ context, input }) => {
			const warehouseId = context.session.user.id;
			const estimateData = await getWarehouseEstimate(input.id, warehouseId, {
				requireOwner: true,
			});

			if (estimateData.status !== "pending") {
				throw new ORPCError("BAD_REQUEST", {
					message: "Only pending estimates can be reviewed",
				});
			}

			const now = new Date();
			if (input.action === "reject") {
				await db
					.update(estimate)
					.set({
						status: "rejected",
						rejectedAt: now,
						notes: appendWarehouseNote(estimateData.notes, input.note),
					})
					.where(
						and(
							eq(estimate.id, input.id),
							eq(estimate.warehouseId, warehouseId),
						),
					);

				return { success: true };
			}

			const discountPercent =
				input.discountPercent ?? toNumber(estimateData.discountPercent);
			const subtotal = toNumber(estimateData.subtotal);
			const discountAmount = subtotal * (discountPercent / 100);
			const total = Math.max(0, subtotal - discountAmount);

			await db
				.update(estimate)
				.set({
					status: "approved",
					discountPercent: discountPercent.toFixed(2),
					discount: toMoney(discountAmount),
					total: toMoney(total),
					approvedAt: now,
					notes: appendWarehouseNote(estimateData.notes, input.note),
				})
				.where(
					and(eq(estimate.id, input.id), eq(estimate.warehouseId, warehouseId)),
				);

			return { success: true };
		}),

	sendEstimate: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/estimates/{id}/send",
			tags: ["Warehouse Estimates"],
			summary: "Send an approved estimate to customer",
		})
		.input(sendEstimateSchema)
		.handler(async ({ context, input }) => {
			const warehouseId = context.session.user.id;
			const estimateData = await getWarehouseEstimate(input.id, warehouseId, {
				requireOwner: true,
			});

			if (
				estimateData.status !== "approved" &&
				estimateData.status !== "sent"
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Only approved or sent estimates can be sent",
				});
			}

			await db
				.update(estimate)
				.set({
					status: "sent",
					sentAt: new Date(),
				})
				.where(
					and(eq(estimate.id, input.id), eq(estimate.warehouseId, warehouseId)),
				);

			return { success: true };
		}),
};
