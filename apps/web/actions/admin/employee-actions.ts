"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";

export type EmployeeRole = "salesman" | "deliveryman";

export interface Employee {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  role: string;
  createdAt: Date;
  banned: boolean;
}

export interface EmployeeStats {
  total: number;
  deliverymen: number;
  salesmen: number;
}

export interface CreateEmployeeInput {
  name: string;
  email: string;
  password: string;
  phoneNumber?: string;
  role: EmployeeRole;
}

export interface UpdateEmployeeInput {
  name?: string;
  phoneNumber?: string;
}

// Helper: Check if current user is admin
async function requireAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  return session;
}

// Get all employees (deliveryman and salesman roles)
export async function getEmployees(): Promise<{
  success: boolean;
  employees: Employee[];
  stats: EmployeeStats;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return {
        success: false,
        employees: [],
        stats: { total: 0, deliverymen: 0, salesmen: 0 },
        error: "Unauthorized",
      };
    }

    const employees = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        createdAt: user.createdAt,
        banned: user.banned,
      })
      .from(user)
      .where(inArray(user.role, ["deliveryman", "salesman"]))
      .orderBy(user.name);

    const stats: EmployeeStats = {
      total: employees.length,
      deliverymen: employees.filter((e) => e.role === "deliveryman").length,
      salesmen: employees.filter((e) => e.role === "salesman").length,
    };

    return {
      success: true,
      employees: employees.map((e) => ({
        ...e,
        role: e.role || "unknown",
        banned: e.banned || false,
      })),
      stats,
    };
  } catch (error) {
    console.error("Error fetching employees:", error);
    return {
      success: false,
      employees: [],
      stats: { total: 0, deliverymen: 0, salesmen: 0 },
      error: "Failed to fetch employees",
    };
  }
}

/**
 * Create a new employee (salesman or deliveryman)
 * Uses Better Auth admin API - no email invitation needed
 */
export async function createEmployee(input: CreateEmployeeInput): Promise<{
  success: boolean;
  employee?: Employee;
  error?: string;
}> {
  try {
    await requireAdmin();

    // Create user via Better Auth admin API with "user" role first
    // (Better Auth only accepts "user" or "admin" as built-in roles)
    const newUser = await auth.api.createUser({
      body: {
        email: input.email,
        password: input.password,
        name: input.name,
        role: "user", // Create with base role first
        data: {
          phoneNumber: input.phoneNumber || null,
        },
      },
    });

    if (!newUser?.user) {
      return {
        success: false,
        error: "Failed to create employee",
      };
    }

    // Update to the actual custom role (salesman/deliveryman) via database
    await db
      .update(user)
      .set({ role: input.role })
      .where(eq(user.id, newUser.user.id));

    revalidatePath("/dashboard/admin/salesmen");
    revalidatePath("/dashboard/admin/deliverymen");

    return {
      success: true,
      employee: {
        id: newUser.user.id,
        name: newUser.user.name,
        email: newUser.user.email,
        phoneNumber:
          (newUser.user as { phoneNumber?: string | null }).phoneNumber || null,
        role: input.role,
        createdAt: newUser.user.createdAt,
        banned: false,
      },
    };
  } catch (error) {
    console.error("Error creating employee:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create employee";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Update employee details (name, phone number)
 */
export async function updateEmployee(
  userId: string,
  input: UpdateEmployeeInput,
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requireAdmin();

    const updateData: Record<string, string | null> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.phoneNumber !== undefined)
      updateData.phoneNumber = input.phoneNumber;

    if (Object.keys(updateData).length === 0) {
      return { success: true };
    }

    await db.update(user).set(updateData).where(eq(user.id, userId));

    revalidatePath("/dashboard/admin/salesmen");
    revalidatePath("/dashboard/admin/deliverymen");

    return { success: true };
  } catch (error) {
    console.error("Error updating employee:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update employee",
    };
  }
}

/**
 * Reset employee password (admin only)
 */
export async function resetEmployeePassword(
  userId: string,
  newPassword: string,
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requireAdmin();

    await auth.api.setUserPassword({
      body: {
        userId,
        newPassword,
      },
      headers: await headers(),
    });

    return { success: true };
  } catch (error) {
    console.error("Error resetting password:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to reset password",
    };
  }
}

/**
 * Delete employee (hard delete)
 */
export async function deleteEmployee(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requireAdmin();

    await auth.api.removeUser({
      body: { userId },
      headers: await headers(),
    });

    revalidatePath("/dashboard/admin/salesmen");
    revalidatePath("/dashboard/admin/deliverymen");

    return { success: true };
  } catch (error) {
    console.error("Error deleting employee:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete employee",
    };
  }
}

/**
 * Ban/unban employee
 */
export async function toggleEmployeeBan(
  userId: string,
  banned: boolean,
  reason?: string,
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requireAdmin();

    if (banned) {
      await auth.api.banUser({
        body: {
          userId,
          banReason: reason || "Banned by admin",
        },
        headers: await headers(),
      });
    } else {
      await auth.api.unbanUser({
        body: { userId },
        headers: await headers(),
      });
    }

    revalidatePath("/dashboard/admin/salesmen");
    revalidatePath("/dashboard/admin/deliverymen");

    return { success: true };
  } catch (error) {
    console.error("Error toggling employee ban:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update employee status",
    };
  }
}
