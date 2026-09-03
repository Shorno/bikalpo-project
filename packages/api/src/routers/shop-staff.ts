import { auth, setCredentialPassword } from "@bikalpo-project/auth";
import { passwordValidation } from "@bikalpo-project/auth/password-policy";
import {
  canManageShopStaff,
  isShopFunction,
  listAssignableShopFunctions,
  modulesForShopActor,
  platformRoleForShopFunction,
  presentShopDirectoryMember,
  resolveShopFunctionForUser,
  SHOP_FUNCTIONS,
  SHOP_STAFF_PLATFORM_ROLE,
  shopFunctionAccessLevel,
  shopFunctionLabel,
  shopPortalShopId,
} from "@bikalpo-project/auth/shop-staff-access";
import { db } from "@bikalpo-project/db";
import { user } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { shopOwnerProcedure, shopPortalProcedure } from "../index";

const shopFunctionSchema = z.enum(SHOP_FUNCTIONS);

const staffColumns = {
  id: user.id,
  name: user.name,
  email: user.email,
  phoneNumber: user.phoneNumber,
  role: user.role,
  shopFunction: user.shopFunction,
  shopId: user.shopId,
  banned: user.banned,
  createdAt: user.createdAt,
  serviceArea: user.serviceArea,
} as const;

function presentOwner(owner: {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string | null;
  role?: string | null;
  banned?: boolean | null;
  createdAt: Date;
  serviceArea?: string | null;
}) {
  return presentMember(
    {
      id: owner.id,
      name: owner.name,
      email: owner.email,
      phoneNumber: owner.phoneNumber ?? null,
      role: owner.role ?? "shop_owner",
      shopFunction: null,
      banned: owner.banned ?? false,
      createdAt: owner.createdAt,
      serviceArea: owner.serviceArea ?? null,
    },
    true,
  );
}

function presentMember(
  row: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string | null;
    role: string | null;
    shopFunction: string | null;
    banned: boolean | null;
    createdAt: Date;
    serviceArea: string | null;
  },
  isOwner: boolean,
) {
  const presented = presentShopDirectoryMember({
    id: row.id,
    name: row.name,
    role: isOwner ? "shop_owner" : row.role,
    shopFunction: row.shopFunction,
    banned: row.banned,
  });
  const actor = resolveShopFunctionForUser({
    role: isOwner ? "shop_owner" : row.role,
    shopFunction: row.shopFunction,
  });

  return {
    ...presented,
    email: row.email,
    phoneNumber: row.phoneNumber,
    platformRole: isOwner ? "shop_owner" : row.role,
    shopFunction: actor && actor !== "owner" ? actor : null,
    createdAt: row.createdAt,
    serviceArea: row.serviceArea,
  };
}

async function findShopStaffOrThrow(shopId: string, staffId: string) {
  const [staff] = await db
    .select(staffColumns)
    .from(user)
    .where(
      and(
        eq(user.id, staffId),
        eq(user.shopId, shopId),
        inArray(user.role, [SHOP_STAFF_PLATFORM_ROLE, "deliveryman"]),
      ),
    );

  if (!staff) {
    throw new ORPCError("NOT_FOUND", { message: "Shop staff member not found" });
  }

  return staff;
}

export const shopStaffRouter = {
  myAccess: shopPortalProcedure
    .route({
      method: "GET",
      path: "/shop-portal/me",
      tags: ["Shop Staff"],
      summary: "Current shop dashboard access for the signed-in owner or staff",
    })
    .handler(async ({ context }) => {
      const user = context.session.user;
      const actor = resolveShopFunctionForUser({
        role: user.role,
        shopFunction: (user as { shopFunction?: string | null }).shopFunction,
      });
      const shopId = shopPortalShopId({
        id: user.id,
        role: user.role,
        shopId: (user as { shopId?: string | null }).shopId,
      });
      if (!actor || !shopId) {
        throw new ORPCError("FORBIDDEN", {
          message: "Shop dashboard access required",
        });
      }

      return {
        actor,
        shopId,
        roleLabel:
          actor === "owner" ? "Super Admin" : shopFunctionLabel(actor),
        accessLevel:
          actor === "owner" ? "Full Control" : shopFunctionAccessLevel(actor),
        modules: modulesForShopActor(actor),
        canManageStaff: canManageShopStaff(actor),
      };
    }),

  listFunctions: shopOwnerProcedure
    .route({
      method: "GET",
      path: "/shop-owner/staff/functions",
      tags: ["Shop Staff"],
      summary: "List assignable shop functions",
    })
    .handler(async () => {
      return {
        functions: listAssignableShopFunctions().map((shopFunction) => ({
          id: shopFunction,
          label: shopFunctionLabel(shopFunction),
          accessLevel: shopFunctionAccessLevel(shopFunction),
          platformRole: platformRoleForShopFunction(shopFunction),
          modules: modulesForShopActor(shopFunction),
        })),
      };
    }),

  list: shopOwnerProcedure
    .route({
      method: "GET",
      path: "/shop-owner/staff",
      tags: ["Shop Staff"],
      summary: "List shop owner and staff",
    })
    .handler(async ({ context }) => {
      const owner = context.session.user;
      const staff = await db
        .select(staffColumns)
        .from(user)
        .where(
          and(
            eq(user.shopId, owner.id),
            inArray(user.role, [SHOP_STAFF_PLATFORM_ROLE, "deliveryman"]),
          ),
        )
        .orderBy(user.name);

      return {
        members: [
          presentOwner(owner),
          ...staff.map((row) => presentMember(row, false)),
        ],
      };
    }),

  getById: shopOwnerProcedure
    .route({
      method: "GET",
      path: "/shop-owner/staff/{staffId}",
      tags: ["Shop Staff"],
      summary: "Get shop staff profile",
    })
    .input(z.object({ staffId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const owner = context.session.user;
      if (input.staffId === owner.id) {
        return presentOwner(owner);
      }

      const staff = await findShopStaffOrThrow(owner.id, input.staffId);
      return presentMember(staff, false);
    }),

  create: shopOwnerProcedure
    .route({
      method: "POST",
      path: "/shop-owner/staff",
      tags: ["Shop Staff"],
      summary: "Create shop staff and assign a function",
    })
    .input(
      z.object({
        name: z.string().trim().min(2).max(100),
        email: z.string().trim().email(),
        password: passwordValidation,
        phoneNumber: z.string().trim().max(20).optional(),
        shopFunction: shopFunctionSchema,
        serviceArea: z.string().trim().max(200).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const shopId = context.session.user.id;
      const platformRole = platformRoleForShopFunction(input.shopFunction);

      let created: { user: { id: string; name: string; email: string; createdAt: Date } };
      try {
        created = await auth.api.createUser({
          body: {
            email: input.email,
            password: input.password,
            name: input.name,
            role: platformRole,
            data: {
              phoneNumber: input.phoneNumber || null,
            },
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create shop staff";
        throw new ORPCError("BAD_REQUEST", { message });
      }

      if (!created?.user) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Failed to create shop staff",
        });
      }

      await db
        .update(user)
        .set({
          shopId,
          warehouseId: null,
          shopFunction: input.shopFunction,
          serviceArea:
            input.shopFunction === "delivery" ? input.serviceArea || null : null,
        })
        .where(eq(user.id, created.user.id));

      const staff = await findShopStaffOrThrow(shopId, created.user.id);
      return {
        message: "Staff member created",
        member: presentMember(staff, false),
      };
    }),

  assignFunction: shopOwnerProcedure
    .route({
      method: "POST",
      path: "/shop-owner/staff/{staffId}/function",
      tags: ["Shop Staff"],
      summary: "Assign a shop function to staff",
    })
    .input(
      z.object({
        staffId: z.string().min(1),
        shopFunction: shopFunctionSchema,
      }),
    )
    .handler(async ({ context, input }) => {
      const shopId = context.session.user.id;
      if (input.staffId === shopId) {
        throw new ORPCError("BAD_REQUEST", {
          message: "The shop owner is not assigned a staff function",
        });
      }

      const staff = await findShopStaffOrThrow(shopId, input.staffId);
      const nextRole = platformRoleForShopFunction(input.shopFunction);
      await db
        .update(user)
        .set({
          role: nextRole,
          shopFunction: input.shopFunction,
          serviceArea:
            input.shopFunction === "delivery" ? staff.serviceArea : null,
        })
        .where(eq(user.id, staff.id));

      const updated = await findShopStaffOrThrow(shopId, staff.id);
      return {
        message: "Staff function updated",
        member: presentMember(updated, false),
      };
    }),

  update: shopOwnerProcedure
    .route({
      method: "PUT",
      path: "/shop-owner/staff/{staffId}",
      tags: ["Shop Staff"],
      summary: "Update shop staff profile",
    })
    .input(
      z.object({
        staffId: z.string().min(1),
        name: z.string().trim().min(2).max(100).optional(),
        phoneNumber: z.string().trim().max(20).nullable().optional(),
        serviceArea: z.string().trim().max(200).nullable().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const shopId = context.session.user.id;
      if (input.staffId === shopId) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Update the owner profile from Settings",
        });
      }

      const staff = await findShopStaffOrThrow(shopId, input.staffId);
      const nextFunction = isShopFunction(staff.shopFunction)
        ? staff.shopFunction
        : staff.role === "deliveryman"
          ? "delivery"
          : null;

      await db
        .update(user)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.phoneNumber !== undefined
            ? { phoneNumber: input.phoneNumber }
            : {}),
          ...(input.serviceArea !== undefined
            ? {
                serviceArea:
                  nextFunction === "delivery" ? input.serviceArea : null,
              }
            : {}),
        })
        .where(eq(user.id, staff.id));

      const updated = await findShopStaffOrThrow(shopId, staff.id);
      return {
        message: "Staff member updated",
        member: presentMember(updated, false),
      };
    }),

  resetPassword: shopOwnerProcedure
    .route({
      method: "POST",
      path: "/shop-owner/staff/{staffId}/reset-password",
      tags: ["Shop Staff"],
      summary: "Reset shop staff password",
    })
    .input(
      z.object({
        staffId: z.string().min(1),
        newPassword: passwordValidation,
      }),
    )
    .handler(async ({ context, input }) => {
      const shopId = context.session.user.id;
      if (input.staffId === shopId) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Change the owner password from Settings",
        });
      }

      await findShopStaffOrThrow(shopId, input.staffId);
      await setCredentialPassword(input.staffId, input.newPassword);
      return { message: "Password updated" };
    }),

  toggleBan: shopOwnerProcedure
    .route({
      method: "POST",
      path: "/shop-owner/staff/{staffId}/ban",
      tags: ["Shop Staff"],
      summary: "Ban or unban shop staff",
    })
    .input(
      z.object({
        staffId: z.string().min(1),
        banned: z.boolean(),
        reason: z.string().trim().max(200).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const shopId = context.session.user.id;
      if (input.staffId === shopId) {
        throw new ORPCError("BAD_REQUEST", {
          message: "The shop owner cannot be banned from this page",
        });
      }

      await findShopStaffOrThrow(shopId, input.staffId);
      await db
        .update(user)
        .set({
          banned: input.banned,
          banReason: input.banned ? input.reason || "Banned by shop owner" : null,
          banExpires: null,
        })
        .where(eq(user.id, input.staffId));

      const updated = await findShopStaffOrThrow(shopId, input.staffId);
      return {
        message: input.banned ? "Staff member banned" : "Staff member restored",
        member: presentMember(updated, false),
      };
    }),

  remove: shopOwnerProcedure
    .route({
      method: "DELETE",
      path: "/shop-owner/staff/{staffId}",
      tags: ["Shop Staff"],
      summary: "Delete shop staff",
    })
    .input(z.object({ staffId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const shopId = context.session.user.id;
      if (input.staffId === shopId) {
        throw new ORPCError("BAD_REQUEST", {
          message: "The shop owner cannot be deleted from this page",
        });
      }

      await findShopStaffOrThrow(shopId, input.staffId);
      await auth.api.removeUser({
        body: { userId: input.staffId },
        headers: new Headers({
          Authorization: `Bearer ${context.session.session.token}`,
        }),
      });
      return { success: true };
    }),
};
