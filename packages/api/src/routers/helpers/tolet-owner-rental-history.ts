import { toLetDhakaDateString } from "./tolet-rental-lifecycle";
import { toLetRentOtp } from "../../services/tolet-rent-payment";

export type OwnerHistoryContract = {
	id: string; publicNumber: number; bookingNumber: number;
	tenantUserId: string; tenantName: string; startDate: string; endDate: string;
	status: string; monthlyRent: string; rentDueDay: number;
};
export type OwnerHistoryPayment = {
	contractId: string; cycleMonth: string; amount: string; status: "pending" | "paid";
	referenceName: string | null; verifiedAt: Date | null;
};
export type OwnerRentalHistoryRow = {
	key: string; cycleMonth: string; tenantId: string | null; tenantName: string;
	contractCode: string | null; bookingCode: string | null;
	amount: number | null; otp: string | null; status: "vacant" | "pending" | "paid";
	referenceName: string | null; verifiedAt: string | null; recorded: boolean;
};

export function historyMonthOffset(month: string, offset: number) {
	const [year, monthNumber] = month.split("-").map(Number);
	return new Date(Date.UTC(year!, monthNumber! - 1 + offset, 1)).toISOString().slice(0, 10);
}

export function ownerRentalHistoryWindow(firstDate: string | null, page: number, today = toLetDhakaDateString()) {
	const currentMonth = `${today.slice(0, 7)}-01`;
	if (!firstDate || firstDate > today) return { totalMonths: 0, totalPages: 0, from: null, to: null };
	const firstMonth = `${firstDate.slice(0, 7)}-01`;
	const totalMonths = (Number(currentMonth.slice(0, 4)) - Number(firstMonth.slice(0, 4))) * 12 + Number(currentMonth.slice(5, 7)) - Number(firstMonth.slice(5, 7)) + 1;
	const totalPages = Math.ceil(totalMonths / 12);
	if (page > totalPages) return { totalMonths, totalPages, from: null, to: null };
	const to = historyMonthOffset(currentMonth, -(page - 1) * 12);
	const lowerBound = historyMonthOffset(to, -11);
	return { totalMonths, totalPages, from: lowerBound < firstMonth ? firstMonth : lowerBound, to };
}

// One row per actual contract/month, including successive tenants in the same
// month. Full month gaps mean "no recorded contract", never an invented bill.
export function buildOwnerRentalHistory(
	contracts: OwnerHistoryContract[], payments: OwnerHistoryPayment[],
	from: string, to: string, secret: string, today = toLetDhakaDateString(),
) {
	const recordedPayments = new Map(payments.map(payment => [`${payment.contractId}:${payment.cycleMonth}`, payment]));
	const rows: OwnerRentalHistoryRow[] = [];
	for (let month = from; month <= to; month = historyMonthOffset(month, 1)) {
		const nextMonth = historyMonthOffset(month, 1);
		const tenants = contracts.filter(contract => contract.startDate < nextMonth && contract.startDate <= today && contract.endDate >= month)
			.sort((left, right) => left.startDate.localeCompare(right.startDate) || left.publicNumber - right.publicNumber);
		if (!tenants.length) {
			rows.push({ key: `vacant:${month}`, cycleMonth: month, tenantId: null, tenantName: month === `${today.slice(0, 7)}-01` ? "No current tenant" : "Vacant", contractCode: null, bookingCode: null, amount: null, otp: null, status: "vacant", referenceName: null, verifiedAt: null, recorded: false });
			continue;
		}
		for (const contract of tenants) {
			const payment = recordedPayments.get(`${contract.id}:${month}`);
			const status = payment?.status ?? "pending";
			const dueDate = `${month.slice(0, 8)}${String(contract.rentDueDay).padStart(2, "0")}`;
			const canShowOtp = status === "pending" && ["active", "leaving"].includes(contract.status) && contract.startDate <= today && contract.endDate >= today && dueDate <= today;
			rows.push({
				key: `${contract.id}:${month}`, cycleMonth: month,
				tenantId: contract.tenantUserId, tenantName: contract.tenantName,
				contractCode: `CTR-${String(contract.publicNumber).padStart(6, "0")}`,
				bookingCode: `BKG-${String(contract.bookingNumber).padStart(6, "0")}`,
				amount: Number(payment?.amount ?? contract.monthlyRent), status,
				otp: canShowOtp ? toLetRentOtp(contract.id, month, secret) : null,
				referenceName: payment?.referenceName ?? null,
				verifiedAt: payment?.verifiedAt?.toISOString() ?? null,
				recorded: Boolean(payment),
			});
		}
	}
	return rows;
}
