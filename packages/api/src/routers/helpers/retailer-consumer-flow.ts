export type RetailerOrderCommand = "confirm" | "cancel" | "create_invoice";
export type RetailerDispatchView = "ready_for_dispatch" | "invoiced";
export type RetailerDispatchStatus =
  | "confirmed"
  | "ready_for_dispatch"
  | "invoiced";

export type RetailerOrderTransition = {
  nextStatus: "ready_for_dispatch" | "invoiced" | "cancelled";
  setConfirmedAt?: boolean;
  setReadyAt?: boolean;
  setCancelledAt?: boolean;
};

export function getRetailerOrderTransition(
  currentStatus: string,
  command: RetailerOrderCommand,
): RetailerOrderTransition | null {
  if (currentStatus === "pending" && command === "confirm") {
    return {
      nextStatus: "ready_for_dispatch",
      setConfirmedAt: true,
      setReadyAt: true,
    };
  }

  if (
    ["confirmed", "ready_for_dispatch"].includes(currentStatus) &&
    command === "create_invoice"
  ) {
    return { nextStatus: "invoiced" };
  }

  if (
    ["pending", "confirmed", "ready_for_dispatch"].includes(currentStatus) &&
    command === "cancel"
  ) {
    return { nextStatus: "cancelled", setCancelledAt: true };
  }

  return null;
}

/** Operational desk terminology; consumer projection remains Store confirmed. */
export function getRetailerOperationalStatusLabel(status: string) {
    if (status === "pending") return "Pending Approval";
    if (status === "ready_for_dispatch") return "Ready for Dispatch";
    return status.replaceAll("_", " ");
}

export function getRetailerDispatchQueryStatuses(
  view: RetailerDispatchView,
): RetailerDispatchStatus[] {
  return view === "ready_for_dispatch"
    ? ["confirmed", "ready_for_dispatch"]
    : ["invoiced"];
}

export function getRetailerDispatchQueueStatus(
  status: string,
): string {
  return status === "confirmed" ? "ready_for_dispatch" : status;
}
