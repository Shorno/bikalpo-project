// User type definition with role support
export type UserRole =
  | "guest"
  | "customer"
  | "admin"
  | "salesman"
  | "deliveryman";

export type User = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  shopName: string | null;
  ownerName: string | null;
  emailVerified: boolean;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// Session type for tracking user devices/sessions
export type Session = {
  id: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
};

// User with sessions for admin dashboard
export type UserWithSessions = User & {
  sessions: Session[];
};

// Role display configuration
export const roleConfig: Record<UserRole, { label: string; color: string }> = {
  guest: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  },
  customer: {
    label: "Customer",
    color: "bg-green-100 text-green-800 hover:bg-green-100",
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
  return roleConfig[(role as UserRole) || "guest"] || roleConfig.guest;
}
