import { ORPCError, os } from "@orpc/server";

import type { Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o;

const requireAuth = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next({
    context: {
      session: context.session,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireAuth);

const requireConsumer = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  if (context.session.user.role !== "consumer") {
    throw new ORPCError("FORBIDDEN", { message: "Customer access required" });
  }
  return next({
    context: {
      session: context.session,
    },
  });
});

export const consumerProcedure = publicProcedure.use(requireConsumer);

// Admin-only procedure - requires authenticated user with admin role
const requireAdmin = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  if (context.session.user.role !== "admin") {
    throw new ORPCError("FORBIDDEN", { message: "Admin access required" });
  }
  return next({
    context: {
      session: context.session,
    },
  });
});

export const adminProcedure = publicProcedure.use(requireAdmin);

// Salesman-only procedure - requires authenticated user with salesman role
const requireSalesman = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  if (context.session.user.role !== "salesman") {
    throw new ORPCError("FORBIDDEN", { message: "Salesman access required" });
  }
  return next({
    context: {
      session: context.session,
    },
  });
});

export const salesmanProcedure = publicProcedure.use(requireSalesman);

// Deliveryman-only procedure - requires authenticated user with deliveryman role
const requireDeliveryman = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  if (context.session.user.role !== "deliveryman") {
    throw new ORPCError("FORBIDDEN", {
      message: "Deliveryman access required",
    });
  }
  return next({
    context: {
      session: context.session,
    },
  });
});

export const deliverymanProcedure = publicProcedure.use(requireDeliveryman);

// Shop Owner procedure - requires authenticated user with shop_owner role
const requireShopOwner = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  if (context.session.user.role !== "shop_owner") {
    throw new ORPCError("FORBIDDEN", { message: "Shop owner access required" });
  }
  return next({
    context: {
      session: context.session,
    },
  });
});

export const shopOwnerProcedure = publicProcedure.use(requireShopOwner);

// Warehouse procedure - requires authenticated user with warehouse role
const requireWarehouse = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  if (context.session.user.role !== "warehouse") {
    throw new ORPCError("FORBIDDEN", { message: "Warehouse access required" });
  }
  return next({
    context: {
      session: context.session,
    },
  });
});

export const warehouseProcedure = publicProcedure.use(requireWarehouse);

// Warehouse OR Admin procedure - allows both roles for delivery management
const requireWarehouseOrAdmin = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  if (
    context.session.user.role !== "warehouse" &&
    context.session.user.role !== "admin"
  ) {
    throw new ORPCError("FORBIDDEN", {
      message: "Warehouse or admin access required",
    });
  }
  return next({
    context: {
      session: context.session,
    },
  });
});

export const warehouseOrAdminProcedure = publicProcedure.use(requireWarehouseOrAdmin);

// Fulfillment desk procedure - warehouse and retailer desks share the same
// grouping/assignment contract while remaining strictly owner scoped.
const requireFulfillmentManager = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  if (
    !["warehouse", "shop_owner", "admin"].includes(
      context.session.user.role ?? "",
    )
  ) {
    throw new ORPCError("FORBIDDEN", {
      message: "Fulfillment manager access required",
    });
  }
  return next({
    context: {
      session: context.session,
    },
  });
});

export const fulfillmentManagerProcedure = publicProcedure.use(requireFulfillmentManager);
