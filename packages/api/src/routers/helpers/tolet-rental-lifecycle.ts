export const TO_LET_RENT_DUE_DAY = 1 as const;

// Open-ended contracts (no end date) compare as running far into the future.
export const TO_LET_OPEN_ENDED_DATE = "9999-12-31";

export function toLetContractEnd(endDate: string | null) {
	return endDate ?? TO_LET_OPEN_ENDED_DATE;
}

// Pressing Leave on any day of a month ends the rental on that month's last
// day; the tenant is out from the coming 1st.
export function toLetOpenEndedLeaveDate(today = toLetDhakaDateString()) {
	const [year, month] = today.split("-").map(Number);
	return new Date(Date.UTC(year ?? 0, month ?? 1, 0)).toISOString().slice(0, 10);
}

/**
 * The tenant's last day after pressing Leave: the end of the current month, or
 * the contract's own end date if it comes sooner. Never before move-in.
 */
export function toLetLeaveDate(
	contract: { startDate: string; endDate: string | null },
	today = toLetDhakaDateString(),
) {
	const monthEnd = toLetOpenEndedLeaveDate(today);
	const leaveDate =
		contract.endDate && contract.endDate < monthEnd ? contract.endDate : monthEnd;
	return leaveDate < contract.startDate ? contract.startDate : leaveDate;
}

/** Last day of the month after `date` (YYYY-MM-DD). */
export function toLetEndOfNextMonth(date: string) {
	const [year, month] = date.split("-").map(Number);
	return new Date(Date.UTC(year ?? 0, (month ?? 1) + 1, 0)).toISOString().slice(0, 10);
}

/**
 * After moving out, the tenant keeps access to the rental (details, dues and
 * rent-payment OTP) through the end of the following month.
 */
export function toLetTenantAccessEndDate(contract: {
	endDate: string | null;
	accessEndsAt?: Date | null;
}) {
	if (contract.accessEndsAt) return toLetDhakaDateString(contract.accessEndsAt);
	return contract.endDate ? toLetEndOfNextMonth(contract.endDate) : TO_LET_OPEN_ENDED_DATE;
}

export function toLetNextDate(date: string) {
	const [year, month, day] = date.split("-").map(Number);
	return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + 1)).toISOString().slice(0, 10);
}

export function canAccessToLetRentalDetails(
	contract: {
		status: string;
		endDate: string | null;
		accessEndsAt?: Date | null;
		ownerUserId: string;
		tenantUserId: string;
	},
	userId: string,
	today = toLetDhakaDateString(),
) {
	if (contract.ownerUserId === userId) return true;
	return contract.tenantUserId === userId &&
		["active", "leaving", "completed"].includes(contract.status) &&
		toLetTenantAccessEndDate(contract) >= today;
}

export function toLetDhakaDateString(date = new Date()) {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Dhaka",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(date);
}

export function isToLetCalendarDate(value: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const date = new Date(`${value}T00:00:00Z`);
	return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function monthStart(value: string) {
	return `${value.slice(0, 7)}-01`;
}

function addMonth(value: string) {
	const [year, month] = value.split("-").map(Number);
	const date = new Date(Date.UTC(year ?? 0, month ?? 0, 1));
	return date.toISOString().slice(0, 10);
}

function dueDate(cycleMonth: string, dueDay: number) {
	return `${cycleMonth.slice(0, 8)}${String(dueDay).padStart(2, "0")}`;
}

export function shouldCompleteToLetContract(
	contract: { status: string; endDate: string | null },
	today = toLetDhakaDateString(),
) {
	return (
		(contract.status === "active" || contract.status === "leaving") &&
		toLetContractEnd(contract.endDate) < today
	);
}

export function toLetRentCyclesThroughDate(
	contract: {
		startDate: string;
		endDate: string | null;
		rentDueDay: number;
		monthlyRent: string;
	},
	today = toLetDhakaDateString(),
) {
	// A contract signed in advance must not generate a payable first-month row
	// before move-in, even when move-in is later in the current calendar month.
	const endDate = toLetContractEnd(contract.endDate);
	if (contract.startDate > today || endDate < contract.startDate) return [];
	const lastMonth = monthStart(endDate < today ? endDate : today);
	let cycle = monthStart(contract.startDate);
	const rows: Array<{ cycleMonth: string; dueDate: string; amount: string }> =
		[];

	for (let count = 0; count < 240 && cycle <= lastMonth; count += 1) {
		rows.push({
			cycleMonth: cycle,
			dueDate: dueDate(cycle, contract.rentDueDay),
			amount: contract.monthlyRent,
		});
		cycle = addMonth(cycle);
	}

	return rows;
}
