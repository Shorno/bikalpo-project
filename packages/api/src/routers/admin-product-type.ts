import {
  buildProductTypeFulfillmentProfile,
  db,
  FULFILLMENT_UNIT_CODES,
  INVENTORY_BEHAVIOURS,
  PRODUCT_TYPE_FAMILIES,
} from "@bikalpo-project/db";
import {
  category,
  order,
  orderItem,
  product,
  productReview,
  productType,
  productTypeRuleSetting,
  sellerApplication,
  shopCategoryAssignment,
  user,
  variantOption,
  warehouseApplication,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import {
  and,
  asc,
  avg,
  count,
  countDistinct,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  ne,
  type SQL,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, publicProcedure } from "../index";
import { nextSkuCode } from "./helpers/generate-sku";
import {
  classifyProductTypeSellerRole,
  compareProductTypeSellers,
  PRODUCT_TYPE_SELLER_ROLES,
  type ProductTypeSellerRankingRow,
  type ProductTypeSellerRole,
  resolveProductTypePagination,
} from "./helpers/product-type-sellers";

const TRACKING_TYPES = ["none", "batch", "serial"] as const;
const ALL_UNIT_CODES = [...FULFILLMENT_UNIT_CODES];

type RuleSettingsInput = typeof productTypeRuleSetting.$inferInsert;

const productTypeRuleSettingsSchema = z.object({
  productTypeId: z.number().int().positive(),
  trackingTypes: z.array(z.enum(TRACKING_TYPES)).min(1),
  trackingAvailable: z.boolean(),
  defaultTrackingType: z.enum(TRACKING_TYPES),
  returnPolicyAvailable: z.boolean(),
  returnPolicyDefault: z.boolean(),
  expiryAvailable: z.boolean(),
  expiryDefault: z.boolean(),
  damageAvailable: z.boolean(),
  damageDefault: z.boolean(),
  stockTrackingAvailable: z.boolean(),
  stockTrackingDefault: z.boolean(),
  minimumOrderAvailable: z.boolean(),
  minimumOrderDefault: z.boolean(),
  minimumOrderQtyDefault: z
    .string()
    .min(1)
    .regex(/^\d+(\.\d{1,2})?$/),
  conversionAvailable: z.boolean(),
  conversionDefault: z.boolean(),
  inventoryLooseUnitAvailable: z.boolean(),
  inventoryLooseUnitDefault: z.boolean(),
  inventoryLooseUnitOptions: z.array(z.enum(FULFILLMENT_UNIT_CODES)).min(1),
  defaultInventoryLooseUnit: z.enum(FULFILLMENT_UNIT_CODES),
  returnablePackAvailable: z.boolean(),
  returnablePackDefault: z.boolean(),
  defaultPackDepositAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .default("0"),
});

function buildDefaultRuleSettings<
  T extends {
    id: number;
    name: string;
    slug: string;
    inventoryBehaviour: (typeof INVENTORY_BEHAVIOURS)[number];
  },
>(type: T): RuleSettingsInput {
  const profile = buildProductTypeFulfillmentProfile(type);
  const isFoodLike =
    profile.family === "grocery" || profile.family === "bulk_liquid";
  const hasConversion =
    profile.inventoryBehaviour === "auto_break" ||
    profile.inventoryBehaviour === "loose_convert";
  const hasLoose =
    profile.inventoryBehaviour === "loose_convert" ||
    profile.supportedModes.includes("loose");
  const trackingTypes = profile.supportsTrackedAssets
    ? [...TRACKING_TYPES]
    : (["none", "batch"] as const);

  return {
    productTypeId: type.id,
    trackingTypes: [...trackingTypes],
    trackingAvailable: true,
    defaultTrackingType:
      profile.supportsTrackedAssets || isFoodLike ? "batch" : "none",
    returnPolicyAvailable: true,
    returnPolicyDefault: true,
    expiryAvailable: true,
    expiryDefault: isFoodLike,
    damageAvailable: true,
    damageDefault: true,
    stockTrackingAvailable: true,
    stockTrackingDefault: true,
    minimumOrderAvailable: true,
    minimumOrderDefault: true,
    minimumOrderQtyDefault: "1",
    conversionAvailable: true,
    conversionDefault: hasConversion,
    inventoryLooseUnitAvailable: hasLoose,
    inventoryLooseUnitDefault: hasLoose,
    inventoryLooseUnitOptions: ALL_UNIT_CODES,
    defaultInventoryLooseUnit:
      hasLoose && profile.conversionUnit ? profile.conversionUnit : "kg",
    returnablePackAvailable: true,
    returnablePackDefault: profile.supportsEmptyReturn,
    defaultPackDepositAmount: "0",
  };
}

function normalizeRuleSettings(
  settings: typeof productTypeRuleSetting.$inferSelect | RuleSettingsInput,
) {
  return {
    ...settings,
    minimumOrderQtyDefault: String(settings.minimumOrderQtyDefault ?? "1"),
    defaultPackDepositAmount: String(settings.defaultPackDepositAmount ?? "0"),
    trackingAvailable: settings.trackingAvailable ?? true,
    trackingTypes: settings.trackingTypes?.length
      ? settings.trackingTypes
      : ["none"],
    inventoryLooseUnitOptions: settings.inventoryLooseUnitOptions?.length
      ? settings.inventoryLooseUnitOptions
      : ["kg"],
  };
}

function decorateProductType<
  T extends {
    id: number;
    name: string;
    slug: string;
    inventoryBehaviour: (typeof INVENTORY_BEHAVIOURS)[number];
    ruleSettings?: typeof productTypeRuleSetting.$inferSelect | null;
  },
>(type: T) {
  const { ruleSettings, ...rest } = type;

  return {
    ...rest,
    fulfillmentProfile: buildProductTypeFulfillmentProfile(rest),
    ruleSettings: normalizeRuleSettings(
      ruleSettings ?? buildDefaultRuleSettings(rest),
    ),
  };
}

function validateRuleSettingsInput(
  input: z.infer<typeof productTypeRuleSettingsSchema>,
) {
  if (!input.trackingTypes.includes(input.defaultTrackingType)) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Default tracking type must be in the allowed tracking list.",
    });
  }

  if (
    !input.inventoryLooseUnitOptions.includes(input.defaultInventoryLooseUnit)
  ) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Default loose unit must be in the allowed loose unit list.",
    });
  }
}

const productTypePageSizeSchema = z.union([
  z.literal(10),
  z.literal(20),
  z.literal(50),
]);

async function getProductTypeSellerRankings(categoryIds: number[]) {
  let assignedSellerIds: string[] = [];
  if (categoryIds.length > 0) {
    const result = await db
      .selectDistinct({ id: shopCategoryAssignment.shopId })
      .from(shopCategoryAssignment)
      .where(inArray(shopCategoryAssignment.categoryId, categoryIds));
    assignedSellerIds = result.map((row) => row.id);
  }

  const productOwners =
    categoryIds.length > 0
      ? await db
          .selectDistinct({ id: product.createdById })
          .from(product)
          .where(
            and(
              inArray(product.categoryId, categoryIds),
              ne(product.creatorSource, "admin"),
              isNotNull(product.createdById),
            ),
          )
      : [];
  const sellerIds = [
    ...new Set([
      ...assignedSellerIds,
      ...productOwners.flatMap((row) => (row.id ? [row.id] : [])),
    ]),
  ];

  const users =
    sellerIds.length > 0
      ? await db
          .select({ id: user.id, name: user.name, role: user.role })
          .from(user)
          .where(inArray(user.id, sellerIds))
      : [];
  const [sellerApplications, warehouseApplications] =
    sellerIds.length > 0
      ? await Promise.all([
          db
            .select({
              userId: sellerApplication.userId,
              businessNature: sellerApplication.businessNature,
              createdAt: sellerApplication.createdAt,
            })
            .from(sellerApplication)
            .where(
              and(
                inArray(sellerApplication.userId, sellerIds),
                eq(sellerApplication.status, "approved"),
              ),
            )
            .orderBy(desc(sellerApplication.createdAt)),
          db
            .select({
              userId: warehouseApplication.userId,
              businessNature: warehouseApplication.businessNature,
              createdAt: warehouseApplication.createdAt,
            })
            .from(warehouseApplication)
            .where(
              and(
                inArray(warehouseApplication.userId, sellerIds),
                eq(warehouseApplication.status, "approved"),
              ),
            )
            .orderBy(desc(warehouseApplication.createdAt)),
        ])
      : [[], []];

  const sellerExpression = sql<string>`coalesce(${order.shopId}, ${order.warehouseId})`;
  const orderStats =
    categoryIds.length > 0
      ? await db
          .select({
            userId: sellerExpression,
            deliveredOrderCount: countDistinct(order.id),
          })
          .from(order)
          .innerJoin(orderItem, eq(orderItem.orderId, order.id))
          .innerJoin(product, eq(product.id, orderItem.productId))
          .where(
            and(
              eq(order.status, "delivered"),
              inArray(product.categoryId, categoryIds),
              isNotNull(sellerExpression),
            ),
          )
          .groupBy(sellerExpression)
      : [];
  const ratingStats =
    categoryIds.length > 0
      ? await db
          .select({
            userId: product.createdById,
            averageRating: avg(productReview.rating),
          })
          .from(product)
          .leftJoin(productReview, eq(productReview.productId, product.id))
          .where(
            and(
              inArray(product.categoryId, categoryIds),
              ne(product.creatorSource, "admin"),
              isNotNull(product.createdById),
            ),
          )
          .groupBy(product.createdById)
      : [];

  const latestApplication = new Map<
    string,
    { businessNature: string | null; warehouse: boolean; createdAt: Date }
  >();
  for (const application of [
    ...sellerApplications.map((item) => ({ ...item, warehouse: false })),
    ...warehouseApplications.map((item) => ({ ...item, warehouse: true })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
    if (!latestApplication.has(application.userId)) {
      latestApplication.set(application.userId, application);
    }
  }

  const ordersByUser = new Map(
    orderStats.map((row) => [row.userId, row.deliveredOrderCount]),
  );
  const ratingsByUser = new Map(
    ratingStats.flatMap((row) =>
      row.userId ? [[row.userId, Number(row.averageRating ?? 0)] as const] : [],
    ),
  );
  const rankings = Object.fromEntries(
    PRODUCT_TYPE_SELLER_ROLES.map((role) => [
      role,
      [] as ProductTypeSellerRankingRow[],
    ]),
  ) as Record<ProductTypeSellerRole, ProductTypeSellerRankingRow[]>;

  for (const seller of users) {
    const application = latestApplication.get(seller.id);
    const role = classifyProductTypeSellerRole(
      application?.businessNature,
      application?.warehouse || seller.role === "warehouse_owner",
    );
    rankings[role].push({
      userId: seller.id,
      displayName: seller.name,
      deliveredOrderCount: ordersByUser.get(seller.id) ?? 0,
      averageRating: ratingsByUser.get(seller.id) ?? 0,
    });
  }

  for (const role of PRODUCT_TYPE_SELLER_ROLES) {
    rankings[role].sort(compareProductTypeSellers);
  }

  return { sellerIds, rankings };
}

export const adminProductTypeRouter = {
  // List all product types with optional status filter
  getAll: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.enum(["all", "active", "inactive"]).optional().default("all"),
        inventoryBehaviour: z
          .enum(["all", ...INVENTORY_BEHAVIOURS])
          .optional()
          .default("all"),
      }),
    )
    .handler(async ({ input }) => {
      const conditions: SQL[] = [];
      if (input.search) {
        conditions.push(ilike(productType.name, `%${input.search}%`));
      }
      if (input.status === "active") {
        conditions.push(eq(productType.isActive, true));
      } else if (input.status === "inactive") {
        conditions.push(eq(productType.isActive, false));
      }
      if (input.inventoryBehaviour !== "all") {
        conditions.push(
          eq(productType.inventoryBehaviour, input.inventoryBehaviour),
        );
      }

      const types = await db.query.productType.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [asc(productType.displayOrder), asc(productType.name)],
        with: {
          categories: { columns: { id: true } },
          ruleSettings: true,
        },
      });

      return {
        types: types.map(({ categories: cats, ...rest }) => ({
          ...decorateProductType(rest),
          categoryCount: cats.length,
        })),
      };
    }),

  // Paginated admin list. getAll remains unpaginated for setup pickers.
  listPage: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.enum(["all", "active", "inactive"]).default("all"),
        page: z.number().int().positive().default(1),
        pageSize: productTypePageSizeSchema.default(10),
      }),
    )
    .handler(async ({ input }) => {
      const conditions: SQL[] = [];
      const search = input.search?.trim();
      if (search) conditions.push(ilike(productType.name, `%${search}%`));
      if (input.status === "active") {
        conditions.push(eq(productType.isActive, true));
      } else if (input.status === "inactive") {
        conditions.push(eq(productType.isActive, false));
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const [totalResult] = await db
        .select({ value: count() })
        .from(productType)
        .where(where);
      const pagination = resolveProductTypePagination(
        totalResult?.value ?? 0,
        input.page,
        input.pageSize,
      );

      const types = await db.query.productType.findMany({
        where,
        orderBy: [
          asc(productType.displayOrder),
          asc(productType.name),
          asc(productType.id),
        ],
        limit: pagination.pageSize,
        offset: pagination.offset,
        with: {
          categories: { columns: { id: true } },
          ruleSettings: true,
        },
      });

      return {
        types: types.map(({ categories: cats, ...rest }) => ({
          ...decorateProductType(rest),
          categoryCount: cats.length,
        })),
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          totalPages: pagination.totalPages,
        },
      };
    }),

  // Get single product type by ID with related data
  getById: adminProcedure
    .input(z.object({ id: z.number() }))
    .handler(async ({ input }) => {
      const type = await db.query.productType.findFirst({
        where: eq(productType.id, input.id),
        with: {
          ruleSettings: true,
          categories: {
            columns: {
              id: true,
              name: true,
              slug: true,
              isActive: true,
              image: true,
            },
            orderBy: [asc(category.displayOrder), asc(category.name)],
          },
        },
      });

      if (!type) {
        throw new ORPCError("NOT_FOUND", { message: "Product type not found" });
      }

      // Get products under this type via categories
      const categoryIds = type.categories.map((c) => c.id);
      let products: {
        id: number;
        name: string;
        slug: string;
        image: string;
        size: string;
        price: string;
        status: string;
        categoryId: number;
      }[] = [];
      if (categoryIds.length > 0) {
        products = await db
          .select({
            id: product.id,
            name: product.name,
            slug: product.slug,
            image: product.image,
            size: product.size,
            price: product.price,
            status: product.status,
            categoryId: product.categoryId,
          })
          .from(product)
          .where(inArray(product.categoryId, categoryIds))
          .orderBy(asc(product.name));
      }

      const { sellerIds, rankings: allRankings } =
        await getProductTypeSellerRankings(categoryIds);
      const rankings = Object.fromEntries(
        PRODUCT_TYPE_SELLER_ROLES.map((role) => [
          role,
          allRankings[role].slice(0, 10),
        ]),
      ) as Record<ProductTypeSellerRole, ProductTypeSellerRankingRow[]>;

      return {
        type: decorateProductType(type),
        products,
        sellerCount: sellerIds.length,
        totalUsers: sellerIds.length,
        activeSellers: sellerIds.length,
        rankings,
      };
    }),

  listSellers: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        role: z.enum(PRODUCT_TYPE_SELLER_ROLES).default("retailer"),
        page: z.number().int().positive().default(1),
        pageSize: productTypePageSizeSchema.default(20),
      }),
    )
    .handler(async ({ input }) => {
      const type = await db.query.productType.findFirst({
        where: eq(productType.id, input.id),
        columns: { id: true, name: true, isActive: true },
        with: { categories: { columns: { id: true } } },
      });
      if (!type) {
        throw new ORPCError("NOT_FOUND", { message: "Product type not found" });
      }

      const { rankings } = await getProductTypeSellerRankings(
        type.categories.map((item) => item.id),
      );
      const roleRows = rankings[input.role];
      const pagination = resolveProductTypePagination(
        roleRows.length,
        input.page,
        input.pageSize,
      );

      return {
        type: {
          id: type.id,
          name: type.name,
          isActive: type.isActive,
        },
        role: input.role,
        sellers: roleRows.slice(
          pagination.offset,
          pagination.offset + pagination.pageSize,
        ),
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          totalPages: pagination.totalPages,
        },
      };
    }),

  // Create a new product type
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        slug: z.string().min(1),
        description: z.string().optional(),
        image: z.string().optional(),
        inventoryBehaviour: z.enum(INVENTORY_BEHAVIOURS).default("fixed_pack"),
        family: z.enum(PRODUCT_TYPE_FAMILIES).optional(),
        isActive: z.boolean().default(true),
        displayOrder: z.number().default(0),
      }),
    )
    .handler(async ({ input }) => {
      // Check for unique slug
      const existing = await db.query.productType.findFirst({
        where: eq(productType.slug, input.slug),
      });
      if (existing) {
        throw new ORPCError("CONFLICT", {
          message: "A type with this slug already exists",
        });
      }

      // Auto-generate next available 2-digit skuCode
      const skuCode = await nextSkuCode(productType, productType.skuCode, 2);

      const [created] = await db
        .insert(productType)
        .values({
          name: input.name,
          slug: input.slug,
          description: input.description || null,
          image: input.image || null,
          inventoryBehaviour: input.inventoryBehaviour,
          family:
            input.family ?? buildProductTypeFulfillmentProfile(input).family,
          displayOrder: input.displayOrder,
          isActive: input.isActive,
          skuCode,
        })
        .returning();

      const [createdRuleSettings] = await db
        .insert(productTypeRuleSetting)
        .values(buildDefaultRuleSettings(created!))
        .returning();

      return {
        type: decorateProductType({
          ...created!,
          ruleSettings: createdRuleSettings ?? null,
        }),
        message: `Product type "${created!.name}" created successfully`,
      };
    }),

  // Update a product type
  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1),
        slug: z.string().min(1),
        description: z.string().optional(),
        image: z.string().optional(),
        inventoryBehaviour: z.enum(INVENTORY_BEHAVIOURS).default("fixed_pack"),
        family: z.enum(PRODUCT_TYPE_FAMILIES),
        isActive: z.boolean(),
        displayOrder: z.number().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const { id, ...data } = input;

      const [updated] = await db
        .update(productType)
        .set({
          name: data.name,
          slug: data.slug,
          description: data.description || null,
          image: data.image || null,
          inventoryBehaviour: data.inventoryBehaviour,
          family: data.family,
          displayOrder: data.displayOrder,
          isActive: data.isActive,
        })
        .where(eq(productType.id, id))
        .returning();

      if (!updated) {
        throw new ORPCError("NOT_FOUND", { message: "Product type not found" });
      }

      const settings = await db.query.productTypeRuleSetting.findFirst({
        where: eq(productTypeRuleSetting.productTypeId, updated.id),
      });

      return {
        type: decorateProductType({
          ...updated,
          ruleSettings: settings ?? null,
        }),
        message: `Product type "${updated.name}" updated successfully`,
      };
    }),

  updateRuleSettings: adminProcedure
    .input(productTypeRuleSettingsSchema)
    .handler(async ({ input }) => {
      validateRuleSettingsInput(input);

      const existingType = await db.query.productType.findFirst({
        where: eq(productType.id, input.productTypeId),
        columns: { id: true },
      });

      if (!existingType) {
        throw new ORPCError("NOT_FOUND", { message: "Product type not found" });
      }

      const [settings] = await db
        .insert(productTypeRuleSetting)
        .values(input)
        .onConflictDoUpdate({
          target: productTypeRuleSetting.productTypeId,
          set: {
            trackingTypes: input.trackingTypes,
            trackingAvailable: input.trackingAvailable,
            defaultTrackingType: input.defaultTrackingType,
            returnPolicyAvailable: input.returnPolicyAvailable,
            returnPolicyDefault: input.returnPolicyDefault,
            expiryAvailable: input.expiryAvailable,
            expiryDefault: input.expiryDefault,
            damageAvailable: input.damageAvailable,
            damageDefault: input.damageDefault,
            stockTrackingAvailable: input.stockTrackingAvailable,
            stockTrackingDefault: input.stockTrackingDefault,
            minimumOrderAvailable: input.minimumOrderAvailable,
            minimumOrderDefault: input.minimumOrderDefault,
            minimumOrderQtyDefault: input.minimumOrderQtyDefault,
            conversionAvailable: input.conversionAvailable,
            conversionDefault: input.conversionDefault,
            inventoryLooseUnitAvailable: input.inventoryLooseUnitAvailable,
            inventoryLooseUnitDefault: input.inventoryLooseUnitDefault,
            inventoryLooseUnitOptions: input.inventoryLooseUnitOptions,
            defaultInventoryLooseUnit: input.defaultInventoryLooseUnit,
            returnablePackAvailable: input.returnablePackAvailable,
            returnablePackDefault: input.returnablePackDefault,
            defaultPackDepositAmount: input.defaultPackDepositAmount,
            updatedAt: new Date(),
          },
        })
        .returning();

      return {
        ruleSettings: normalizeRuleSettings(settings!),
        message: "Rule settings saved successfully",
      };
    }),

  // Toggle active status
  toggleActive: adminProcedure
    .input(z.object({ id: z.number() }))
    .handler(async ({ input }) => {
      const existing = await db.query.productType.findFirst({
        where: eq(productType.id, input.id),
      });
      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Product type not found" });
      }

      const [updated] = await db
        .update(productType)
        .set({ isActive: !existing.isActive })
        .where(eq(productType.id, input.id))
        .returning();

      return {
        type: decorateProductType(updated!),
        message: `Product type "${updated!.name}" ${updated!.isActive ? "activated" : "deactivated"} successfully`,
      };
    }),

  // Delete a product type (with protection)
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .handler(async ({ input }) => {
      // Check if categories exist under this type
      const categoryCount = await db
        .select({ count: count() })
        .from(category)
        .where(eq(category.typeId, input.id));

      if ((categoryCount[0]?.count ?? 0) > 0) {
        throw new ORPCError("CONFLICT", {
          message: `Cannot delete this type — it has ${categoryCount[0]!.count} categories. Remove or reassign them first.`,
        });
      }

      const scopedVariant = await db.query.variantOption.findFirst({
        where: eq(variantOption.typeId, input.id),
        columns: { id: true },
      });
      if (scopedVariant) {
        throw new ORPCError("CONFLICT", {
          message:
            "Cannot delete this type because Variant definitions still reference it. Disable the type instead.",
        });
      }

      const [deleted] = await db
        .delete(productType)
        .where(eq(productType.id, input.id))
        .returning();

      if (!deleted) {
        throw new ORPCError("NOT_FOUND", { message: "Product type not found" });
      }

      return {
        success: true,
        message: `Product type "${deleted.name}" deleted successfully`,
      };
    }),

  // Public: get active types (for dropdowns)
  getActiveTypes: publicProcedure.handler(async () => {
    const types = await db.query.productType.findMany({
      where: eq(productType.isActive, true),
      orderBy: [asc(productType.displayOrder), asc(productType.name)],
      columns: {
        id: true,
        name: true,
        slug: true,
        inventoryBehaviour: true,
      },
      with: { ruleSettings: true },
    });

    return { types: types.map((type) => decorateProductType(type)) };
  }),
};
