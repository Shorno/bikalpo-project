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

// Active subscription procedure - requires shop_owner with active trial or paid subscription
const requireActiveSubscription = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  if (context.session.user.role !== "shop_owner") {
    throw new ORPCError("FORBIDDEN", { message: "Shop owner access required" });
  }

  // Check subscription status from DB
  const { db } = await import("@bikalpo-project/db");
  const { shopSubscription } = await import("@bikalpo-project/db/schema");
  const { eq, desc } = await import("drizzle-orm");

  const [sub] = await db
    .select()
    .from(shopSubscription)
    .where(eq(shopSubscription.userId, context.session.user.id))
    .orderBy(desc(shopSubscription.createdAt))
    .limit(1);

  if (!sub) {
    throw new ORPCError("FORBIDDEN", {
      message: "No active subscription. Please subscribe to continue.",
    });
  }

  const now = new Date();
  const isActive =
    (sub.status === "trial" && sub.trialEnd && new Date(sub.trialEnd) > now) ||
    (sub.status === "active" && sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) > now);

  if (!isActive) {
    throw new ORPCError("FORBIDDEN", {
      message: "Your subscription has expired. Please renew to continue.",
    });
  }

  return next({
    context: {
      session: context.session,
    },
  });
});

export const activeSubscriptionProcedure = publicProcedure.use(requireActiveSubscription);

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
