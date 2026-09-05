import { db } from "@bikalpo-project/db";
import { payee } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, ilike } from "drizzle-orm";
import { z } from "zod";

import { shopOrWarehousePermissionProcedure } from "../index";

const payeePermission = (action: "view" | "create" | "update" | "delete") =>
  shopOrWarehousePermissionProcedure("shop_payees", action, "contacts");

import { shopOrWarehouseOwnerScope } from "../shop-portal-scope";

export const payeeRouter = {
  /** Create a new payee */
  create: payeePermission("create")
    .route({
      method: "POST",
      path: "/payees",
      tags: ["Payee Management"],
      summary: "Create payee",
      description: "Add a new payee (no login, no dashboard access)",
    })
    .input(
      z.object({
        name: z.string().min(1).max(150).trim(),
        contactPerson: z.string().max(150).trim().optional(),
        phone: z.string().min(1).max(20).trim(),
        email: z.string().email().max(150).optional().nullable(),
        address: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      }),
    )
    .handler(async ({ context, input }) => {
      const [created] = await db
        .insert(payee)
        .values({
          ...input,
          addedBy: shopOrWarehouseOwnerScope(context.session.user, "contacts")
            .ownerId,
        })
        .returning();
      return { payee: created, message: "Payee created successfully" };
    }),

  /** Update a payee */
  update: payeePermission("update")
    .route({
      method: "PUT",
      path: "/payees/{id}",
      tags: ["Payee Management"],
      summary: "Update payee",
    })
    .input(
      z.object({
        id: z.number().int(),
        name: z.string().min(1).max(150).trim(),
        contactPerson: z.string().max(150).trim().optional().nullable(),
        phone: z.string().min(1).max(20).trim(),
        email: z.string().email().max(150).optional().nullable(),
        address: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      const existing = await db.query.payee.findFirst({
        where: and(
          eq(payee.id, id),
          eq(
            payee.addedBy,
            shopOrWarehouseOwnerScope(context.session.user, "contacts").ownerId,
          ),
        ),
      });
      if (!existing)
        throw new ORPCError("NOT_FOUND", { message: "Payee not found" });

      await db
        .update(payee)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(payee.id, id));
      return { message: "Payee updated successfully" };
    }),

  /** Get all payees for current user */
  getAll: payeePermission("view")
    .route({
      method: "POST",
      path: "/payees/list",
      tags: ["Payee Management"],
      summary: "List payees",
    })
    .input(z.object({ search: z.string().optional() }).optional())
    .handler(async ({ context, input }) => {
      const conditions = [
        eq(
          payee.addedBy,
          shopOrWarehouseOwnerScope(context.session.user, "contacts").ownerId,
        ),
        eq(payee.isActive, true),
      ];
      if (input?.search?.trim()) {
        conditions.push(ilike(payee.name, `%${input.search.trim()}%`));
      }
      return db.query.payee.findMany({
        where: and(...conditions),
        orderBy: (p, { asc }) => [asc(p.name)],
      });
    }),

  /** Soft-delete (deactivate) a payee */
  delete: payeePermission("delete")
    .route({
      method: "DELETE",
      path: "/payees/{id}",
      tags: ["Payee Management"],
      summary: "Deactivate payee",
    })
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ context, input }) => {
      const existing = await db.query.payee.findFirst({
        where: and(
          eq(payee.id, input.id),
          eq(
            payee.addedBy,
            shopOrWarehouseOwnerScope(context.session.user, "contacts").ownerId,
          ),
        ),
      });
      if (!existing)
        throw new ORPCError("NOT_FOUND", { message: "Payee not found" });

      await db
        .update(payee)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(payee.id, input.id));
      return { message: "Payee deactivated" };
    }),
};
