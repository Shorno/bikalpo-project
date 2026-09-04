import { db } from "@bikalpo-project/db";
import {
  area,
  type OfferTemplateProduct,
  offerTemplate,
  productVariant,
  retailerOffer,
  retailerOfferApplication,
  sellerAreaMapping,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { shopPermissionProcedure } from "../index";
import { getOwnerPosCatalog } from "../services/owner-pos-store";
import { resolveTemplateProductIdentities } from "../services/retailer-offer-variant-identity";
import { shopTenantId } from "../shop-portal-scope";

const statusSchema = z.enum(["active", "scheduled", "expired", "draft"]);
const typeSchema = z.enum(["percentage", "flat", "buy_x_get_y"]);
const applyToSchema = z.enum(["product", "category", "all_products"]);
const targetTypeSchema = z.enum([
  "all_customers",
  "specific_customers",
  "area",
]);

const editableOfferSchema = z
  .object({
    name: z.string().trim().min(3).max(255),
    applyTo: applyToSchema,
    variantId: z.number().int().positive().nullable().optional(),
    categoryId: z.number().int().positive().nullable().optional(),
    discountValue: z.coerce.number().positive().nullable().optional(),
    minimumQuantity: z.coerce.number().positive(),
    maximumLimit: z.coerce.number().int().positive().nullable().optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    allDay: z.boolean(),
    startTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable()
      .optional(),
    endTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable()
      .optional(),
    targetType: targetTypeSchema,
    targetCustomerKeys: z.array(z.string().min(1)).default([]),
    targetAreaIds: z.array(z.number().int().positive()).default([]),
  })
  .superRefine((value, context) => {
    if (new Date(value.endDate) <= new Date(value.startDate)) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be after the start date",
      });
    }
    if (value.applyTo === "product" && !value.variantId) {
      context.addIssue({
        code: "custom",
        path: ["variantId"],
        message: "Select a sellable product variant",
      });
    }
    if (value.applyTo === "category" && !value.categoryId) {
      context.addIssue({
        code: "custom",
        path: ["categoryId"],
        message: "Select a category",
      });
    }
    if (
      value.targetType === "specific_customers" &&
      value.targetCustomerKeys.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["targetCustomerKeys"],
        message: "Select at least one customer",
      });
    }
    if (value.targetType === "area" && value.targetAreaIds.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["targetAreaIds"],
        message: "Select at least one area",
      });
    }
    if (!value.allDay && (!value.startTime || !value.endTime)) {
      context.addIssue({
        code: "custom",
        path: ["startTime"],
        message: "Enter the custom start and end time",
      });
    }
  });

type SupportedType = z.infer<typeof typeSchema>;

function supportedType(
  template: typeof offerTemplate.$inferSelect,
): SupportedType | null {
  if (template.type === "combo" && template.comboRule === "buy_x_get_y") {
    return "buy_x_get_y";
  }
  if (template.type !== "discount") return null;
  if (template.benefitType === "percentage_discount") return "percentage";
  if (template.benefitType === "fixed_discount") return "flat";
  return null;
}

function typeLabel(type: SupportedType) {
  if (type === "percentage") return "% Discount";
  if (type === "flat") return "Flat Discount";
  return "Buy X Get Y";
}

function availableInRetailStore(template: typeof offerTemplate.$inferSelect) {
  return template.applyLocations.some((location) =>
    ["all_stores", "selected_stores", "online_store"].includes(location),
  );
}

function assertDiscountValue(
  offerType: SupportedType,
  discountValue: number | null | undefined,
) {
  if (offerType !== "buy_x_get_y" && discountValue == null) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Enter a discount value",
    });
  }
  if (offerType === "percentage" && Number(discountValue) > 100) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Percentage discount cannot exceed 100%",
    });
  }
}

function currentStatus(offer: typeof retailerOffer.$inferSelect) {
  const now = Date.now();
  if (offer.status === "draft") return "draft" as const;
  if (offer.endDate.getTime() <= now) return "expired" as const;
  if (offer.startDate.getTime() > now) return "scheduled" as const;
  return "active" as const;
}

async function syncLifecycle(shopId: string) {
  const now = new Date();
  await db
    .update(retailerOffer)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(retailerOffer.shopId, shopId),
        inArray(retailerOffer.status, ["active", "scheduled"]),
        lte(retailerOffer.endDate, now),
      ),
    );
  await db
    .update(retailerOffer)
    .set({ status: "active", updatedAt: now })
    .where(
      and(
        eq(retailerOffer.shopId, shopId),
        eq(retailerOffer.status, "scheduled"),
        lte(retailerOffer.startDate, now),
      ),
    );
}

function offerCode() {
  return `OFF-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function applicationMap(
  rows: Array<typeof retailerOfferApplication.$inferSelect>,
) {
  const map = new Map<
    number,
    { ordersApplied: number; totalDiscount: number; salesGenerated: number }
  >();
  for (const row of rows) {
    const current = map.get(row.retailerOfferId) ?? {
      ordersApplied: 0,
      totalDiscount: 0,
      salesGenerated: 0,
    };
    current.ordersApplied += 1;
    current.totalDiscount += Number(row.discountAmount);
    current.salesGenerated += Number(row.salesAmount);
    map.set(row.retailerOfferId, current);
  }
  return map;
}

function discountSummary(offer: typeof retailerOffer.$inferSelect) {
  if (offer.offerType === "percentage") {
    return `${Number(offer.discountValue ?? 0)}% OFF`;
  }
  if (offer.offerType === "flat") {
    return `৳ ${Number(offer.discountValue ?? 0)} OFF`;
  }
  const buy = offer.templateSnapshot.buyProducts.reduce(
    (sum, product) => sum + product.quantity,
    0,
  );
  const get = offer.templateSnapshot.getProducts.reduce(
    (sum, product) => sum + product.quantity,
    0,
  );
  return `Buy ${buy || Number(offer.minimumQuantity)} Get ${get || 1}`;
}

function productSummary(offer: typeof retailerOffer.$inferSelect) {
  if (offer.offerType === "buy_x_get_y") {
    const buy = offer.templateSnapshot.buyProducts
      .map(
        (product) =>
          `${product.brandName ? `${product.brandName} ` : ""}${product.variantName || product.name} ×${product.quantity}`,
      )
      .join(" + ");
    const get = offer.templateSnapshot.getProducts
      .map(
        (product) =>
          `${product.brandName ? `${product.brandName} ` : ""}${product.variantName || product.name} ×${product.quantity}`,
      )
      .join(" + ");
    return `${buy} → ${get}`;
  }
  if (offer.applyTo === "all_products") return "All Products";
  if (offer.applyTo === "category") return offer.categoryName ?? "Category";
  return [offer.productName, offer.variantName].filter(Boolean).join(" · ");
}

function dateWindow(value: "today" | "week" | "month" | undefined) {
  if (!value) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  if (value === "today") end.setHours(23, 59, 59, 999);
  if (value === "week") end.setDate(end.getDate() + 7);
  if (value === "month") end.setMonth(end.getMonth() + 1);
  return { start, end };
}

async function refreshTemplateUsage(templateId: number) {
  const [summary] = await db
    .select({
      usedByCount: sql<number>`count(distinct ${retailerOffer.shopId})::int`,
      activeOffersCreated: sql<number>`count(*) filter (where ${retailerOffer.status} in ('active', 'scheduled'))::int`,
    })
    .from(retailerOffer)
    .where(eq(retailerOffer.templateId, templateId));
  await db
    .update(offerTemplate)
    .set({
      usedByCount: summary?.usedByCount ?? 0,
      activeOffersCreated: summary?.activeOffersCreated ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(offerTemplate.id, templateId));
}

type ComboProduct = OfferTemplateProduct;

type ResolvedComboProduct = ComboProduct & {
  catalogVariantId: number | null;
  ownerVariantId: number | null;
  available: boolean;
};

async function resolveComboProductsForOwner(
  shopId: string,
  comboProducts: ComboProduct[],
) {
  const sourceVariantIds = [
    ...new Set(
      comboProducts
        .map((product) => product.variantId)
        .filter((id): id is number => id != null),
    ),
  ];
  const [catalog, sourceVariants] = await Promise.all([
    getOwnerPosCatalog({ kind: "shop", id: shopId }),
    sourceVariantIds.length > 0
      ? db
          .select({
            variantId: productVariant.id,
            catalogVariantId: productVariant.catalogVariantId,
          })
          .from(productVariant)
          .where(inArray(productVariant.id, sourceVariantIds))
      : [],
  ]);
  return resolveTemplateProductIdentities(
    comboProducts,
    sourceVariants,
    catalog,
  );
}

function assertComboProductsAvailable(comboProducts: ResolvedComboProduct[]) {
  const unavailable = comboProducts.filter((product) => !product.available);
  if (unavailable.length > 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: `This store does not carry the required variant${unavailable.length === 1 ? "" : "s"}: ${unavailable
        .map((product) => product.variantName || product.name)
        .join(", ")}`,
    });
  }
}

function snapshotComboProducts(comboProducts: ResolvedComboProduct[]) {
  return comboProducts.map(
    ({
      ownerVariantId: _ownerVariantId,
      available: _available,
      ...product
    }) => ({
      ...product,
      catalogVariantId: product.catalogVariantId ?? undefined,
    }),
  );
}

async function resolveSelection(
  shopId: string,
  input: z.infer<typeof editableOfferSchema>,
  offerType?: SupportedType,
  comboProducts: ResolvedComboProduct[] = [],
  validateComboAvailability = true,
) {
  if (offerType === "buy_x_get_y") {
    if (validateComboAvailability) {
      assertComboProductsAvailable(comboProducts);
    }
    return {
      applyTo: "all_products" as const,
      productId: null,
      variantId: null,
      productName: null,
      variantName: null,
      categoryId: null,
      categoryName: null,
    };
  }
  const catalog = await getOwnerPosCatalog({ kind: "shop", id: shopId });
  if (input.applyTo === "product") {
    const variant = catalog.find((row) => row.variantId === input.variantId);
    if (!variant) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Select a sellable variant from this store",
      });
    }
    return {
      productId: variant.productId,
      variantId: variant.variantId,
      productName:
        `${variant.brandName ? `${variant.brandName} ` : ""}${variant.productName}`.trim(),
      variantName: variant.variantLabel,
      categoryId: variant.categoryId,
      categoryName: variant.categoryName,
    };
  }
  if (input.applyTo === "category") {
    const row = catalog.find((item) => item.categoryId === input.categoryId);
    if (!row) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Select a category available in this store",
      });
    }
    return {
      productId: null,
      variantId: null,
      productName: null,
      variantName: null,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
    };
  }
  return {
    productId: null,
    variantId: null,
    productName: "All Products",
    variantName: null,
    categoryId: null,
    categoryName: null,
  };
}

function toEditableValues(input: z.infer<typeof editableOfferSchema>) {
  return {
    name: input.name,
    applyTo: input.applyTo,
    discountValue:
      input.discountValue == null ? null : input.discountValue.toFixed(2),
    minimumQuantity: input.minimumQuantity.toFixed(2),
    maximumLimit: input.maximumLimit ?? null,
    startDate: new Date(input.startDate),
    endDate: new Date(input.endDate),
    allDay: input.allDay,
    startTime: input.allDay ? null : input.startTime,
    endTime: input.allDay ? null : input.endTime,
    targetType: input.targetType,
    targetCustomerKeys:
      input.targetType === "specific_customers" ? input.targetCustomerKeys : [],
    targetAreaIds: input.targetType === "area" ? input.targetAreaIds : [],
  };
}

export const retailerOfferRouter = {
  getCreationOptions: shopPermissionProcedure("shop_promotions", "view")
    .route({
      method: "GET",
      path: "/retailer-offers/creation-options",
      tags: ["Retailer Offers"],
      summary: "Get eligible templates and store offer options",
    })
    .input(z.object({}).optional())
    .handler(async ({ context }) => {
      const shopId = shopTenantId(context.session.user);
      const [templates, catalog, assignedAreas, history] = await Promise.all([
        db
          .select()
          .from(offerTemplate)
          .where(
            and(
              eq(offerTemplate.status, "active"),
              eq(offerTemplate.targetRetailers, true),
            ),
          )
          .orderBy(asc(offerTemplate.name)),
        getOwnerPosCatalog({ kind: "shop", id: shopId }),
        db
          .select({ id: area.id, name: area.name })
          .from(sellerAreaMapping)
          .innerJoin(area, eq(area.id, sellerAreaMapping.areaId))
          .where(
            and(
              eq(sellerAreaMapping.sellerId, shopId),
              eq(sellerAreaMapping.isActive, true),
              eq(area.isActive, true),
            ),
          )
          .orderBy(asc(area.name)),
        db
          .select({
            templateId: retailerOffer.templateId,
            orders: sql<number>`count(${retailerOfferApplication.id})::int`,
          })
          .from(retailerOfferApplication)
          .innerJoin(
            retailerOffer,
            eq(retailerOffer.id, retailerOfferApplication.retailerOfferId),
          )
          .where(eq(retailerOffer.shopId, shopId))
          .groupBy(retailerOffer.templateId),
      ]);
      const historicalOrders = new Map(
        history.map((item) => [item.templateId, item.orders]),
      );
      const templateVariantIds = [
        ...new Set(
          templates
            .flatMap((template) => [
              ...template.buyProducts,
              ...template.getProducts,
            ])
            .map((product) => product.variantId)
            .filter((id): id is number => id != null),
        ),
      ];
      const sourceVariants =
        templateVariantIds.length > 0
          ? await db
              .select({
                variantId: productVariant.id,
                catalogVariantId: productVariant.catalogVariantId,
              })
              .from(productVariant)
              .where(inArray(productVariant.id, templateVariantIds))
          : [];
      const resolveProducts = (products: ComboProduct[]) =>
        resolveTemplateProductIdentities(products, sourceVariants, catalog);

      const eligibleTemplates = templates
        .filter(availableInRetailStore)
        .map((template) => ({ template, type: supportedType(template) }))
        .filter(
          (entry): entry is typeof entry & { type: SupportedType } =>
            entry.type !== null,
        )
        .map(({ template, type }) => ({
          id: template.id,
          name: template.name,
          type,
          typeLabel: typeLabel(type),
          description: template.description ?? "",
          benefitType: template.benefitType,
          benefitValue: template.benefitValue,
          comboRule: template.comboRule,
          buyProducts: resolveProducts(template.buyProducts),
          getProducts: resolveProducts(template.getProducts),
          minimumQuantity:
            template.buyProducts.reduce(
              (sum, product) => sum + product.quantity,
              0,
            ) || 1,
          maximumLimit: template.totalUsageLimit,
          startDate: template.startDate,
          endDate: template.endDate,
          expectedOrders: historicalOrders.get(template.id) ?? 0,
        }));

      const categories = [
        ...new Map(
          catalog.map((row) => [
            row.categoryId,
            { id: row.categoryId, name: row.categoryName },
          ]),
        ).values(),
      ].sort((a, b) => a.name.localeCompare(b.name));

      return {
        shop: {
          id: shopId,
          name: context.session.user.shopName || context.session.user.name,
        },
        templates: eligibleTemplates,
        variants: catalog.map((row) => ({
          id: row.variantId,
          catalogVariantId: row.catalogVariantId,
          productId: row.productId,
          productName: row.productName,
          brandName: row.brandName,
          variantName: row.variantLabel,
          sku: row.sku,
          categoryId: row.categoryId,
          categoryName: row.categoryName,
          price: row.unitPrice,
          availableQty: row.availableQty,
          unitLabel: row.unitLabel,
        })),
        categories,
        areas: assignedAreas,
      };
    }),

  getDashboard: shopPermissionProcedure("shop_promotions", "view")
    .route({
      method: "GET",
      path: "/retailer-offers",
      tags: ["Retailer Offers"],
      summary: "Get My Offers, KPIs, and alerts",
    })
    .input(
      z
        .object({
          search: z.string().trim().max(120).optional(),
          status: statusSchema.optional(),
          type: typeSchema.optional(),
          dateRange: z.enum(["today", "week", "month"]).optional(),
        })
        .optional(),
    )
    .handler(async ({ context, input }) => {
      const shopId = shopTenantId(context.session.user);
      await syncLifecycle(shopId);
      const [allOffers, applications] = await Promise.all([
        db
          .select()
          .from(retailerOffer)
          .where(eq(retailerOffer.shopId, shopId))
          .orderBy(
            desc(retailerOffer.updatedAt),
            desc(retailerOffer.createdAt),
          ),
        db
          .select()
          .from(retailerOfferApplication)
          .where(eq(retailerOfferApplication.shopId, shopId)),
      ]);
      const metrics = applicationMap(applications);
      const window = dateWindow(input?.dateRange);
      const term = input?.search?.toLocaleLowerCase();
      const filtered = allOffers.filter((offer) => {
        const status = currentStatus(offer);
        if (input?.status && status !== input.status) return false;
        if (input?.type && offer.offerType !== input.type) return false;
        if (
          term &&
          ![offer.name, offer.code, productSummary(offer)].some((value) =>
            value.toLocaleLowerCase().includes(term),
          )
        ) {
          return false;
        }
        if (
          window &&
          (offer.endDate < window.start || offer.startDate > window.end)
        ) {
          return false;
        }
        return true;
      });
      const counts = {
        total: allOffers.length,
        active: 0,
        scheduled: 0,
        expired: 0,
      };
      for (const offer of allOffers) {
        const status = currentStatus(offer);
        if (status === "active") counts.active += 1;
        if (status === "scheduled") counts.scheduled += 1;
        if (status === "expired") counts.expired += 1;
      }
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayKey = (date: Date) => date.toISOString().slice(0, 10);
      const expiringToday = allOffers.filter(
        (offer) =>
          currentStatus(offer) === "active" &&
          dayKey(offer.endDate) === dayKey(now),
      ).length;
      const startingTomorrow = allOffers.filter(
        (offer) =>
          currentStatus(offer) === "scheduled" &&
          dayKey(offer.startDate) === dayKey(tomorrow),
      ).length;
      const lowPerformance = allOffers.filter((offer) => {
        const performance = metrics.get(offer.id);
        return (
          currentStatus(offer) === "active" &&
          now.getTime() - offer.startDate.getTime() >= 24 * 60 * 60 * 1000 &&
          (performance?.ordersApplied ?? 0) === 0
        );
      }).length;

      return {
        shop: {
          id: shopId,
          name: context.session.user.shopName || context.session.user.name,
        },
        showing: "All Offers",
        kpis: counts,
        offers: filtered.map((offer) => ({
          id: offer.id,
          code: offer.code,
          name: offer.name,
          product: productSummary(offer),
          type: offer.offerType as SupportedType,
          typeLabel: typeLabel(offer.offerType as SupportedType),
          discount: discountSummary(offer),
          startDate: offer.startDate,
          endDate: offer.endDate,
          status: currentStatus(offer),
        })),
        alerts: { expiringToday, lowPerformance, startingTomorrow },
      };
    }),

  getDetail: shopPermissionProcedure("shop_promotions", "view")
    .route({
      method: "GET",
      path: "/retailer-offers/{id}",
      tags: ["Retailer Offers"],
      summary: "Get retailer offer details and performance",
    })
    .input(z.object({ id: z.number().int().positive() }))
    .handler(async ({ context, input }) => {
      const shopId = shopTenantId(context.session.user);
      await syncLifecycle(shopId);
      const offer = await db.query.retailerOffer.findFirst({
        where: and(
          eq(retailerOffer.id, input.id),
          eq(retailerOffer.shopId, shopId),
        ),
      });
      if (!offer) {
        throw new ORPCError("NOT_FOUND", { message: "Offer not found" });
      }
      const applications = await db
        .select()
        .from(retailerOfferApplication)
        .where(eq(retailerOfferApplication.retailerOfferId, offer.id));
      const performance = applicationMap(applications).get(offer.id) ?? {
        ordersApplied: 0,
        totalDiscount: 0,
        salesGenerated: 0,
      };
      return {
        ...offer,
        status: currentStatus(offer),
        typeLabel: typeLabel(offer.offerType as SupportedType),
        product: productSummary(offer),
        discount: discountSummary(offer),
        applicableTo:
          offer.targetType === "all_customers"
            ? "All Customers"
            : offer.targetType === "specific_customers"
              ? "Specific Customers"
              : "Area Based",
        performance,
      };
    }),

  create: shopPermissionProcedure("shop_promotions", "create")
    .route({
      method: "POST",
      path: "/retailer-offers",
      tags: ["Retailer Offers"],
      summary: "Create an offer from an Admin template",
    })
    .input(
      editableOfferSchema.extend({
        templateId: z.number().int().positive(),
        activation: z.enum(["activate", "draft"]),
      }),
    )
    .handler(async ({ context, input }) => {
      const shopId = shopTenantId(context.session.user);
      const template = await db.query.offerTemplate.findFirst({
        where: and(
          eq(offerTemplate.id, input.templateId),
          eq(offerTemplate.status, "active"),
          eq(offerTemplate.targetRetailers, true),
        ),
      });
      if (!template) {
        throw new ORPCError("NOT_FOUND", {
          message: "Active retailer template not found",
        });
      }
      if (!availableInRetailStore(template)) {
        throw new ORPCError("BAD_REQUEST", {
          message: "This template is not available for a retail store",
        });
      }
      const offerType = supportedType(template);
      if (!offerType) {
        throw new ORPCError("BAD_REQUEST", {
          message: "This template is not supported for retailer offers",
        });
      }
      assertDiscountValue(offerType, input.discountValue);
      const resolvedComboProducts =
        offerType === "buy_x_get_y"
          ? await resolveComboProductsForOwner(shopId, [
              ...template.buyProducts,
              ...template.getProducts,
            ])
          : [];
      const resolvedBuyProducts = resolvedComboProducts.slice(
        0,
        template.buyProducts.length,
      );
      const resolvedGetProducts = resolvedComboProducts.slice(
        template.buyProducts.length,
      );
      const selection = await resolveSelection(
        shopId,
        input,
        offerType,
        resolvedComboProducts,
        input.activation === "activate",
      );
      const now = new Date();
      const status =
        input.activation === "draft"
          ? "draft"
          : new Date(input.startDate) > now
            ? "scheduled"
            : "active";
      const [created] = await db
        .insert(retailerOffer)
        .values({
          code: offerCode(),
          shopId,
          templateId: template.id,
          templateSnapshot: {
            code: template.code,
            name: template.name,
            description: template.description,
            type: template.type,
            comboRule: template.comboRule,
            buyProducts:
              offerType === "buy_x_get_y"
                ? snapshotComboProducts(resolvedBuyProducts)
                : template.buyProducts,
            getProducts:
              offerType === "buy_x_get_y"
                ? snapshotComboProducts(resolvedGetProducts)
                : template.getProducts,
            benefitType: template.benefitType,
            benefitValue: template.benefitValue,
            maxUsePerOrder: template.maxUsePerOrder,
          },
          offerType,
          discountType:
            offerType === "percentage"
              ? "percentage"
              : offerType === "flat"
                ? "fixed"
                : template.benefitType,
          ...toEditableValues(input),
          ...selection,
          status,
        })
        .returning();
      if (!created) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Offer could not be created",
        });
      }
      await refreshTemplateUsage(template.id);
      return { message: "Offer saved", offer: created };
    }),

  update: shopPermissionProcedure("shop_promotions", "update")
    .route({
      method: "PUT",
      path: "/retailer-offers/{id}",
      tags: ["Retailer Offers"],
      summary: "Edit owner-controlled offer fields",
    })
    .input(
      z.object({
        id: z.number().int().positive(),
        data: editableOfferSchema,
      }),
    )
    .handler(async ({ context, input }) => {
      const shopId = shopTenantId(context.session.user);
      const existing = await db.query.retailerOffer.findFirst({
        where: and(
          eq(retailerOffer.id, input.id),
          eq(retailerOffer.shopId, shopId),
        ),
      });
      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Offer not found" });
      }
      assertDiscountValue(
        existing.offerType as SupportedType,
        input.data.discountValue,
      );
      const resolvedComboProducts =
        existing.offerType === "buy_x_get_y"
          ? await resolveComboProductsForOwner(shopId, [
              ...existing.templateSnapshot.buyProducts,
              ...existing.templateSnapshot.getProducts,
            ])
          : [];
      const selection = await resolveSelection(
        shopId,
        input.data,
        existing.offerType as SupportedType,
        resolvedComboProducts,
        existing.status !== "draft",
      );
      const [updated] = await db
        .update(retailerOffer)
        .set({
          ...toEditableValues(input.data),
          ...selection,
          status:
            existing.status === "draft"
              ? "draft"
              : new Date(input.data.startDate) > new Date()
                ? "scheduled"
                : "active",
          updatedAt: new Date(),
        })
        .where(
          and(eq(retailerOffer.id, input.id), eq(retailerOffer.shopId, shopId)),
        )
        .returning();
      return { message: "Offer updated", offer: updated };
    }),

  setAction: shopPermissionProcedure("shop_promotions", "update")
    .route({
      method: "PATCH",
      path: "/retailer-offers/{id}/action",
      tags: ["Retailer Offers"],
      summary: "Activate, pause, or deactivate an offer",
    })
    .input(
      z.object({
        id: z.number().int().positive(),
        action: z.enum(["activate", "pause", "deactivate"]),
      }),
    )
    .handler(async ({ context, input }) => {
      const shopId = shopTenantId(context.session.user);
      const existing = await db.query.retailerOffer.findFirst({
        where: and(
          eq(retailerOffer.id, input.id),
          eq(retailerOffer.shopId, shopId),
        ),
      });
      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Offer not found" });
      }
      if (input.action === "activate" && existing.endDate <= new Date()) {
        throw new ORPCError("BAD_REQUEST", {
          message: "An expired offer cannot be activated",
        });
      }
      if (input.action === "activate" && existing.offerType === "buy_x_get_y") {
        assertComboProductsAvailable(
          await resolveComboProductsForOwner(shopId, [
            ...existing.templateSnapshot.buyProducts,
            ...existing.templateSnapshot.getProducts,
          ]),
        );
      }
      const now = new Date();
      const status =
        input.action === "activate"
          ? existing.startDate > now
            ? "scheduled"
            : "active"
          : "draft";
      const [updated] = await db
        .update(retailerOffer)
        .set({
          status,
          pausedAt: input.action === "pause" ? now : null,
          deactivatedAt: input.action === "deactivate" ? now : null,
          updatedAt: now,
        })
        .where(
          and(eq(retailerOffer.id, input.id), eq(retailerOffer.shopId, shopId)),
        )
        .returning();
      await refreshTemplateUsage(existing.templateId);
      return { message: "Offer status updated", offer: updated };
    }),
};
