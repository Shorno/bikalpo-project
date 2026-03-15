import { db } from "@bikalpo-project/db";
import {
  customerHomeTab,
  customerHomeTabProduct,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure } from "../index";

const tabSchema = z.object({
  name: z.string().trim().min(1).max(150),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(150)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().min(0).optional(),
});

const tabWithIdSchema = tabSchema.extend({
  id: z.number().int().positive(),
});

const productSchema = z.object({
  tabId: z.number().int().positive(),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1000).optional().nullable(),
  image: z.string().trim().min(1).max(255),
  price: z.union([z.string(), z.number()]).transform((value) => String(value)),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().min(0).optional(),
});

const productWithIdSchema = productSchema.extend({
  id: z.number().int().positive(),
});

async function getNextTabOrder() {
  const [result] = await db
    .select({
      value: sql<number>`coalesce(max(${customerHomeTab.displayOrder}), -1) + 1`,
    })
    .from(customerHomeTab);

  return result?.value ?? 0;
}

async function getNextProductOrder(tabId: number) {
  const [result] = await db
    .select({
      value: sql<number>`coalesce(max(${customerHomeTabProduct.displayOrder}), -1) + 1`,
    })
    .from(customerHomeTabProduct)
    .where(eq(customerHomeTabProduct.tabId, tabId));

  return result?.value ?? 0;
}

async function listTabsWithProducts() {
  const tabs = await db.query.customerHomeTab.findMany({
    orderBy: [asc(customerHomeTab.displayOrder), asc(customerHomeTab.id)],
    with: {
      products: {
        orderBy: [
          asc(customerHomeTabProduct.displayOrder),
          asc(customerHomeTabProduct.id),
        ],
      },
    },
  });

  return tabs.map((tab) => ({
    ...tab,
    products: tab.products.map((productItem) => ({
      ...productItem,
      price: Number(productItem.price),
    })),
  }));
}

export const adminCustomerHomeTabRouter = {
  list: adminProcedure
    .route({
      method: "GET",
      path: "/admin/customer-home-tabs",
      tags: ["Admin Customer Home Tabs"],
      summary: "List customer home tabs",
    })
    .handler(async () => {
      return { tabs: await listTabsWithProducts() };
    }),

  createTab: adminProcedure
    .route({
      method: "POST",
      path: "/admin/customer-home-tabs",
      tags: ["Admin Customer Home Tabs"],
      summary: "Create customer home tab",
    })
    .input(tabSchema)
    .handler(async ({ input }) => {
      const [createdTab] = await db
        .insert(customerHomeTab)
        .values({
          ...input,
          description: input.description?.trim() || null,
          displayOrder: input.displayOrder ?? (await getNextTabOrder()),
        })
        .returning();

      return { tab: createdTab };
    }),

  updateTab: adminProcedure
    .route({
      method: "PUT",
      path: "/admin/customer-home-tabs/{id}",
      tags: ["Admin Customer Home Tabs"],
      summary: "Update customer home tab",
    })
    .input(tabWithIdSchema)
    .handler(async ({ input }) => {
      const [updatedTab] = await db
        .update(customerHomeTab)
        .set({
          name: input.name,
          slug: input.slug,
          description: input.description?.trim() || null,
          isActive: input.isActive,
          displayOrder: input.displayOrder ?? 0,
          updatedAt: new Date(),
        })
        .where(eq(customerHomeTab.id, input.id))
        .returning();

      if (!updatedTab) {
        throw new ORPCError("NOT_FOUND", { message: "Tab not found" });
      }

      return { tab: updatedTab };
    }),

  deleteTab: adminProcedure
    .route({
      method: "DELETE",
      path: "/admin/customer-home-tabs/{id}",
      tags: ["Admin Customer Home Tabs"],
      summary: "Delete customer home tab",
    })
    .input(z.object({ id: z.number().int().positive() }))
    .handler(async ({ input }) => {
      const [deletedTab] = await db
        .delete(customerHomeTab)
        .where(eq(customerHomeTab.id, input.id))
        .returning();

      if (!deletedTab) {
        throw new ORPCError("NOT_FOUND", { message: "Tab not found" });
      }

      return { success: true };
    }),

  reorderTabs: adminProcedure
    .route({
      method: "POST",
      path: "/admin/customer-home-tabs/reorder",
      tags: ["Admin Customer Home Tabs"],
      summary: "Reorder customer home tabs",
    })
    .input(
      z.object({ orderedIds: z.array(z.number().int().positive()).min(1) }),
    )
    .handler(async ({ input }) => {
      await Promise.all(
        input.orderedIds.map((id, index) =>
          db
            .update(customerHomeTab)
            .set({ displayOrder: index, updatedAt: new Date() })
            .where(eq(customerHomeTab.id, id)),
        ),
      );

      return { tabs: await listTabsWithProducts() };
    }),

  createProduct: adminProcedure
    .route({
      method: "POST",
      path: "/admin/customer-home-tabs/{tabId}/products",
      tags: ["Admin Customer Home Tabs"],
      summary: "Create tab product",
    })
    .input(productSchema)
    .handler(async ({ input }) => {
      const tab = await db.query.customerHomeTab.findFirst({
        where: eq(customerHomeTab.id, input.tabId),
        columns: { id: true },
      });

      if (!tab) {
        throw new ORPCError("NOT_FOUND", { message: "Tab not found" });
      }

      const [createdProduct] = await db
        .insert(customerHomeTabProduct)
        .values({
          ...input,
          description: input.description?.trim() || null,
          price: input.price,
          displayOrder:
            input.displayOrder ?? (await getNextProductOrder(input.tabId)),
        })
        .returning();

      return {
        product: {
          ...createdProduct,
          price: Number(createdProduct!.price),
        },
      };
    }),

  updateProduct: adminProcedure
    .route({
      method: "PUT",
      path: "/admin/customer-home-tabs/products/{id}",
      tags: ["Admin Customer Home Tabs"],
      summary: "Update tab product",
    })
    .input(productWithIdSchema)
    .handler(async ({ input }) => {
      const [updatedProduct] = await db
        .update(customerHomeTabProduct)
        .set({
          tabId: input.tabId,
          name: input.name,
          description: input.description?.trim() || null,
          image: input.image,
          price: input.price,
          isActive: input.isActive,
          displayOrder: input.displayOrder ?? 0,
          updatedAt: new Date(),
        })
        .where(eq(customerHomeTabProduct.id, input.id))
        .returning();

      if (!updatedProduct) {
        throw new ORPCError("NOT_FOUND", { message: "Product not found" });
      }

      return {
        product: {
          ...updatedProduct,
          price: Number(updatedProduct.price),
        },
      };
    }),

  deleteProduct: adminProcedure
    .route({
      method: "DELETE",
      path: "/admin/customer-home-tabs/products/{id}",
      tags: ["Admin Customer Home Tabs"],
      summary: "Delete tab product",
    })
    .input(z.object({ id: z.number().int().positive() }))
    .handler(async ({ input }) => {
      const [deletedProduct] = await db
        .delete(customerHomeTabProduct)
        .where(eq(customerHomeTabProduct.id, input.id))
        .returning();

      if (!deletedProduct) {
        throw new ORPCError("NOT_FOUND", { message: "Product not found" });
      }

      return { success: true };
    }),

  reorderProducts: adminProcedure
    .route({
      method: "POST",
      path: "/admin/customer-home-tabs/{tabId}/products/reorder",
      tags: ["Admin Customer Home Tabs"],
      summary: "Reorder tab products",
    })
    .input(
      z.object({
        tabId: z.number().int().positive(),
        orderedIds: z.array(z.number().int().positive()).min(1),
      }),
    )
    .handler(async ({ input }) => {
      const existingProducts = await db.query.customerHomeTabProduct.findMany({
        where: eq(customerHomeTabProduct.tabId, input.tabId),
        columns: { id: true },
      });

      const validIds = new Set(existingProducts.map((item) => item.id));
      const invalidId = input.orderedIds.find((id) => !validIds.has(id));
      if (invalidId) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Reorder request contains an invalid product id",
        });
      }

      await Promise.all(
        input.orderedIds.map((id, index) =>
          db
            .update(customerHomeTabProduct)
            .set({ displayOrder: index, updatedAt: new Date() })
            .where(eq(customerHomeTabProduct.id, id)),
        ),
      );

      const products = await db.query.customerHomeTabProduct.findMany({
        where: eq(customerHomeTabProduct.tabId, input.tabId),
        orderBy: [
          asc(customerHomeTabProduct.displayOrder),
          asc(customerHomeTabProduct.id),
        ],
      });

      return {
        products: products.map((item) => ({
          ...item,
          price: Number(item.price),
        })),
      };
    }),
};
