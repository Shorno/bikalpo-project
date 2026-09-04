import {
  isValidShopPermissionMapInput,
  normalizeShopPermissionMap,
  SHOP_PERMISSION_ACTIONS,
  SHOP_PERMISSION_MODULE_LABELS,
  SHOP_PERMISSION_PAGES,
  SHOP_PERMISSION_STATEMENT,
  SHOP_OWNER_ONLY_RESOURCES,
  type ShopPermissionMap,
} from "@bikalpo-project/auth/shop-permissions";
import { isShopFunction } from "@bikalpo-project/auth/shop-staff-access";
import { db } from "@bikalpo-project/db";
import {
  shopPermissionAudit,
  shopRole,
  shopRolePermission,
  shopUserRole,
  user,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";

import { shopOwnerProcedure } from "../index";
import { ensureDefaultShopRoles, permissionRows } from "../shop-role-store";

const permissionInput = z.array(
  z.object({
    resource: z.string().min(1),
    actions: z.array(z.enum(SHOP_PERMISSION_ACTIONS)),
  }),
);

function validatedPermissionMap(
  rows: z.infer<typeof permissionInput>,
): ShopPermissionMap {
  const raw = Object.fromEntries(
    rows.map((row) => [row.resource, row.actions]),
  );
  const normalized = normalizeShopPermissionMap(raw);
  const ownerOnlyResource = SHOP_OWNER_ONLY_RESOURCES.find(
    (resource) => resource in raw,
  );
  if (ownerOnlyResource || !isValidShopPermissionMapInput(raw)) {
    throw new ORPCError("BAD_REQUEST", {
      message:
        ownerOnlyResource
          ? "Settings, system control, and role management are reserved for the shop owner"
          : "The role contains an unknown page or action",
    });
  }
  return normalized;
}

async function roleForShop(shopId: string, roleId: number) {
  const [role] = await db
    .select()
    .from(shopRole)
    .where(and(eq(shopRole.id, roleId), eq(shopRole.shopId, shopId)))
    .limit(1);
  if (!role) {
    throw new ORPCError("NOT_FOUND", { message: "Shop role not found" });
  }
  return role;
}

async function listRoles(shopId: string) {
  await ensureDefaultShopRoles(shopId);
  const roles = await db
    .select({
      id: shopRole.id,
      name: shopRole.name,
      description: shopRole.description,
      isSystem: shopRole.isSystem,
      legacyFunction: shopRole.legacyFunction,
      memberCount: count(shopUserRole.userId),
    })
    .from(shopRole)
    .leftJoin(shopUserRole, eq(shopUserRole.roleId, shopRole.id))
    .where(eq(shopRole.shopId, shopId))
    .groupBy(shopRole.id)
    .orderBy(asc(shopRole.name));
  const grants = await db
    .select({
      roleId: shopRolePermission.roleId,
      resource: shopRolePermission.resource,
      actions: shopRolePermission.actions,
    })
    .from(shopRolePermission)
    .innerJoin(shopRole, eq(shopRole.id, shopRolePermission.roleId))
    .where(eq(shopRole.shopId, shopId));
  const assignments = await db
    .select({ roleId: shopUserRole.roleId, userId: shopUserRole.userId })
    .from(shopUserRole)
    .where(eq(shopUserRole.shopId, shopId));
  return roles.map((role) => ({
    ...role,
    permissions: grants
      .filter((grant) => grant.roleId === role.id)
      .map(({ resource, actions }) => ({ resource, actions })),
    memberIds: assignments
      .filter((assignment) => assignment.roleId === role.id)
      .map((assignment) => assignment.userId),
  }));
}

export const shopRoleRouter = {
  catalog: shopOwnerProcedure
    .route({
      method: "GET",
      path: "/shop-owner/roles/catalog",
      tags: ["Shop Roles"],
    })
    .handler(() => ({
      actions: SHOP_PERMISSION_ACTIONS,
      modules: Object.entries(SHOP_PERMISSION_MODULE_LABELS)
        .filter(([id]) => !["staff", "settings"].includes(id))
        .map(([id, label]) => ({
          id,
          label,
          pages: SHOP_PERMISSION_PAGES.filter(
              (page) =>
                page.module === id &&
                !SHOP_OWNER_ONLY_RESOURCES.some(
                  (resource) => resource === page.resource,
                ),
          ).map((page) => ({
            resource: page.resource,
            label: page.label,
            description: page.description,
            href: page.href,
            actions: SHOP_PERMISSION_STATEMENT[page.resource],
          })),
        })),
    })),

  list: shopOwnerProcedure
    .route({ method: "GET", path: "/shop-owner/roles", tags: ["Shop Roles"] })
    .handler(({ context }) => listRoles(context.session.user.id)),

  create: shopOwnerProcedure
    .route({ method: "POST", path: "/shop-owner/roles", tags: ["Shop Roles"] })
    .input(
      z.object({
        name: z.string().trim().min(2).max(80),
        description: z.string().trim().max(300).nullable().optional(),
        permissions: permissionInput,
      }),
    )
    .handler(async ({ context, input }) => {
      const shopId = context.session.user.id;
      const permissions = validatedPermissionMap(input.permissions);
      try {
        const role = await db.transaction(async (tx) => {
          const [created] = await tx
            .insert(shopRole)
            .values({
              shopId,
              name: input.name,
              description: input.description || null,
            })
            .returning();
          if (!created) throw new Error("Role was not created");
          const rows = permissionRows(created.id, permissions);
          if (rows.length) await tx.insert(shopRolePermission).values(rows);
          await tx.insert(shopPermissionAudit).values({
            shopId,
            roleId: created.id,
            changedByUserId: shopId,
            event: "role.created",
            after: { name: created.name, permissions },
          });
          return created;
        });
        return { role, roles: await listRoles(shopId) };
      } catch (error) {
        throw new ORPCError("BAD_REQUEST", {
          message:
            error instanceof Error && error.message.includes("unique")
              ? "A role with this name already exists"
              : "Could not create role",
        });
      }
    }),

  update: shopOwnerProcedure
    .route({
      method: "PUT",
      path: "/shop-owner/roles/{roleId}",
      tags: ["Shop Roles"],
    })
    .input(
      z.object({
        roleId: z.number().int().positive(),
        name: z.string().trim().min(2).max(80),
        description: z.string().trim().max(300).nullable().optional(),
        permissions: permissionInput,
      }),
    )
    .handler(async ({ context, input }) => {
      const shopId = context.session.user.id;
      const current = await roleForShop(shopId, input.roleId);
      const permissions = validatedPermissionMap(input.permissions);
      await db.transaction(async (tx) => {
        await tx
          .update(shopRole)
          .set({ name: input.name, description: input.description || null })
          .where(eq(shopRole.id, current.id));
        await tx
          .delete(shopRolePermission)
          .where(eq(shopRolePermission.roleId, current.id));
        const rows = permissionRows(current.id, permissions);
        if (rows.length) await tx.insert(shopRolePermission).values(rows);
        await tx.insert(shopPermissionAudit).values({
          shopId,
          roleId: current.id,
          changedByUserId: shopId,
          event: "role.updated",
          before: { name: current.name },
          after: { name: input.name, permissions },
        });
      });
      return { roles: await listRoles(shopId) };
    }),

  remove: shopOwnerProcedure
    .route({
      method: "DELETE",
      path: "/shop-owner/roles/{roleId}",
      tags: ["Shop Roles"],
    })
    .input(z.object({ roleId: z.number().int().positive() }))
    .handler(async ({ context, input }) => {
      const shopId = context.session.user.id;
      const role = await roleForShop(shopId, input.roleId);
      if (role.isSystem) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Default roles cannot be deleted, but they can be edited",
        });
      }
      const [assignment] = await db
        .select({ userId: shopUserRole.userId })
        .from(shopUserRole)
        .where(eq(shopUserRole.roleId, role.id))
        .limit(1);
      if (assignment) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Reassign this role's staff before deleting it",
        });
      }
      await db.insert(shopPermissionAudit).values({
        shopId,
        changedByUserId: shopId,
        event: "role.deleted",
        before: { roleId: role.id, name: role.name },
      });
      await db.delete(shopRole).where(eq(shopRole.id, role.id));
      return { roles: await listRoles(shopId) };
    }),

  assign: shopOwnerProcedure
    .route({
      method: "POST",
      path: "/shop-owner/roles/{roleId}/assign",
      tags: ["Shop Roles"],
    })
    .input(
      z.object({
        roleId: z.number().int().positive(),
        staffId: z.string().min(1),
      }),
    )
    .handler(async ({ context, input }) => {
      const shopId = context.session.user.id;
      const role = await roleForShop(shopId, input.roleId);
      const [staff] = await db
        .select({ id: user.id })
        .from(user)
        .where(
          and(
            eq(user.id, input.staffId),
            eq(user.shopId, shopId),
            eq(user.role, "shop_staff"),
          ),
        )
        .limit(1);
      if (!staff) {
        throw new ORPCError("NOT_FOUND", {
          message: "Shop staff member not found",
        });
      }
      const shopFunction = isShopFunction(role.legacyFunction)
        ? role.legacyFunction
        : "custom";
      await db.transaction(async (tx) => {
        await tx
          .insert(shopUserRole)
          .values({ userId: staff.id, shopId, roleId: role.id })
          .onConflictDoUpdate({
            target: shopUserRole.userId,
            set: { roleId: role.id, shopId },
          });
        await tx
          .update(user)
          .set({ shopFunction })
          .where(eq(user.id, staff.id));
        await tx.insert(shopPermissionAudit).values({
          shopId,
          roleId: role.id,
          changedByUserId: shopId,
          subjectUserId: staff.id,
          event: "role.assigned",
          after: { roleId: role.id, roleName: role.name },
        });
      });
      return { roles: await listRoles(shopId) };
    }),
};
