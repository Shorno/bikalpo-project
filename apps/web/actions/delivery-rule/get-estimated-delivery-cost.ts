"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { calculateDeliveryCost } from "@/actions/delivery-rule/calculate-delivery-cost";
import { db } from "@/db/config";
import { cart } from "@/db/schema/cart";
import { auth } from "@/lib/auth";

function parseWeightFromSize(size: string | null): number {
  if (!size || typeof size !== "string") return 0;
  const match = size.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

/**
 * Get estimated delivery cost for the current user's cart and optional area.
 * Used at checkout to show "Delivery charges will be calculated at checkout."
 */
export async function getEstimatedDeliveryCost(area?: string | null): Promise<{
  shippingCost: number;
  totalWeightKg: number;
}> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { shippingCost: 0, totalWeightKg: 0 };
  }

  const userCart = await db.query.cart.findFirst({
    where: eq(cart.userId, session.user.id),
    with: {
      items: {
        with: { product: true, variant: true },
      },
    },
  });

  if (!userCart?.items?.length) {
    return { shippingCost: 0, totalWeightKg: 0 };
  }

  let totalWeightKg = 0;
  for (const item of userCart.items) {
    const weightPerUnit = item.variant
      ? Number(item.variant.weightKg)
      : parseWeightFromSize(item.product?.size ?? null);
    totalWeightKg += weightPerUnit * item.quantity;
  }

  const shippingCost = await calculateDeliveryCost(
    totalWeightKg,
    area ?? undefined,
  );
  return { shippingCost, totalWeightKg };
}
