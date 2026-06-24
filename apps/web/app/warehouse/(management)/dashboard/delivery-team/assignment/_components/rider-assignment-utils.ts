export type RiderStatusFilter = "all" | "active" | "idle";

export type RiderOverviewRow = {
  id: string;
  name: string;
  phoneNumber: string | null;
  banned: boolean;
  serviceArea: string | null;
  status: "active" | "idle";
  areaLabel: string;
  activeGroup: {
    id: number;
    groupName: string;
    areaLabel: string;
    status: string;
  } | null;
  totalOrders: number;
  completedOrders: number;
  vehicleType: string | null;
};

export type PendingGroupOption = {
  id: number;
  groupName: string;
  areaLabel: string;
  totalInvoices: number;
};

export function getRiderStatusLabel(status: "active" | "idle", banned: boolean) {
  if (banned) return "Banned";
  return status === "active" ? "Active" : "Idle";
}

export function getRiderStatusTone(
  status: "active" | "idle",
  banned: boolean,
): "default" | "secondary" | "outline" | "destructive" {
  if (banned) return "destructive";
  return status === "active" ? "default" : "secondary";
}

export function canAssignGroupToRider(rider: RiderOverviewRow) {
  return !rider.banned && rider.status === "idle";
}
