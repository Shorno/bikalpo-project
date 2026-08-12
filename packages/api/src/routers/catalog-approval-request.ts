import { db } from "@bikalpo-project/db";
import {
  brand,
  catalogApprovalRequest,
  category,
  coreProductIdentity,
  productType,
  subCategory,
  user,
  variantOption,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  isNull,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { adminProcedure, catalogRequesterProcedure } from "../index";
import { nextSkuCode } from "./helpers/generate-sku";
import {
  createStructuredVariantOption,
  prepareStructuredVariantOption,
  type StructuredVariantOptionInput,
  structuredVariantOptionInputSchema,
} from "./helpers/structured-variant-option";

const requestTypeSchema = z.enum(["brand", "variant_option", "core_product"]);
const requestStatusSchema = z.enum(["pending", "approved", "rejected"]);
const requestDateRangeSchema = z.enum([
  "all",
  "today",
  "last_7_days",
  "last_30_days",
  "this_month",
]);

const brandPayloadSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .trim(),
  logo: z.string().max(255).optional().nullable(),
  displayOrder: z.number().int().min(0).default(0),
});

const variantPayloadSchema = structuredVariantOptionInputSchema;

const coreProductPayloadSchema = z.object({
  sku: z.string().max(20).optional().nullable(),
  name: z.string().min(1).max(150).trim(),
  slug: z
    .string()
    .min(1)
    .max(150)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .trim(),
  description: z.string().optional().nullable(),
  image: z.string().min(1).max(255),
  typeId: z.number().int(),
  categoryId: z.number().int(),
  subCategoryId: z.number().int().optional().nullable(),
});

const createRequestInput = z.discriminatedUnion("requestType", [
  z.object({ requestType: z.literal("brand"), payload: brandPayloadSchema }),
  z.object({
    requestType: z.literal("variant_option"),
    payload: variantPayloadSchema,
  }),
  z.object({
    requestType: z.literal("core_product"),
    payload: coreProductPayloadSchema,
  }),
]);

const approveRequestInput = z.discriminatedUnion("requestType", [
  z.object({
    id: z.number().int(),
    requestType: z.literal("brand"),
    payload: brandPayloadSchema,
    adminNote: z.string().optional(),
  }),
  z.object({
    id: z.number().int(),
    requestType: z.literal("variant_option"),
    payload: variantPayloadSchema,
    adminNote: z.string().optional(),
  }),
  z.object({
    id: z.number().int(),
    requestType: z.literal("core_product"),
    payload: coreProductPayloadSchema,
    adminNote: z.string().optional(),
  }),
]);

const requestListInput = z.object({
  requestType: requestTypeSchema.optional(),
  status: z.union([requestStatusSchema, z.literal("all")]).optional(),
  dateRange: requestDateRangeSchema.optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

function getDateRangeStart(dateRange?: z.infer<typeof requestDateRangeSchema>) {
  if (!dateRange || dateRange === "all") return null;

  const start = new Date();
  if (dateRange === "today") {
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (dateRange === "this_month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  start.setDate(start.getDate() - (dateRange === "last_7_days" ? 6 : 29));
  start.setHours(0, 0, 0, 0);
  return start;
}

function parsePayload(
  type: z.infer<typeof requestTypeSchema>,
  payload: unknown,
) {
  if (type === "brand") return brandPayloadSchema.parse(payload);
  if (type === "variant_option") return variantPayloadSchema.parse(payload);
  return coreProductPayloadSchema.parse(payload);
}

async function assertCoreProductScope(
  input: z.infer<typeof coreProductPayloadSchema>,
  database = db,
) {
  const cat = await database.query.category.findFirst({
    where: eq(category.id, input.categoryId),
    columns: { id: true, typeId: true },
  });
  if (!cat) {
    throw new ORPCError("BAD_REQUEST", { message: "Category not found" });
  }
  if (cat.typeId !== input.typeId) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Category does not belong to selected type",
    });
  }

  if (input.subCategoryId) {
    const sub = await database.query.subCategory.findFirst({
      where: eq(subCategory.id, input.subCategoryId),
      columns: { id: true, categoryId: true },
    });
    if (!sub) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Sub category not found",
      });
    }
    if (sub.categoryId !== input.categoryId) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Sub category does not belong to selected category",
      });
    }
  }
}

async function createBrandFromPayload(
  input: z.infer<typeof brandPayloadSchema>,
  database = db,
) {
  const duplicate = await database.query.brand.findFirst({
    where: or(eq(brand.name, input.name), eq(brand.slug, input.slug)),
    columns: { id: true, name: true, slug: true },
  });
  if (duplicate) {
    throw new ORPCError("CONFLICT", {
      message: "A brand with the same name or slug already exists",
    });
  }

  const skuCode = await nextSkuCode(
    brand,
    brand.skuCode,
    2,
    undefined,
    database,
  );
  const [created] = await database
    .insert(brand)
    .values({
      name: input.name,
      slug: input.slug,
      logo: input.logo || null,
      displayOrder: input.displayOrder,
      skuCode,
    })
    .returning();

  return created!;
}

async function createCoreProductFromPayload(
  input: z.infer<typeof coreProductPayloadSchema>,
  database = db,
) {
  await assertCoreProductScope(input, database);

  const duplicate = await database.query.coreProductIdentity.findFirst({
    where: or(
      eq(coreProductIdentity.name, input.name),
      eq(coreProductIdentity.slug, input.slug),
    ),
    columns: { id: true },
  });
  if (duplicate) {
    throw new ORPCError("CONFLICT", {
      message: "A core product with the same name or slug already exists",
    });
  }

  let sku = input.sku || undefined;
  if (!sku) {
    const filterCondition = input.subCategoryId
      ? sql`${coreProductIdentity.subCategoryId} = ${input.subCategoryId}`
      : sql`${coreProductIdentity.categoryId} = ${input.categoryId} AND ${coreProductIdentity.subCategoryId} IS NULL`;
    sku = await nextSkuCode(
      coreProductIdentity,
      coreProductIdentity.sku,
      3,
      filterCondition,
      database,
    );
  }

  const scopeCondition = input.subCategoryId
    ? and(
        eq(coreProductIdentity.sku, sku),
        eq(coreProductIdentity.subCategoryId, input.subCategoryId),
      )
    : and(
        eq(coreProductIdentity.sku, sku),
        eq(coreProductIdentity.categoryId, input.categoryId),
        isNull(coreProductIdentity.subCategoryId),
      );
  const existingSku = await database.query.coreProductIdentity.findFirst({
    where: scopeCondition,
    columns: { id: true },
  });
  if (existingSku) {
    throw new ORPCError("CONFLICT", {
      message: `A core product with SKU "${sku}" already exists in this scope`,
    });
  }

  const [created] = await database
    .insert(coreProductIdentity)
    .values({
      sku,
      name: input.name,
      slug: input.slug,
      description: input.description || null,
      image: input.image,
      categoryId: input.categoryId,
      subCategoryId: input.subCategoryId || null,
    })
    .returning();

  return created!;
}

async function approveCatalogRequest(
  input: z.infer<typeof approveRequestInput>,
  reviewerId: string,
) {
  return db.transaction(async (tx) => {
    const database = tx as unknown as typeof db;
    const request = await database.query.catalogApprovalRequest.findFirst({
      where: eq(catalogApprovalRequest.id, input.id),
    });

    if (!request) {
      throw new ORPCError("NOT_FOUND", { message: "Request not found" });
    }
    if (request.requestType !== input.requestType) {
      throw new ORPCError("BAD_REQUEST", { message: "Request type mismatch" });
    }
    if (request.status !== "pending") {
      throw new ORPCError("BAD_REQUEST", {
        message: "Only pending requests can be approved",
      });
    }

    const created =
      input.requestType === "brand"
        ? await createBrandFromPayload(input.payload, database)
        : input.requestType === "variant_option"
          ? await createStructuredVariantOption(input.payload, database)
          : await createCoreProductFromPayload(input.payload, database);

    const [updated] = await database
      .update(catalogApprovalRequest)
      .set({
        status: "approved",
        payload: input.payload,
        adminNote: input.adminNote || null,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        createdEntityId: created.id,
        createdEntitySnapshot: created,
        updatedAt: new Date(),
      })
      .where(eq(catalogApprovalRequest.id, input.id))
      .returning();

    if (!updated) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to mark request as approved",
      });
    }

    return { request: updated, created };
  });
}

export const catalogRequestRouter = {
  getRequestOptions: catalogRequesterProcedure.handler(async () => {
    const [types, categories, subCategories] = await Promise.all([
      db.query.productType.findMany({
        where: eq(productType.isActive, true),
        orderBy: [asc(productType.displayOrder), asc(productType.name)],
        columns: {
          id: true,
          name: true,
          slug: true,
          family: true,
          inventoryBehaviour: true,
        },
      }),
      db.query.category.findMany({
        where: eq(category.isActive, true),
        orderBy: [asc(category.displayOrder), asc(category.name)],
        columns: { id: true, name: true, slug: true, typeId: true },
      }),
      db.query.subCategory.findMany({
        where: eq(subCategory.isActive, true),
        orderBy: [asc(subCategory.displayOrder), asc(subCategory.name)],
        columns: { id: true, name: true, slug: true, categoryId: true },
      }),
    ]);

    return { types, categories, subCategories };
  }),

  createRequest: catalogRequesterProcedure
    .input(createRequestInput)
    .handler(async ({ context, input }) => {
      const payload = parsePayload(input.requestType, input.payload);
      if (input.requestType === "variant_option") {
        await prepareStructuredVariantOption(
          payload as StructuredVariantOptionInput,
        );
      }
      if (input.requestType === "core_product") {
        await assertCoreProductScope(
          payload as z.infer<typeof coreProductPayloadSchema>,
        );
      }

      const [created] = await db
        .insert(catalogApprovalRequest)
        .values({
          requestType: input.requestType,
          requestedBy: context.session.user.id,
          payload,
          status: "pending",
        })
        .returning();

      return {
        request: created!,
        message: "Request submitted for admin review",
      };
    }),

  getMyRequests: catalogRequesterProcedure
    .input(requestListInput.optional())
    .handler(async ({ context, input }) => {
      const filters: z.infer<typeof requestListInput> = {
        limit: 50,
        ...(input ?? {}),
      };
      const conditions: SQL[] = [
        eq(catalogApprovalRequest.requestedBy, context.session.user.id),
      ];
      if (filters.requestType) {
        conditions.push(
          eq(catalogApprovalRequest.requestType, filters.requestType),
        );
      }
      if (filters.status && filters.status !== "all") {
        conditions.push(eq(catalogApprovalRequest.status, filters.status));
      }

      const requests = await db.query.catalogApprovalRequest.findMany({
        where: and(...conditions),
        orderBy: [desc(catalogApprovalRequest.createdAt)],
        limit: filters.limit ?? 50,
      });

      return { requests };
    }),
};

export const adminCatalogApprovalRouter = {
  getRequestOptions: adminProcedure.handler(async () => {
    const [
      types,
      categories,
      subCategories,
      brands,
      variantOptions,
      coreProducts,
    ] = await Promise.all([
      db.query.productType.findMany({
        where: eq(productType.isActive, true),
        orderBy: [asc(productType.displayOrder), asc(productType.name)],
        columns: {
          id: true,
          name: true,
          slug: true,
          family: true,
          inventoryBehaviour: true,
        },
      }),
      db.query.category.findMany({
        where: eq(category.isActive, true),
        orderBy: [asc(category.displayOrder), asc(category.name)],
        columns: { id: true, name: true, slug: true, typeId: true },
      }),
      db.query.subCategory.findMany({
        where: eq(subCategory.isActive, true),
        orderBy: [asc(subCategory.displayOrder), asc(subCategory.name)],
        columns: { id: true, name: true, slug: true, categoryId: true },
      }),
      db.query.brand.findMany({
        orderBy: [asc(brand.name)],
        columns: { id: true, name: true, slug: true },
      }),
      db.query.variantOption.findMany({
        orderBy: [asc(variantOption.sortOrder), asc(variantOption.name)],
        columns: {
          id: true,
          name: true,
          unit: true,
          size: true,
          variantType: true,
          typeId: true,
          categoryId: true,
          definitionKind: true,
          definition: true,
          needsReview: true,
          isActive: true,
        },
      }),
      db.query.coreProductIdentity.findMany({
        orderBy: [asc(coreProductIdentity.name)],
        columns: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          categoryId: true,
          subCategoryId: true,
        },
      }),
    ]);

    return {
      types,
      categories,
      subCategories,
      brands,
      variantOptions,
      coreProducts,
    };
  }),

  getStats: adminProcedure.handler(async () => {
    const rows = await db
      .select({
        status: catalogApprovalRequest.status,
        count: count(),
      })
      .from(catalogApprovalRequest)
      .groupBy(catalogApprovalRequest.status);

    const stats = { total: 0, pending: 0, approved: 0, rejected: 0 };
    for (const row of rows) {
      stats[row.status] = row.count;
      stats.total += row.count;
    }
    return stats;
  }),

  listRequests: adminProcedure
    .input(requestListInput.optional())
    .handler(async ({ input }) => {
      const filters: z.infer<typeof requestListInput> = {
        limit: 50,
        ...(input ?? {}),
      };
      const conditions: SQL[] = [];

      if (filters.requestType) {
        conditions.push(
          eq(catalogApprovalRequest.requestType, filters.requestType),
        );
      }
      if (filters.status && filters.status !== "all") {
        conditions.push(eq(catalogApprovalRequest.status, filters.status));
      }
      const dateStart = getDateRangeStart(filters.dateRange);
      if (dateStart) {
        conditions.push(gte(catalogApprovalRequest.createdAt, dateStart));
      }
      if (filters.search?.trim()) {
        const term = `%${filters.search.trim()}%`;
        const searchCondition = or(
          sql`${catalogApprovalRequest.payload}::text ILIKE ${term}`,
          sql`EXISTS (
            SELECT 1
            FROM ${user}
            WHERE ${user.id} = ${catalogApprovalRequest.requestedBy}
              AND (
                ${user.name} ILIKE ${term}
                OR ${user.email} ILIKE ${term}
                OR ${user.shopName} ILIKE ${term}
                OR ${user.warehouseName} ILIKE ${term}
                OR ${user.phoneNumber} ILIKE ${term}
              )
          )`,
        );
        if (searchCondition) conditions.push(searchCondition);
      }

      const requests = await db.query.catalogApprovalRequest.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          requester: {
            columns: {
              id: true,
              name: true,
              email: true,
              role: true,
              shopName: true,
              warehouseName: true,
              phoneNumber: true,
            },
          },
          reviewer: {
            columns: { id: true, name: true, email: true },
          },
        },
        orderBy: [desc(catalogApprovalRequest.createdAt)],
        limit: filters.limit ?? 50,
      });

      return { requests };
    }),

  approveRequest: adminProcedure
    .input(approveRequestInput)
    .handler(async ({ context, input }) => {
      return approveCatalogRequest(input, context.session.user.id);
    }),

  rejectRequest: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        adminNote: z.string().min(1).max(1000),
      }),
    )
    .handler(async ({ context, input }) => {
      const existing = await db.query.catalogApprovalRequest.findFirst({
        where: eq(catalogApprovalRequest.id, input.id),
        columns: { id: true, status: true },
      });
      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Request not found" });
      }
      if (existing.status !== "pending") {
        throw new ORPCError("BAD_REQUEST", {
          message: "Only pending requests can be rejected",
        });
      }

      const [updated] = await db
        .update(catalogApprovalRequest)
        .set({
          status: "rejected",
          adminNote: input.adminNote,
          reviewedBy: context.session.user.id,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(catalogApprovalRequest.id, input.id))
        .returning();

      return { request: updated!, message: "Request rejected" };
    }),
};
