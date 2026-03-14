import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Custom statements for B2B + B2C marketplace
 * Extends default admin plugin statements with custom resources
 */
export const statement = {
    ...defaultStatements,
    order: ["create", "read", "update", "delete", "list"],
    product: ["read", "list"],
    delivery: ["create", "read", "update", "list"],
    estimate: ["create", "read", "update", "list"],
    shop: ["create", "read", "update", "list"],
    inventory: ["read", "list"],
    seller_application: ["create", "read", "update", "list"],
} as const;

export const ac = createAccessControl(statement);

/**
 * Consumer role - default role for all new signups
 * Can browse products, place B2C orders, apply to become a seller
 */
export const consumer = ac.newRole({
    order: ["create", "read", "list"],
    product: ["read", "list"],
    delivery: [],
    estimate: [],
    shop: [],
    inventory: [],
    seller_application: ["create"],
});

/**
 * Shop Owner role - approved business accounts
 * Can buy B2B wholesale + conditionally sell B2C (based on is_seller flag)
 * Seller vs Buyer-only controlled by capability flags, not separate roles
 */
export const shop_owner = ac.newRole({
    order: ["create", "read", "update", "list"],
    product: ["read", "list"],
    delivery: ["read", "list"],
    estimate: ["create", "read", "update", "list"],
    shop: ["read", "update"],
    inventory: ["read", "list"],
    seller_application: [],
});

/**
 * Salesman role - can manage estimates and view orders
 */
export const salesman = ac.newRole({
    order: ["read", "list"],
    product: ["read", "list"],
    delivery: [],
    estimate: ["create", "read", "update", "list"],
    shop: [],
    inventory: [],
    seller_application: [],
});

/**
 * Deliveryman role - can manage deliveries
 */
export const deliveryman = ac.newRole({
    order: ["read", "list"],
    product: ["read", "list"],
    delivery: ["create", "read", "update", "list"],
    estimate: [],
    shop: [],
    inventory: [],
    seller_application: [],
});

/**
 * Admin role - full access (Super Seller)
 * Can manage users, approve sellers, manage all resources
 */
export const admin = ac.newRole({
    order: ["create", "read", "update", "delete", "list"],
    product: ["read", "list"],
    delivery: ["create", "read", "update", "list"],
    estimate: ["create", "read", "update", "list"],
    shop: ["create", "read", "update", "list"],
    inventory: ["read", "list"],
    seller_application: ["create", "read", "update", "list"],
    ...adminAc.statements,
});

/**
 * Warehouse role - product supply source
 * Can sell to shop owners and other warehouses, manage inventory and orders
 */
export const warehouse = ac.newRole({
    order: ["create", "read", "update", "list"],
    product: ["read", "list"],
    delivery: ["read", "list"],
    estimate: ["create", "read", "update", "list"],
    shop: [],
    inventory: ["read", "list"],
    seller_application: [],
});
