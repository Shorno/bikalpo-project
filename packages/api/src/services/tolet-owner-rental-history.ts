import type { db } from "@bikalpo-project/db";
import { toletProperty, toletUnit, toletRentalContract, toletBookingRequest, toletRentPayment } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, gte, inArray, lt, lte, min } from "drizzle-orm";
import { buildOwnerRentalHistory, historyMonthOffset, ownerRentalHistoryWindow } from "../routers/helpers/tolet-owner-rental-history";
import { toLetDhakaDateString } from "../routers/helpers/tolet-rental-lifecycle";

export async function getOwnedUnitRentalHistory(
	store: Pick<typeof db, "select">,
	ownerUserId: string,
	input: { propertyCode: string; unitCode: string; page: number },
	secret: string,
	now = new Date(),
) {
	const [propertyYear, propertyNumber] = input.propertyCode.replace("PR-", "").split("-").map(Number);
	const unitNumber = Number(input.unitCode.replace("UNT-", ""));
	// Authorize the property and unit BEFORE selecting any tenant/payment rows.
	const [owned] = await store.select({ unitId: toletUnit.id, propertyId: toletProperty.id, propertyCreatedAt: toletProperty.createdAt })
		.from(toletUnit).innerJoin(toletProperty, eq(toletUnit.propertyId, toletProperty.id))
		.where(and(eq(toletUnit.publicNumber, unitNumber), eq(toletProperty.publicNumber, propertyNumber!), eq(toletProperty.ownerUserId, ownerUserId))).limit(1);
	if (!owned || owned.propertyCreatedAt.getFullYear() !== propertyYear) throw new ORPCError("NOT_FOUND", { message: "Unit not found" });
	const scope = and(eq(toletRentalContract.unitId, owned.unitId), eq(toletRentalContract.propertyId, owned.propertyId), eq(toletRentalContract.ownerUserId, ownerUserId));
	const today = toLetDhakaDateString(now);
	const [first] = await store.select({ startDate: min(toletRentalContract.startDate) }).from(toletRentalContract)
		.where(and(scope, lte(toletRentalContract.startDate, today)));
	const window = ownerRentalHistoryWindow(first?.startDate ?? null, input.page, today);
	const response = { unitCode: input.unitCode, page: input.page, totalPages: window.totalPages, totalMonths: window.totalMonths, periodFrom: window.from, periodTo: window.to };
	if (!window.from || !window.to) return { ...response, rows: [] as ReturnType<typeof buildOwnerRentalHistory> };
	const nextMonth = historyMonthOffset(window.to, 1);
	const contracts = await store.select({
		id: toletRentalContract.id, publicNumber: toletRentalContract.publicNumber,
		bookingNumber: toletBookingRequest.publicNumber,
		tenantUserId: toletRentalContract.tenantUserId, tenantName: toletBookingRequest.contactName,
		startDate: toletRentalContract.startDate, endDate: toletRentalContract.endDate,
		status: toletRentalContract.status, monthlyRent: toletRentalContract.monthlyRent, rentDueDay: toletRentalContract.rentDueDay,
	}).from(toletRentalContract).innerJoin(toletBookingRequest, eq(toletRentalContract.bookingRequestId, toletBookingRequest.id))
		.where(and(scope, lt(toletRentalContract.startDate, nextMonth), gte(toletRentalContract.endDate, window.from), lte(toletRentalContract.startDate, today)));
	const payments = contracts.length ? await store.select({
		contractId: toletRentPayment.contractId, cycleMonth: toletRentPayment.cycleMonth,
		amount: toletRentPayment.amount, status: toletRentPayment.status,
		referenceName: toletRentPayment.referenceName, verifiedAt: toletRentPayment.verifiedAt,
	}).from(toletRentPayment).where(and(inArray(toletRentPayment.contractId, contracts.map(contract => contract.id)), gte(toletRentPayment.cycleMonth, window.from), lte(toletRentPayment.cycleMonth, window.to))) : [];
	return { ...response, rows: buildOwnerRentalHistory(contracts, payments, window.from, window.to, secret, today) };
}
