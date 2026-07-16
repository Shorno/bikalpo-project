export type DeliveryAssignmentKpiFilter =
	| "all"
	| "pending_assignment"
	| "assigned"
	| "completed";

export function getDeliveryAssignmentKpiBucket(
	status: string,
): Exclude<DeliveryAssignmentKpiFilter, "all"> {
	if (status === "pending_assignment") return "pending_assignment";
	if (status === "completed" || status === "partial") return "completed";
	return "assigned";
}

export function rollUpDeliveryAreaLabel(
	areas: Array<string | null | undefined>,
): string {
	const uniqueAreas = [
		...new Set(
			areas
				.map((area) => area?.trim())
				.filter((area): area is string => !!area),
		),
	];
	if (uniqueAreas.length === 0) return "—";
	if (uniqueAreas.length === 1) return uniqueAreas[0] ?? "—";
	return "Mixed";
}
