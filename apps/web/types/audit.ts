export type ActionType =
  | "login"
  | "logout"
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "reject"
  | "payment"
  | "invoice";

export type ModuleType =
  | "orders"
  | "products"
  | "users"
  | "invoice"
  | "stock"
  | "settings"
  | "delivery"
  | "category"
  | "brand"
  | "estimate"
  | "returns"
  | "auth";

export type ActivityStatus = "success" | "warning" | "failed";

export type UserRole =
  | "super_admin"
  | "admin"
  | "shop_owner"
  | "employee"
  | "delivery"
  | "sales";

export interface AuditActivity {
  logId: string;
  timestamp: Date;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  action: ActionType;
  module: ModuleType;
  description: string;
  status: ActivityStatus;
  metadata?: Record<string, any>;
  sessionId?: string;
  sessionActive?: boolean;
  deviceType?: "web" | "mobile";
}

export interface AuditFilters {
  dateFrom?: Date;
  dateTo?: Date;
  userRole?: UserRole;
  actionType?: ActionType;
  module?: ModuleType;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditActivityDetail extends AuditActivity {
  sessionStartTime?: Date;
  sessionEndTime?: Date;
  accountStatus: "active" | "blocked" | "pending";
}
