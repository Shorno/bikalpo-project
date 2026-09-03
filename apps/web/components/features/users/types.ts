import type { User } from "@bikalpo-project/auth";

// Re-export User from auth package
export type { User };

// User role definition
export type UserRole =
  | "consumer"
  | "shop_owner"
  | "shop_staff"
  | "admin"
  | "salesman"
  | "deliveryman";

// Database session row for admin user-sessions dialog
export type UserSession = {
  id: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
};

// User with sessions for admin dashboard
export type UserWithSessions = User & {
  sessions: UserSession[];
};

// Role display configuration
export const roleConfig: Record<UserRole, { label: string; color: string }> = {
  consumer: {
    label: "Consumer",
    color: "bg-green-100 text-green-800 hover:bg-green-100",
  },
  shop_owner: {
    label: "Shop Owner",
    color: "bg-teal-100 text-teal-800 hover:bg-teal-100",
  },
  shop_staff: {
    label: "Shop Staff",
    color: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  },
  admin: {
    label: "Admin",
    color: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  },
  salesman: {
    label: "Salesman",
    color: "bg-purple-100 text-purple-800 hover:bg-purple-100",
  },
  deliveryman: {
    label: "Deliveryman",
    color: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  },
};

export function getRoleConfig(role: string | null) {
  return roleConfig[(role as UserRole) || "consumer"] || roleConfig.consumer;
}

export type VerifiedUserReview = {
  id: number;
  comment: string;
  rating: number;
};

export type VerifiedUser = {
  id: string;
  name: string;
  email: string;
  shopName: string | null;
  ownerName: string | null;
  image: string | null;
  createdAt: Date;
  area: string | null;
  totalOrders: number;
  totalSpend: number;
  reviews: VerifiedUserReview[];
};
