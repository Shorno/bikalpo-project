export type DeliverymanStatusFilter = "all" | "active" | "banned";

export type DeliverymanRow = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  createdAt: Date | string;
  banned: boolean;
  deliveriesCount: number;
};

export type DeliverymenStats = {
  total: number;
  totalDeliveries: number;
  activeCount: number;
};

export function getDeliverymanStatusLabel(banned: boolean) {
  return banned ? "Banned" : "Active";
}

export function getDeliverymanStatusTone(
  banned: boolean,
): "default" | "secondary" | "outline" | "destructive" {
  return banned ? "destructive" : "outline";
}

export function filterDeliverymen(
  deliverymen: DeliverymanRow[],
  options: {
    search?: string;
    status: DeliverymanStatusFilter;
  },
) {
  const query = options.search?.trim().toLowerCase();

  return deliverymen.filter((rider) => {
    if (options.status === "active" && rider.banned) return false;
    if (options.status === "banned" && !rider.banned) return false;

    if (query) {
      return (
        rider.name.toLowerCase().includes(query) ||
        rider.email.toLowerCase().includes(query) ||
        (rider.phoneNumber?.toLowerCase().includes(query) ?? false)
      );
    }

    return true;
  });
}

export function getStatusTabCounts(deliverymen: DeliverymanRow[]) {
  const bannedCount = deliverymen.filter((rider) => rider.banned).length;
  return {
    all: deliverymen.length,
    active: deliverymen.filter((rider) => !rider.banned).length,
    banned: bannedCount,
  };
}

export function generatePassword(length = 10): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
