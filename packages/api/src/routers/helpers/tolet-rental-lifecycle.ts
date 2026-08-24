export const TO_LET_RENT_DUE_DAY = 1 as const;

export function toLetDhakaDateString(date = new Date()) {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Dhaka",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(date);
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
	contract: { status: string; endDate: string },
	today = toLetDhakaDateString(),
) {
	return (
		(contract.status === "active" || contract.status === "leaving") &&
		contract.endDate < today
	);
}

export function toLetRentCyclesThroughDate(
	contract: {
		startDate: string;
		endDate: string;
		rentDueDay: number;
		monthlyRent: string;
	},
	today = toLetDhakaDateString(),
) {
	const lastMonth = monthStart(
		contract.endDate < today ? contract.endDate : today,
	);
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
