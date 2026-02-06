"use server";

import { and, eq, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { customerAssignment, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { ADMIN_BASE } from "@/lib/routes";

export interface Salesman {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  createdAt: Date;
  banned: boolean;
  estimatesCount: number;
  assignedCustomersCount: number;
}

export interface SalesmenStats {
  total: number;
  totalEstimates: number;
  activeCount: number;
}

export interface AssignedCustomer {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  shopName: string | null;
  assignedAt: Date;
}

export interface SalesmanDetail extends Salesman {
  assignedCustomers: AssignedCustomer[];
  assignedCustomersCount: number;
}

export async function getSalesmen(): Promise<{
  success: boolean;
  salesmen: Salesman[];
  stats: SalesmenStats;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return {
        success: false,
        salesmen: [],
        stats: { total: 0, totalEstimates: 0, activeCount: 0 },
        error: "Unauthorized",
      };
    }

    // Get salesmen with estimate counts and assigned customer counts
    const salesmenData = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        createdAt: user.createdAt,
        banned: user.banned,
        estimatesCount: sql<number>`COALESCE((
          SELECT COUNT(*)::int FROM estimate WHERE estimate.salesman_id = "user"."id"
        ), 0)`,
        assignedCustomersCount: sql<number>`COALESCE((
          SELECT COUNT(*)::int FROM customer_assignment WHERE customer_assignment.salesman_id = "user"."id"
        ), 0)`,
      })
      .from(user)
      .where(eq(user.role, "salesman"))
      .orderBy(user.name);

    const totalEstimates = salesmenData.reduce(
      (sum, s) => sum + (s.estimatesCount || 0),
      0,
    );
    const activeCount = salesmenData.filter((s) => !s.banned).length;

    return {
      success: true,
      salesmen: salesmenData.map((s) => ({
        ...s,
        banned: s.banned || false,
        estimatesCount: s.estimatesCount || 0,
        assignedCustomersCount: s.assignedCustomersCount || 0,
      })),
      stats: {
        total: salesmenData.length,
        totalEstimates,
        activeCount,
      },
    };
  } catch (error) {
    console.error("Error fetching salesmen:", error);
    return {
      success: false,
      salesmen: [],
      stats: { total: 0, totalEstimates: 0, activeCount: 0 },
      error: "Failed to fetch salesmen",
    };
  }
}

// Get salesman by ID with assigned customers
export async function getSalesmanById(salesmanId: string): Promise<{
  success: boolean;
  salesman: SalesmanDetail | null;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, salesman: null, error: "Unauthorized" };
    }

    // Get salesman info
    const [salesmanData] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        createdAt: user.createdAt,
        banned: user.banned,
        estimatesCount: sql<number>`COALESCE((
          SELECT COUNT(*)::int FROM estimate WHERE estimate.salesman_id = "user"."id"
        ), 0)`,
      })
      .from(user)
      .where(and(eq(user.id, salesmanId), eq(user.role, "salesman")));

    if (!salesmanData) {
      return { success: false, salesman: null, error: "Salesman not found" };
    }

    // Get assigned customers
    const assignments = await db
      .select({
        customerId: customerAssignment.customerId,
        assignedAt: customerAssignment.assignedAt,
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phoneNumber,
        customerShopName: user.shopName,
      })
      .from(customerAssignment)
      .innerJoin(user, eq(customerAssignment.customerId, user.id))
      .where(eq(customerAssignment.salesmanId, salesmanId))
      .orderBy(user.name);

    const assignedCustomers: AssignedCustomer[] = assignments.map((a) => ({
      id: a.customerId,
      name: a.customerName,
      email: a.customerEmail,
      phoneNumber: a.customerPhone,
      shopName: a.customerShopName,
      assignedAt: a.assignedAt,
    }));

    return {
      success: true,
      salesman: {
        ...salesmanData,
        banned: salesmanData.banned || false,
        estimatesCount: salesmanData.estimatesCount || 0,
        assignedCustomers,
        assignedCustomersCount: assignedCustomers.length,
      },
    };
  } catch (error) {
    console.error("Error fetching salesman:", error);
    return {
      success: false,
      salesman: null,
      error: "Failed to fetch salesman",
    };
  }
}

// Get customers not assigned to any salesman
export async function getUnassignedCustomers(): Promise<{
  success: boolean;
  customers: {
    id: string;
    name: string;
    email: string;
    shopName: string | null;
  }[];
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, customers: [], error: "Unauthorized" };
    }

    // Get customer IDs that are already assigned
    const assignedIds = await db
      .select({ customerId: customerAssignment.customerId })
      .from(customerAssignment);

    const assignedCustomerIds = assignedIds.map((a) => a.customerId);

    // Get customers not in assigned list
    const customers = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        shopName: user.shopName,
      })
      .from(user)
      .where(
        assignedCustomerIds.length > 0
          ? and(
              eq(user.role, "customer"),
              notInArray(user.id, assignedCustomerIds),
            )
          : eq(user.role, "customer"),
      )
      .orderBy(user.name);

    return { success: true, customers };
  } catch (error) {
    console.error("Error fetching unassigned customers:", error);
    return {
      success: false,
      customers: [],
      error: "Failed to fetch customers",
    };
  }
}

// Assign customers to a salesman
export async function assignCustomers(
  salesmanId: string,
  customerIds: string[],
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    if (customerIds.length === 0) {
      return { success: false, error: "No customers selected" };
    }

    // Insert assignments (will fail on duplicate due to unique constraint)
    await db.insert(customerAssignment).values(
      customerIds.map((customerId) => ({
        customerId,
        salesmanId,
        assignedBy: session.user.id,
      })),
    );

    // Revalidate the salesman detail page
    revalidatePath(`${ADMIN_BASE}/salesmen/${salesmanId}`);

    return { success: true };
  } catch (error) {
    console.error("Error assigning customers:", error);
    return { success: false, error: "Failed to assign customers" };
  }
}

// Unassign a customer from a salesman
export async function unassignCustomer(
  salesmanId: string,
  customerId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    await db
      .delete(customerAssignment)
      .where(
        and(
          eq(customerAssignment.salesmanId, salesmanId),
          eq(customerAssignment.customerId, customerId),
        ),
      );

    // Revalidate the salesman detail page
    revalidatePath(`${ADMIN_BASE}/salesmen/${salesmanId}`);

    return { success: true };
  } catch (error) {
    console.error("Error unassigning customer:", error);
    return { success: false, error: "Failed to unassign customer" };
  }
}
