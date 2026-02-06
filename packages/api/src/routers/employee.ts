import { auth } from "@bikalpo-project/auth";
import { db } from "@bikalpo-project/db";
import { user } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure } from "../index";

// Validation schemas
const employeeRoleSchema = z.enum(["salesman", "deliveryman"]);

const createEmployeeSchema = z.object({
    name: z.string().min(2).max(100).trim(),
    email: z.string().email().trim(),
    password: z.string().min(8).max(100),
    phoneNumber: z.string().max(20).optional(),
    role: employeeRoleSchema,
});

const updateEmployeeSchema = z.object({
    id: z.string(),
    name: z.string().min(2).max(100).trim().optional(),
    phoneNumber: z.string().max(20).optional(),
});

const resetPasswordSchema = z.object({
    userId: z.string(),
    newPassword: z.string().min(8).max(100),
});

const toggleBanSchema = z.object({
    userId: z.string(),
    banned: z.boolean(),
    reason: z.string().optional(),
});

const deleteEmployeeSchema = z.object({
    id: z.string(),
});

export const employeeRouter = {
    /**
     * Get all employees (deliveryman and salesman roles)
     * REST: GET /employees
     */
    getAll: adminProcedure
        .route({
            method: "GET",
            path: "/employees",
            tags: ["Employees"],
            summary: "Get all employees",
            description: "Get all employees with salesman and deliveryman roles",
        })
        .handler(async () => {
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

            const stats = {
                total: employees.length,
                deliverymen: employees.filter((e) => e.role === "deliveryman").length,
                salesmen: employees.filter((e) => e.role === "salesman").length,
            };

            return {
                employees: employees.map((e) => ({
                    ...e,
                    role: e.role || "unknown",
                    banned: e.banned || false,
                })),
                stats,
            };
        }),

    /**
     * Create a new employee
     * REST: POST /employees
     */
    create: adminProcedure
        .route({
            method: "POST",
            path: "/employees",
            tags: ["Employees"],
            summary: "Create employee",
            description: "Create a new salesman or deliveryman",
        })
        .input(createEmployeeSchema)
        .handler(async ({ input }) => {
            // Create user via Better Auth admin API with the correct role directly
            const newUser = await auth.api.createUser({
                body: {
                    email: input.email,
                    password: input.password,
                    name: input.name,
                    role: input.role, // Directly assign salesman or deliveryman role
                    data: {
                        phoneNumber: input.phoneNumber || null,
                    },
                },
            });

            if (!newUser?.user) {
                throw new ORPCError("INTERNAL_SERVER_ERROR", {
                    message: "Failed to create employee",
                });
            }

            return {
                message: "Employee created successfully",
                employee: {
                    id: newUser.user.id,
                    name: newUser.user.name,
                    email: newUser.user.email,
                    phoneNumber:
                        (newUser.user as { phoneNumber?: string | null }).phoneNumber ||
                        null,
                    role: input.role,
                    createdAt: newUser.user.createdAt,
                    banned: false,
                },
            };
        }),

    /**
     * Update employee details
     * REST: PUT /employees/:id
     */
    update: adminProcedure
        .route({
            method: "PUT",
            path: "/employees/{id}",
            tags: ["Employees"],
            summary: "Update employee",
            description: "Update employee name and phone number",
        })
        .input(updateEmployeeSchema)
        .handler(async ({ input }) => {
            const updateData: Record<string, string | null> = {};
            if (input.name !== undefined) updateData.name = input.name;
            if (input.phoneNumber !== undefined)
                updateData.phoneNumber = input.phoneNumber;

            if (Object.keys(updateData).length === 0) {
                return { message: "No changes to apply" };
            }

            const [updated] = await db
                .update(user)
                .set(updateData)
                .where(eq(user.id, input.id))
                .returning({ id: user.id });

            if (!updated) {
                throw new ORPCError("NOT_FOUND", { message: "Employee not found" });
            }

            return { message: "Employee updated successfully" };
        }),

    /**
     * Delete an employee
     * REST: DELETE /employees/:id
     */
    delete: adminProcedure
        .route({
            method: "DELETE",
            path: "/employees/{id}",
            tags: ["Employees"],
            summary: "Delete employee",
            description: "Permanently delete an employee account",
        })
        .input(deleteEmployeeSchema)
        .handler(async ({ input, context }) => {
            await auth.api.removeUser({
                body: { userId: input.id },
                headers: new Headers({
                    Authorization: `Bearer ${context.session.session.token}`,
                }),
            });

            return { message: "Employee deleted successfully" };
        }),

    /**
     * Reset employee password
     * REST: POST /employees/reset-password
     */
    resetPassword: adminProcedure
        .route({
            method: "POST",
            path: "/employees/reset-password",
            tags: ["Employees"],
            summary: "Reset employee password",
            description: "Reset an employee's password (admin only)",
        })
        .input(resetPasswordSchema)
        .handler(async ({ input, context }) => {
            await auth.api.setUserPassword({
                body: {
                    userId: input.userId,
                    newPassword: input.newPassword,
                },
                headers: new Headers({
                    Authorization: `Bearer ${context.session.session.token}`,
                }),
            });

            return { message: "Password reset successfully" };
        }),

    /**
     * Ban or unban an employee
     * REST: POST /employees/toggle-ban
     */
    toggleBan: adminProcedure
        .route({
            method: "POST",
            path: "/employees/toggle-ban",
            tags: ["Employees"],
            summary: "Ban or unban employee",
            description: "Toggle ban status for an employee",
        })
        .input(toggleBanSchema)
        .handler(async ({ input, context }) => {
            const headers = new Headers({
                Authorization: `Bearer ${context.session.session.token}`,
            });

            if (input.banned) {
                await auth.api.banUser({
                    body: {
                        userId: input.userId,
                        banReason: input.reason || "Banned by admin",
                    },
                    headers,
                });
            } else {
                await auth.api.unbanUser({
                    body: { userId: input.userId },
                    headers,
                });
            }

            return {
                message: input.banned
                    ? "Employee banned successfully"
                    : "Employee unbanned successfully",
            };
        }),
};
