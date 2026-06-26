export type FlowStepState = "done" | "current" | "upcoming";

export type BuyerFlowStep = {
	key: string;
	label: string;
	date: Date | string | null;
	completed: boolean;
	state: FlowStepState;
	subtitle?: string | null;
};

type InvoiceProgressSummary = {
	approvedQty: number;
	invoicedQty: number;
	remainingQty: number;
	deliveredQty?: number;
};

type ShipmentForDisplay = {
	canReceive: boolean;
	receivedAt: Date | string | null;
	deliveredAt?: Date | string | null;
	deliveryStatus: string;
};

type OrderForDisplay = {
	status: string;
	confirmedAt?: Date | string | null;
	readyAt?: Date | string | null;
	receivedAt?: Date | string | null;
	createdAt: Date | string;
	modifiedByWarehouseAt?: Date | string | null;
};

type DeliveryLink = {
	groupStatus: string;
	assignedAt?: Date | string | null;
};

type InvoiceForFlow = {
	createdAt: Date | string;
	approvedAt?: Date | string | null;
	deliveredAt?: Date | string | null;
	receivedAt?: Date | string | null;
	deliveryStatus: string;
	fulfillmentMode?: string | null;
	completionOtp?: string | null;
	completionOtpVerifiedAt?: Date | string | null;
};

function assignFlowStepStates(
	steps: Array<{
		key: string;
		label: string;
		date: Date | string | null;
		completed: boolean;
		subtitle?: string | null;
	}>,
): BuyerFlowStep[] {
	const firstIncomplete = steps.findIndex((step) => !step.completed);
	return steps.map((step, index) => ({
		...step,
		state:
			step.completed
				? "done"
				: index === firstIncomplete
					? "current"
					: "upcoming",
	}));
}

export function buildBuyerOrderTimeline(
	order: OrderForDisplay,
	hasInvoices: boolean,
): BuyerFlowStep[] {
	const steps: Array<{
		key: string;
		label: string;
		date: Date | string | null;
		completed: boolean;
		subtitle?: string | null;
		isModification?: boolean;
	}> = [
		{
			key: "placed",
			label: "Placed",
			date: order.createdAt,
			completed: true,
		},
		{
			key: "confirmed",
			label: "Confirmed",
			date: order.confirmedAt ?? null,
			completed: !!order.confirmedAt,
		},
		{
			key: "modified",
			label: "Modified",
			date: order.modifiedByWarehouseAt ?? null,
			completed: !!order.modifiedByWarehouseAt,
			isModification: true,
		},
		{
			key: "ready",
			label: "Ready",
			date: order.readyAt ?? null,
			completed: !!order.readyAt || hasInvoices,
		},
	];

	return assignFlowStepStates(
		steps.filter((step) => !step.isModification || step.completed),
	);
}

export function buildInvoiceShipmentFlow(
	invoice: InvoiceForFlow,
	deliveryLink: DeliveryLink | null | undefined,
): BuyerFlowStep[] {
	const isSelfPickup = invoice.fulfillmentMode === "self_pickup";
	const isDelivered =
		invoice.deliveryStatus === "delivered" || !!invoice.deliveredAt;
	const isOutForDelivery =
		invoice.deliveryStatus === "out_for_delivery" ||
		deliveryLink?.groupStatus === "out_for_delivery";
	const isDispatched =
		!!deliveryLink ||
		["pending", "out_for_delivery", "delivered"].includes(invoice.deliveryStatus);
	const isReadyForPickup =
		isSelfPickup &&
		!!invoice.completionOtp &&
		!invoice.completionOtpVerifiedAt &&
		!isDelivered;

	if (isSelfPickup) {
		return assignFlowStepStates([
			{
				key: "invoiced",
				label: "Invoiced",
				date: invoice.createdAt,
				completed: true,
			},
			{
				key: "pickup",
				label: "Ready for pickup",
				date: isReadyForPickup ? invoice.createdAt : null,
				completed: isDelivered || !!invoice.completionOtpVerifiedAt,
			},
			{
				key: "delivered",
				label: "Delivered",
				date: invoice.deliveredAt ?? null,
				completed: isDelivered,
			},
			{
				key: "received",
				label: "Received",
				date: invoice.receivedAt ?? null,
				completed: !!invoice.receivedAt,
			},
		]);
	}

	return assignFlowStepStates([
		{
			key: "invoiced",
			label: "Invoiced",
			date: invoice.createdAt,
			completed: true,
		},
		{
			key: "dispatched",
			label: "Dispatched",
			date: deliveryLink?.assignedAt ?? invoice.approvedAt ?? null,
			completed: isDispatched,
		},
		{
			key: "out_for_delivery",
			label: "In transit",
			date: null,
			completed: isOutForDelivery || isDelivered,
		},
		{
			key: "delivered",
			label: "Delivered",
			date: invoice.deliveredAt ?? null,
			completed: isDelivered,
		},
		{
			key: "received",
			label: "Received",
			date: invoice.receivedAt ?? null,
			completed: !!invoice.receivedAt,
		},
	]);
}

export function getShipmentLifecycleLabel(flow: BuyerFlowStep[]): string {
	const current = flow.find((step) => step.state === "current");
	if (current) return current.label;
	const lastDone = [...flow].reverse().find((step) => step.state === "done");
	return lastDone?.label ?? "Invoiced";
}

export function deriveBuyerPurchaseDisplayStatus(
	order: OrderForDisplay,
	shipments: ShipmentForDisplay[],
	invoiceProgress: InvoiceProgressSummary | null,
): { key: string; label: string; detail: string | null } {
	if (order.status === "cancelled") {
		return { key: "cancelled", label: "Cancelled", detail: null };
	}

	const shipmentList = shipments ?? [];
	const totalShipments = shipmentList.length;
	const receivedCount = shipmentList.filter((s) => s.receivedAt).length;
	const deliveredCount = shipmentList.filter(
		(s) => s.deliveryStatus === "delivered" || !!s.deliveredAt,
	).length;
	const canReceiveAny = shipmentList.some((s) => s.canReceive);
	const outForDeliveryAny = shipmentList.some(
		(s) => s.deliveryStatus === "out_for_delivery",
	);

	const detailParts: string[] = [];
	if (totalShipments > 0 && receivedCount < totalShipments) {
		detailParts.push(`${receivedCount}/${totalShipments} shipments received`);
	}
	if (invoiceProgress) {
		const deliveredQty = invoiceProgress.deliveredQty ?? 0;
		if (deliveredQty > 0 && invoiceProgress.approvedQty > deliveredQty) {
			detailParts.push(
				`${deliveredQty}/${invoiceProgress.approvedQty} units delivered`,
			);
		}
	}
	const detail = detailParts.length > 0 ? detailParts.join(" · ") : null;

	if (
		order.receivedAt ||
		(totalShipments > 0 &&
			receivedCount === totalShipments &&
			deliveredCount === totalShipments)
	) {
		return { key: "received", label: "Received", detail };
	}

	if (canReceiveAny) {
		return { key: "awaiting_receive", label: "Awaiting receive", detail };
	}

	if (outForDeliveryAny) {
		return { key: "in_delivery", label: "In delivery", detail };
	}

	if (deliveredCount > 0 || receivedCount > 0) {
		const moreInvoicing =
			!!invoiceProgress && invoiceProgress.remainingQty > 0;
		const pendingShipments = shipmentList.some(
			(s) =>
				s.deliveryStatus === "not_assigned" ||
				s.deliveryStatus === "pending",
		);
		if (moreInvoicing || pendingShipments || receivedCount < totalShipments) {
			return {
				key: "partially_delivered",
				label: "Partially delivered",
				detail,
			};
		}
	}

	if (
		invoiceProgress &&
		invoiceProgress.invoicedQty > 0 &&
		invoiceProgress.remainingQty === 0
	) {
		const awaitingDispatch = shipmentList.some(
			(s) =>
				s.deliveryStatus === "not_assigned" ||
				s.deliveryStatus === "pending",
		);
		if (awaitingDispatch && !outForDeliveryAny) {
			return {
				key: "awaiting_dispatch",
				label: "Awaiting dispatch",
				detail,
			};
		}
	}

	if (
		invoiceProgress &&
		invoiceProgress.invoicedQty > 0 &&
		invoiceProgress.remainingQty > 0
	) {
		return {
			key: "partially_invoiced",
			label: "Partially invoiced",
			detail: `${invoiceProgress.invoicedQty}/${invoiceProgress.approvedQty} units invoiced`,
		};
	}

	if (order.status === "ready_for_dispatch" || order.readyAt) {
		return {
			key: "ready_for_dispatch",
			label: "Ready for dispatch",
			detail: null,
		};
	}

	if (order.status === "confirmed" || order.confirmedAt) {
		return { key: "confirmed", label: "Confirmed", detail: null };
	}

	if (
		order.status === "processing" ||
		order.status === "invoiced" ||
		order.status === "partially_invoiced"
	) {
		return {
			key: "partially_delivered",
			label: "Partially delivered",
			detail,
		};
	}

	if (order.status === "delivered") {
		return { key: "delivered", label: "Delivered", detail };
	}

	return { key: "pending", label: "Pending", detail: null };
}
