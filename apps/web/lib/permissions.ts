import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Custom statements for B2B e-commerce
 * Extends default admin plugin statements with custom resources
 */
export const statement = {
  ...defaultStatements,
  order: ["create", "read", "update", "delete", "list"],
  product: ["read", "list"],
} as const;

export const ac = createAccessControl(statement);

/**
 * Guest role - newly registered users, pending approval
 * Limited access - can only view their profile
 */
export const guest = ac.newRole({
  order: [],
  product: [],
});

/**
 * Customer role - approved accounts
 * Can place orders, view products
 */
export const customer = ac.newRole({
  order: ["create", "read", "list"],
  product: ["read", "list"],
});

/**
 * Admin role - full access
 * Can manage users, approve guests, manage all resources
 */
export const admin = ac.newRole({
  order: ["create", "read", "update", "delete", "list"],
  product: ["read", "list"],
  ...adminAc.statements,
});
