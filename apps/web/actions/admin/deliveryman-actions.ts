"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { deliveryGroup, deliveryGroupInvoice, user } from "@/db/schema";
import { invoice } from "@/db/schema/invoice";
import { auth } from "@/lib/auth";

export interface Deliveryman {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  createdAt: Date;
  banned: boolean;
  deliveriesCount: number;
}

export interface DeliverymenStats {
  total: number;
  totalDeliveries: number;
  activeCount: number;
}

export interface DeliveryGroupSummary {
  id: number;
  groupName: string;
  status: string;
  vehicleType: string | null;
  createdAt: Date;
  completedAt: Date | null;
  invoiceCount: number;
  totalValue: number;
}

export interface DeliverymanDetail extends Deliveryman {
  serviceArea: string | null;
  activeGroup: DeliveryGroupSummary | null;
  deliveryHistory: DeliveryGroupSummary[];
}

export async function getDeliverymen(): Promise<{
  success: boolean;
  deliverymen: Deliveryman[];
  stats: DeliverymenStats;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return {
        success: false,
        deliverymen: [],
        stats: { total: 0, totalDeliveries: 0, activeCount: 0 },
        error: "Unauthorized",
      };
    }

    // Get deliverymen with delivery counts
    const deliverymenData = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        createdAt: user.createdAt,
        banned: user.banned,
        deliveriesCount: sql<number>`COALESCE((
          SELECT COUNT(*)::int FROM delivery_group WHERE delivery_group.deliveryman_id = "user"."id"
        ), 0)`,
      })
      .from(user)
      .where(eq(user.role, "deliveryman"))
      .orderBy(user.name);

    const totalDeliveries = deliverymenData.reduce(
      (sum, d) => sum + (d.deliveriesCount || 0),
      0,
    );
    const activeCount = deliverymenData.filter((d) => !d.banned).length;

    return {
      success: true,
      deliverymen: deliverymenData.map((d) => ({
        ...d,
        banned: d.banned || false,
        deliveriesCount: d.deliveriesCount || 0,
      })),
      stats: {
        total: deliverymenData.length,
        totalDeliveries,
        activeCount,
      },
    };
  } catch (error) {
    console.error("Error fetching deliverymen:", error);
    return {
      success: false,
      deliverymen: [],
      stats: { total: 0, totalDeliveries: 0, activeCount: 0 },
      error: "Failed to fetch deliverymen",
    };
  }
}

export async function getDeliverymanById(deliverymanId: string): Promise<{
  success: boolean;
  deliveryman: DeliverymanDetail | null;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, deliveryman: null, error: "Unauthorized" };
    }

    // Get deliveryman info
    const [deliverymanData] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        serviceArea: user.serviceArea,
        createdAt: user.createdAt,
        banned: user.banned,
        deliveriesCount: sql<number>`COALESCE((
          SELECT COUNT(*)::int FROM delivery_group WHERE delivery_group.deliveryman_id = "user"."id"
        ), 0)`,
      })
      .from(user)
      .where(and(eq(user.id, deliverymanId), eq(user.role, "deliveryman")));

    if (!deliverymanData) {
      return {
        success: false,
        deliveryman: null,
        error: "Deliveryman not found",
      };
    }

    // Get all delivery groups for this deliveryman
    const groups = await db
      .select({
        id: deliveryGroup.id,
        groupName: deliveryGroup.groupName,
        status: deliveryGroup.status,
        vehicleType: deliveryGroup.vehicleType,
        createdAt: deliveryGroup.createdAt,
        completedAt: deliveryGroup.completedAt,
      })
      .from(deliveryGroup)
      .where(eq(deliveryGroup.deliverymanId, deliverymanId))
      .orderBy(desc(deliveryGroup.createdAt));

    // Get invoice counts and totals for each group
    const groupsWithDetails: DeliveryGroupSummary[] = await Promise.all(
      groups.map(async (g) => {
        const invoiceDetails = await db
          .select({
            count: sql<number>`COUNT(*)::int`,
            total: sql<number>`COALESCE(SUM("invoice"."grand_total"::numeric), 0)`,
          })
          .from(deliveryGroupInvoice)
          .innerJoin(invoice, eq(deliveryGroupInvoice.invoiceId, invoice.id))
          .where(eq(deliveryGroupInvoice.groupId, g.id));

        return {
          ...g,
          invoiceCount: invoiceDetails[0]?.count || 0,
          totalValue: Number(invoiceDetails[0]?.total) || 0,
        };
      }),
    );

    // Separate active group from history
    const activeStatuses = ["assigned", "out_for_delivery", "partial"];
    const activeGroup =
      groupsWithDetails.find((g) => activeStatuses.includes(g.status)) || null;
    const deliveryHistory = groupsWithDetails.filter(
      (g) => !activeStatuses.includes(g.status),
    );

    return {
      success: true,
      deliveryman: {
        ...deliverymanData,
        banned: deliverymanData.banned || false,
        deliveriesCount: deliverymanData.deliveriesCount || 0,
        activeGroup,
        deliveryHistory,
      },
    };
  } catch (error) {
    console.error("Error fetching deliveryman:", error);
    return {
      success: false,
      deliveryman: null,
      error: "Failed to fetch deliveryman",
    };
  }
}
