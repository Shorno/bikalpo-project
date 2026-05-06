import { db } from "@bikalpo-project/db";
import {
    and,
    desc,
    eq,
    ilike,
    inArray,
    or,
    sql,
    type SQL,
} from "drizzle-orm";
import {
    inventory,
    user,
    warehousePosCart,
    warehousePosCustomer,
    warehousePosPayment,
    warehousePosSale,
    warehousePosSaleItem,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { warehouseProcedure } from "../index";

const catalogFilterSchema = z.object({
    search: z.string().optional(),
    typeId: z.number().int().optional(),
    categoryId: z.number().int().optional(),
    subCategoryId: z.number().int().optional(),
    coreProductId: z.number().int().optional(),
    brandId: z.number().int().optional(),
    pack: z.string().optional(),
});

const cartItemInputSchema = z.object({
    variantId: z.number().int(),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative().optional(),
});

const saleTypeSchema = z.enum(["retail", "wholesale"]);
const paymentMethodSchema = z.enum(["cash", "bkash", "nagad", "bank", "due"]);

type CatalogVariantRow = {
    variantId: number;
    productId: number;
    sku: string | null;
    productName: string;
    coreProductName: string;
    typeId: number;
    typeName: string;
    categoryId: number;
    categoryName: string;
    subCategoryId: number;
    subCategoryName: string;
    coreProductId: number;
    brandId: number | null;
    brandName: string;
    pack: string;
    variantLabel: string;
    unitLabel: string;
    availableQty: number;
    unitPrice: number;
};

type ResolvedSaleLine = {
    variantId: number;
    productId: number;
    sku: string | null;
    productName: string;
    variantLabel: string;
    unitLabel: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
};

function toNumber(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toMoney(value: number): string {
    return value.toFixed(2);
}

function formatPackLabel(variant: {
    packWeightKg: string | null;
    weightKg: string;
    unitLabel: string;
    packType: string | null;
}): string {
    const packWeight = toNumber(variant.packWeightKg);
    if (packWeight > 0) return `${packWeight % 1 === 0 ? packWeight.toFixed(0) : packWeight}KG`;
    const unitWeight = toNumber(variant.weightKg);
    if (unitWeight > 0) return `${unitWeight % 1 === 0 ? unitWeight.toFixed(0) : unitWeight}KG`;
    if (variant.unitLabel) return variant.unitLabel;
    if (variant.packType) return variant.packType.toUpperCase();
    return "N/A";
}

async function ensureWalkInCustomer(warehouseId: string, userId: string) {
    const existing = await db.query.warehousePosCustomer.findFirst({
        where: and(
            eq(warehousePosCustomer.warehouseId, warehouseId),
            eq(warehousePosCustomer.isDefault, true),
        ),
    });

    if (existing) return existing;

    const [created] = await db
        .insert(warehousePosCustomer)
        .values({
            warehouseId,
            name: "Walk-in Customer",
            customerType: "walk_in",
            isDefault: true,
            createdById: userId,
        })
        .returning();

    if (!created) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Failed to create default walk-in customer",
        });
    }

    return created;
}

async function generateInvoiceNo(
    warehouseId: string,
    saleType: "retail" | "wholesale",
): Promise<string> {
    const prefix = saleType === "wholesale" ? "WH-INV-" : "INV-";
    const [countRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(warehousePosSale)
        .where(
            and(
                eq(warehousePosSale.warehouseId, warehouseId),
                eq(warehousePosSale.saleType, saleType),
            ),
        );

    return `${prefix}${String((countRow?.count ?? 0) + 1).padStart(4, "0")}`;
}

async function generateHeldRef(warehouseId: string): Promise<string> {
    const [countRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(warehousePosCart)
        .where(eq(warehousePosCart.warehouseId, warehouseId));

    return `HOLD-${String((countRow?.count ?? 0) + 1).padStart(4, "0")}`;
}

async function getCatalogRows(warehouseId: string): Promise<CatalogVariantRow[]> {
    const stockRows = await db.query.inventory.findMany({
        where: and(
            eq(inventory.ownerType, "warehouse"),
            eq(inventory.ownerId, warehouseId),
            sql`CAST(${inventory.availableQty} AS numeric) > 0`,
        ),
        columns: {
            availableQty: true,
            retailPrice: true,
        },
        with: {
            variant: {
                columns: {
                    id: true,
                    sku: true,
                    weightKg: true,
                    unitLabel: true,
                    price: true,
                    packWeightKg: true,
                    packType: true,
                },
                with: {
                    brand: {
                        columns: {
                            id: true,
                            name: true,
                        },
                    },
                    product: {
                        columns: {
                            id: true,
                            name: true,
                            categoryId: true,
                            subCategoryId: true,
                            coreProductId: true,
                        },
                        with: {
                            coreProduct: {
                                columns: { id: true, name: true },
                            },
                            category: {
                                columns: { id: true, name: true, typeId: true },
                                with: {
                                    type: {
                                        columns: { id: true, name: true },
                                    },
                                },
                            },
                            subCategory: {
                                columns: { id: true, name: true },
                            },
                        },
                    },
                },
            },
        },
    });

    const rows: CatalogVariantRow[] = [];

    for (const entry of stockRows) {
        const variant = entry.variant;
        const product = variant?.product;
        const category = product?.category;
        const subCategory = product?.subCategory;
        const coreProduct = product?.coreProduct;
        const type = category?.type;

        if (!variant || !product || !category || !subCategory || !coreProduct || !type) {
            continue;
        }

        const pack = formatPackLabel({
            packWeightKg: variant.packWeightKg,
            weightKg: variant.weightKg,
            unitLabel: variant.unitLabel,
            packType: variant.packType,
        });
        const brandName = variant.brand?.name || "";
        const unitPrice = toNumber(entry.retailPrice) > 0
            ? toNumber(entry.retailPrice)
            : toNumber(variant.price);

        rows.push({
            variantId: variant.id,
            productId: product.id,
            sku: variant.sku,
            productName: product.name,
            coreProductName: coreProduct.name,
            typeId: type.id,
            typeName: type.name,
            categoryId: category.id,
            categoryName: category.name,
            subCategoryId: subCategory.id,
            subCategoryName: subCategory.name,
            coreProductId: coreProduct.id,
            brandId: variant.brand?.id ?? null,
            brandName,
            pack,
            variantLabel: pack,
            unitLabel: variant.unitLabel,
            availableQty: toNumber(entry.availableQty),
            unitPrice,
        });
    }

    return rows;
}

async function resolveSaleLines(
    warehouseId: string,
    items: Array<{ variantId: number; quantity: number; unitPrice?: number }>,
): Promise<{ lines: ResolvedSaleLine[]; subtotal: number }> {
    const variantIds = Array.from(new Set(items.map((item) => item.variantId)));

    if (variantIds.length === 0) {
        throw new ORPCError("BAD_REQUEST", { message: "No product selected" });
    }

    const stockRows = await db.query.inventory.findMany({
        where: and(
            eq(inventory.ownerType, "warehouse"),
            eq(inventory.ownerId, warehouseId),
            inArray(inventory.variantId, variantIds),
        ),
        columns: {
            variantId: true,
            availableQty: true,
            retailPrice: true,
        },
        with: {
            variant: {
                columns: {
                    id: true,
                    sku: true,
                    weightKg: true,
                    unitLabel: true,
                    price: true,
                    packWeightKg: true,
                    packType: true,
                },
                with: {
                    brand: {
                        columns: {
                            name: true,
                        },
                    },
                    product: {
                        columns: {
                            id: true,
                            name: true,
                        },
                        with: {
                            coreProduct: {
                                columns: {
                                    name: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    const stockMap = new Map<number, (typeof stockRows)[number]>();
    for (const row of stockRows) {
        stockMap.set(row.variantId, row);
    }

    const lines: ResolvedSaleLine[] = [];

    for (const item of items) {
        const stock = stockMap.get(item.variantId);
        if (!stock?.variant?.product) {
            throw new ORPCError("BAD_REQUEST", {
                message: `Variant ${item.variantId} is not available in warehouse stock`,
            });
        }

        const availableQty = toNumber(stock.availableQty);
        if (availableQty < item.quantity) {
            throw new ORPCError("BAD_REQUEST", {
                message: `Insufficient stock for ${stock.variant.product.name}. Available ${availableQty}, requested ${item.quantity}`,
            });
        }

        const pack = formatPackLabel({
            packWeightKg: stock.variant.packWeightKg,
            weightKg: stock.variant.weightKg,
            unitLabel: stock.variant.unitLabel,
            packType: stock.variant.packType,
        });
        const unitPrice = item.unitPrice && item.unitPrice > 0
            ? item.unitPrice
            : (toNumber(stock.retailPrice) > 0
                ? toNumber(stock.retailPrice)
                : toNumber(stock.variant.price));
        const lineTotal = unitPrice * item.quantity;

        lines.push({
            variantId: stock.variant.id,
            productId: stock.variant.product.id,
            sku: stock.variant.sku,
            productName: stock.variant.product.coreProduct?.name || stock.variant.product.name,
            variantLabel: pack,
            unitLabel: stock.variant.unitLabel,
            quantity: item.quantity,
            unitPrice,
            lineTotal,
        });
    }

    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    return { lines, subtotal };
}

export const warehousePosRouter = {
    getBootstrap: warehouseProcedure
        .input(z.object({}).optional())
        .handler(async ({ context }) => {
            const warehouseId = context.session.user.id;
            const walkInCustomer = await ensureWalkInCustomer(warehouseId, warehouseId);

            return {
                welcomeName: context.session.user.name,
                today: new Date().toISOString(),
                defaultCustomer: {
                    id: walkInCustomer.id,
                    name: walkInCustomer.name,
                    phone: walkInCustomer.phone,
                    customerType: walkInCustomer.customerType,
                },
                paymentMethods: ["cash", "bkash", "nagad", "bank", "due"] as const,
            };
        }),

    getCatalog: warehouseProcedure
        .input(catalogFilterSchema.optional())
        .handler(async ({ context, input }) => {
            const warehouseId = context.session.user.id;
            const filter = input ?? {};
            const rawRows = await getCatalogRows(warehouseId);
            const searchTerm = filter.search?.trim().toLowerCase();

            const searchRows = searchTerm
                ? rawRows.filter((row) =>
                    row.productName.toLowerCase().includes(searchTerm)
                    || row.coreProductName.toLowerCase().includes(searchTerm)
                    || row.variantLabel.toLowerCase().includes(searchTerm)
                    || row.brandName.toLowerCase().includes(searchTerm)
                    || (row.sku || "").toLowerCase().includes(searchTerm),
                )
                : rawRows;

            const filteredRows = searchRows.filter((row) => {
                if (filter.typeId && row.typeId !== filter.typeId) return false;
                if (filter.categoryId && row.categoryId !== filter.categoryId) return false;
                if (filter.subCategoryId && row.subCategoryId !== filter.subCategoryId) return false;
                if (filter.coreProductId && row.coreProductId !== filter.coreProductId) return false;
                if (filter.brandId && row.brandId !== filter.brandId) return false;
                if (filter.pack && row.pack !== filter.pack) return false;
                return true;
            });

            const rowsForCategories = filter.typeId
                ? searchRows.filter((row) => row.typeId === filter.typeId)
                : searchRows;
            const rowsForSubCategories = searchRows.filter((row) => {
                if (filter.typeId && row.typeId !== filter.typeId) return false;
                if (filter.categoryId && row.categoryId !== filter.categoryId) return false;
                return true;
            });
            const rowsForCoreProducts = searchRows.filter((row) => {
                if (filter.typeId && row.typeId !== filter.typeId) return false;
                if (filter.categoryId && row.categoryId !== filter.categoryId) return false;
                if (filter.subCategoryId && row.subCategoryId !== filter.subCategoryId) return false;
                return true;
            });
            const rowsForVariants = searchRows.filter((row) => {
                if (filter.typeId && row.typeId !== filter.typeId) return false;
                if (filter.categoryId && row.categoryId !== filter.categoryId) return false;
                if (filter.subCategoryId && row.subCategoryId !== filter.subCategoryId) return false;
                if (filter.coreProductId && row.coreProductId !== filter.coreProductId) return false;
                return true;
            });

            const typesMap = new Map<number, { id: number; name: string }>();
            const categoriesMap = new Map<number, { id: number; name: string; typeId: number }>();
            const subCategoriesMap = new Map<number, { id: number; name: string; categoryId: number }>();
            const coreProductsMap = new Map<number, { id: number; name: string; subCategoryId: number }>();
            const brandsMap = new Map<number, { id: number; name: string }>();
            const packsSet = new Set<string>();

            for (const row of searchRows) {
                typesMap.set(row.typeId, { id: row.typeId, name: row.typeName });
            }
            for (const row of rowsForCategories) {
                categoriesMap.set(row.categoryId, {
                    id: row.categoryId,
                    name: row.categoryName,
                    typeId: row.typeId,
                });
            }
            for (const row of rowsForSubCategories) {
                subCategoriesMap.set(row.subCategoryId, {
                    id: row.subCategoryId,
                    name: row.subCategoryName,
                    categoryId: row.categoryId,
                });
            }
            for (const row of rowsForCoreProducts) {
                coreProductsMap.set(row.coreProductId, {
                    id: row.coreProductId,
                    name: row.coreProductName,
                    subCategoryId: row.subCategoryId,
                });
            }
            for (const row of rowsForVariants) {
                if (row.brandId) {
                    brandsMap.set(row.brandId, {
                        id: row.brandId,
                        name: row.brandName,
                    });
                }
                packsSet.add(row.pack);
            }

            return {
                options: {
                    types: Array.from(typesMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
                    categories: Array.from(categoriesMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
                    subCategories: Array.from(subCategoriesMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
                    coreProducts: Array.from(coreProductsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
                    brands: Array.from(brandsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
                    packs: Array.from(packsSet.values()).sort((a, b) => a.localeCompare(b)),
                },
                variants: filteredRows.sort((a, b) => a.productName.localeCompare(b.productName)),
            };
        }),

    searchCustomers: warehouseProcedure
        .input(z.object({ search: z.string().optional() }).optional())
        .handler(async ({ context, input }) => {
            const warehouseId = context.session.user.id;
            const searchTerm = input?.search?.trim();
            const conditions: SQL[] = [eq(warehousePosCustomer.warehouseId, warehouseId)];

            if (searchTerm) {
                const textFilter = or(
                    ilike(warehousePosCustomer.name, `%${searchTerm}%`),
                    ilike(warehousePosCustomer.phone, `%${searchTerm}%`),
                );
                if (textFilter) conditions.push(textFilter);
            }

            const customers = await db
                .select({
                    id: warehousePosCustomer.id,
                    name: warehousePosCustomer.name,
                    phone: warehousePosCustomer.phone,
                    address: warehousePosCustomer.address,
                    customerType: warehousePosCustomer.customerType,
                    isDefault: warehousePosCustomer.isDefault,
                    createdAt: warehousePosCustomer.createdAt,
                })
                .from(warehousePosCustomer)
                .where(and(...conditions))
                .orderBy(desc(warehousePosCustomer.isDefault), desc(warehousePosCustomer.createdAt))
                .limit(30);

            return { customers };
        }),

    createCustomer: warehouseProcedure
        .input(
            z.object({
                name: z.string().min(2),
                phone: z.string().max(30).optional(),
                address: z.string().optional(),
                customerType: z.enum(["walk_in", "retail", "wholesale"]).default("retail"),
                isDefault: z.boolean().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const warehouseId = context.session.user.id;

            if (input.isDefault) {
                await db
                    .update(warehousePosCustomer)
                    .set({ isDefault: false })
                    .where(eq(warehousePosCustomer.warehouseId, warehouseId));
            }

            const [created] = await db
                .insert(warehousePosCustomer)
                .values({
                    warehouseId,
                    name: input.name,
                    phone: input.phone || null,
                    address: input.address || null,
                    customerType: input.customerType,
                    isDefault: input.isDefault ?? false,
                    createdById: warehouseId,
                })
                .returning();

            return { customer: created };
        }),

    listHeldCarts: warehouseProcedure
        .input(z.object({}).optional())
        .handler(async ({ context }) => {
            const warehouseId = context.session.user.id;
            const carts = await db.query.warehousePosCart.findMany({
                where: and(
                    eq(warehousePosCart.warehouseId, warehouseId),
                    eq(warehousePosCart.status, "held"),
                ),
                with: {
                    customer: {
                        columns: { id: true, name: true, phone: true, customerType: true },
                    },
                },
                orderBy: [desc(warehousePosCart.createdAt)],
                limit: 30,
            });

            return { carts };
        }),

    holdCart: warehouseProcedure
        .input(
            z.object({
                saleType: saleTypeSchema.default("retail"),
                customerId: z.number().int().optional(),
                discount: z.number().nonnegative().optional(),
                tax: z.number().nonnegative().optional(),
                note: z.string().optional(),
                items: z.array(cartItemInputSchema).min(1),
            }),
        )
        .handler(async ({ context, input }) => {
            const warehouseId = context.session.user.id;
            const discount = input.discount ?? 0;
            const tax = input.tax ?? 0;
            const { lines, subtotal } = await resolveSaleLines(warehouseId, input.items);
            const total = Math.max(0, subtotal - discount + tax);
            const heldRef = await generateHeldRef(warehouseId);

            const [created] = await db
                .insert(warehousePosCart)
                .values({
                    warehouseId,
                    customerId: input.customerId ?? null,
                    heldRef,
                    cartData: {
                        saleType: input.saleType,
                        items: lines.map((line) => ({
                            variantId: line.variantId,
                            productId: line.productId,
                            sku: line.sku,
                            productName: line.productName,
                            variantLabel: line.variantLabel,
                            unitLabel: line.unitLabel,
                            quantity: toMoney(line.quantity),
                            unitPrice: toMoney(line.unitPrice),
                            lineTotal: toMoney(line.lineTotal),
                        })),
                        note: input.note || null,
                    },
                    subtotal: toMoney(subtotal),
                    discount: toMoney(discount),
                    tax: toMoney(tax),
                    total: toMoney(total),
                    status: "held",
                    heldById: warehouseId,
                })
                .returning();

            return { cart: created };
        }),

    cancelHeldCart: warehouseProcedure
        .input(z.object({ cartId: z.number().int() }))
        .handler(async ({ context, input }) => {
            const warehouseId = context.session.user.id;
            const [updated] = await db
                .update(warehousePosCart)
                .set({ status: "cancelled" })
                .where(
                    and(
                        eq(warehousePosCart.id, input.cartId),
                        eq(warehousePosCart.warehouseId, warehouseId),
                    ),
                )
                .returning({ id: warehousePosCart.id, status: warehousePosCart.status });

            if (!updated) {
                throw new ORPCError("NOT_FOUND", { message: "Held cart not found" });
            }

            return { cart: updated };
        }),

    completeSale: warehouseProcedure
        .input(
            z.object({
                saleType: saleTypeSchema.default("retail"),
                customerId: z.number().int().optional(),
                customerName: z.string().optional(),
                customerPhone: z.string().optional(),
                customerAddress: z.string().optional(),
                paymentMethod: paymentMethodSchema,
                paidAmount: z.number().nonnegative().optional(),
                discount: z.number().nonnegative().optional(),
                tax: z.number().nonnegative().optional(),
                note: z.string().optional(),
                heldCartId: z.number().int().optional(),
                items: z.array(cartItemInputSchema).min(1),
            }),
        )
        .handler(async ({ context, input }) => {
            const warehouseId = context.session.user.id;
            const discount = input.discount ?? 0;
            const tax = input.tax ?? 0;
            const { lines, subtotal } = await resolveSaleLines(warehouseId, input.items);
            const total = Math.max(0, subtotal - discount + tax);
            const paid = input.paidAmount !== undefined
                ? Math.max(0, input.paidAmount)
                : (input.paymentMethod === "due" ? 0 : total);
            const due = Math.max(0, total - paid);

            let customerId: number | null = input.customerId ?? null;
            let customerName = (input.customerName || "").trim();
            let customerPhone = (input.customerPhone || "").trim() || null;
            let customerAddress = (input.customerAddress || "").trim() || null;

            if (customerId) {
                const customer = await db.query.warehousePosCustomer.findFirst({
                    where: and(
                        eq(warehousePosCustomer.id, customerId),
                        eq(warehousePosCustomer.warehouseId, warehouseId),
                    ),
                });
                if (!customer) {
                    throw new ORPCError("BAD_REQUEST", {
                        message: "Selected customer does not belong to this warehouse",
                    });
                }
                customerName = customer.name;
                customerPhone = customer.phone;
                customerAddress = customer.address;
            } else if (!customerName) {
                const walkIn = await ensureWalkInCustomer(warehouseId, warehouseId);
                customerId = walkIn.id;
                customerName = walkIn.name;
                customerPhone = walkIn.phone;
                customerAddress = walkIn.address;
            }

            const invoiceNo = await generateInvoiceNo(warehouseId, input.saleType);

            const result = await db.transaction(async (tx) => {
                // Atomic stock deduction (guarded against negative stock)
                for (const line of lines) {
                    const updatedInventory = await tx
                        .update(inventory)
                        .set({
                            availableQty: sql`CAST(${inventory.availableQty} AS numeric) - ${line.quantity}`,
                        })
                        .where(
                            and(
                                eq(inventory.ownerType, "warehouse"),
                                eq(inventory.ownerId, warehouseId),
                                eq(inventory.variantId, line.variantId),
                                sql`CAST(${inventory.availableQty} AS numeric) >= ${line.quantity}`,
                            ),
                        )
                        .returning({ id: inventory.id });

                    if (updatedInventory.length === 0) {
                        throw new ORPCError("BAD_REQUEST", {
                            message: `Insufficient stock while finalizing sale for variant ${line.variantId}`,
                        });
                    }
                }

                const [sale] = await tx
                    .insert(warehousePosSale)
                    .values({
                        warehouseId,
                        saleType: input.saleType,
                        invoiceNo,
                        customerId,
                        customerName,
                        customerPhone,
                        customerAddress,
                        subtotal: toMoney(subtotal),
                        discount: toMoney(discount),
                        tax: toMoney(tax),
                        total: toMoney(total),
                        paid: toMoney(paid),
                        due: toMoney(due),
                        paymentMethod: input.paymentMethod,
                        status: "completed",
                        note: input.note || null,
                        heldCartId: input.heldCartId ?? null,
                        soldById: warehouseId,
                    })
                    .returning();

                if (!sale) {
                    throw new ORPCError("INTERNAL_SERVER_ERROR", {
                        message: "Failed to create POS sale",
                    });
                }

                await tx.insert(warehousePosSaleItem).values(
                    lines.map((line) => ({
                        saleId: sale.id,
                        variantId: line.variantId,
                        productId: line.productId,
                        sku: line.sku,
                        productName: line.productName,
                        variantLabel: line.variantLabel,
                        quantity: toMoney(line.quantity),
                        unitLabel: line.unitLabel,
                        unitPrice: toMoney(line.unitPrice),
                        lineTotal: toMoney(line.lineTotal),
                    })),
                );

                if (paid > 0) {
                    await tx.insert(warehousePosPayment).values({
                        saleId: sale.id,
                        paymentMethod: input.paymentMethod,
                        amount: toMoney(paid),
                        createdById: warehouseId,
                    });
                }

                if (input.heldCartId) {
                    await tx
                        .update(warehousePosCart)
                        .set({ status: "converted" })
                        .where(
                            and(
                                eq(warehousePosCart.id, input.heldCartId),
                                eq(warehousePosCart.warehouseId, warehouseId),
                            ),
                        );
                }

                return sale;
            });

            return {
                saleId: result.id,
                invoiceNo: result.invoiceNo,
                totals: {
                    subtotal: toMoney(subtotal),
                    discount: toMoney(discount),
                    tax: toMoney(tax),
                    total: toMoney(total),
                    paid: toMoney(paid),
                    due: toMoney(due),
                },
            };
        }),

    getSaleInvoice: warehouseProcedure
        .input(z.object({ saleId: z.number().int() }))
        .handler(async ({ context, input }) => {
            const warehouseId = context.session.user.id;

            const sale = await db.query.warehousePosSale.findFirst({
                where: and(
                    eq(warehousePosSale.id, input.saleId),
                    eq(warehousePosSale.warehouseId, warehouseId),
                ),
                with: {
                    items: {
                        columns: {
                            id: true,
                            productName: true,
                            variantLabel: true,
                            quantity: true,
                            unitLabel: true,
                            unitPrice: true,
                            lineTotal: true,
                        },
                    },
                    customer: {
                        columns: {
                            id: true,
                            name: true,
                            phone: true,
                            address: true,
                            customerType: true,
                        },
                    },
                    payments: {
                        columns: {
                            amount: true,
                            paymentMethod: true,
                            paidAt: true,
                        },
                        orderBy: [desc(warehousePosPayment.createdAt)],
                        limit: 1,
                    },
                },
            });

            if (!sale) {
                throw new ORPCError("NOT_FOUND", { message: "Sale not found" });
            }

            const [warehouse] = await db
                .select({
                    warehouseName: user.warehouseName,
                    warehouseAddress: user.warehouseAddress,
                    phoneNumber: user.phoneNumber,
                })
                .from(user)
                .where(eq(user.id, warehouseId))
                .limit(1);

            return {
                sale: {
                    id: sale.id,
                    invoiceNo: sale.invoiceNo,
                    saleType: sale.saleType,
                    paymentMethod: sale.paymentMethod,
                    subtotal: sale.subtotal,
                    discount: sale.discount,
                    tax: sale.tax,
                    total: sale.total,
                    paid: sale.paid,
                    due: sale.due,
                    createdAt: sale.createdAt,
                    note: sale.note,
                },
                store: {
                    name: warehouse?.warehouseName || context.session.user.name,
                    address: warehouse?.warehouseAddress || null,
                    phone: warehouse?.phoneNumber || null,
                },
                customer: {
                    name: sale.customerName,
                    phone: sale.customerPhone,
                    address: sale.customerAddress,
                    customerType: sale.customer?.customerType || null,
                },
                items: sale.items,
                payment: sale.payments[0] || null,
            };
        }),

    listRecentSales: warehouseProcedure
        .input(
            z.object({
                limit: z.number().int().min(1).max(100).default(20),
            }).optional(),
        )
        .handler(async ({ context, input }) => {
            const warehouseId = context.session.user.id;
            const limit = input?.limit ?? 20;

            const sales = await db
                .select({
                    id: warehousePosSale.id,
                    invoiceNo: warehousePosSale.invoiceNo,
                    saleType: warehousePosSale.saleType,
                    customerName: warehousePosSale.customerName,
                    total: warehousePosSale.total,
                    paid: warehousePosSale.paid,
                    due: warehousePosSale.due,
                    paymentMethod: warehousePosSale.paymentMethod,
                    createdAt: warehousePosSale.createdAt,
                })
                .from(warehousePosSale)
                .where(eq(warehousePosSale.warehouseId, warehouseId))
                .orderBy(desc(warehousePosSale.createdAt))
                .limit(limit);

            return { sales };
        }),
};
