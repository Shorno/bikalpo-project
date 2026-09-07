import { db } from "@bikalpo-project/db";
import {
    resolveVariantOperations,
    resolveVariantStockSemantics,
} from "@bikalpo-project/db/variant-definition";
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
    financePaymentAccount,
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
import { ensurePosWalkInCustomer } from "../services/owner-pos-store";
import {
    calculatePosSplitPayments,
    validatePosDueCustomer,
} from "../services/owner-pos";
import { postWarehousePosSaleAccounting } from "../services/warehouse-pos-accounting";

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
});

const saleTypeSchema = z.enum(["retail", "wholesale"]);

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
    allowsDecimal: boolean;
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
    return ensurePosWalkInCustomer({ kind: "warehouse", id: warehouseId }, userId);
}

async function generateInvoiceNo(): Promise<string> {
    const result = await db.execute<{ sequence: string }>(
        sql`SELECT nextval('warehouse_pos_invoice_seq')::text AS sequence`,
    );
    const sequence = result.rows[0]?.sequence;
    if (!sequence) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Could not generate warehouse POS invoice number",
        });
    }
    const date = new Date();
    const datePart = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("");
    return `INV-${datePart}-${sequence.padStart(6, "0")}`;
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
                    orderUnit: true,
                },
                with: {
                    sourceVariantOption: true,
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

        const stockSemantics = variant.sourceVariantOption
            ? resolveVariantStockSemantics(variant.sourceVariantOption)
            : null;
        const operations = variant.sourceVariantOption
            ? resolveVariantOperations(variant.sourceVariantOption)
            : null;
        const pack = stockSemantics?.displayLabel ?? formatPackLabel({
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
            unitLabel: operations?.operationalUnit ?? variant.orderUnit ?? variant.unitLabel,
            allowsDecimal: operations?.allowsDecimal ?? false,
            availableQty: toNumber(entry.availableQty),
            unitPrice,
        });
    }

    return rows;
}

async function resolveSaleLines(
    warehouseId: string,
    items: Array<{ variantId: number; quantity: number }>,
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
                    orderUnit: true,
                },
                with: {
                    sourceVariantOption: true,
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

        const operations = stock.variant.sourceVariantOption
            ? resolveVariantOperations(stock.variant.sourceVariantOption)
            : null;
        if (
            operations &&
            !operations.allowsDecimal &&
            !Number.isInteger(item.quantity)
        ) {
            throw new ORPCError("BAD_REQUEST", {
                message: `${stock.variant.product.name} must be sold in whole ${operations.operationalUnit} quantities`,
            });
        }

        const pack = stock.variant.sourceVariantOption
            ? resolveVariantStockSemantics(stock.variant.sourceVariantOption).displayLabel
            : formatPackLabel({
            packWeightKg: stock.variant.packWeightKg,
            weightKg: stock.variant.weightKg,
            unitLabel: stock.variant.unitLabel,
            packType: stock.variant.packType,
        });
        const unitPrice = toNumber(stock.retailPrice) > 0
            ? toNumber(stock.retailPrice)
            : toNumber(stock.variant.price);
        const lineTotal = unitPrice * item.quantity;

        lines.push({
            variantId: stock.variant.id,
            productId: stock.variant.product.id,
            sku: stock.variant.sku,
            productName: stock.variant.product.coreProduct?.name || stock.variant.product.name,
            variantLabel: pack,
            unitLabel:
                operations?.operationalUnit ??
                stock.variant.orderUnit ??
                stock.variant.unitLabel,
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
        .input(
            z.object({
                search: z.string().optional(),
                customerId: z.number().int().positive().optional(),
            }).optional(),
        )
        .handler(async ({ context, input }) => {
            const warehouseId = context.session.user.id;
            const searchTerm = input?.search?.trim();
            const conditions: SQL[] = [eq(warehousePosCustomer.warehouseId, warehouseId)];

            if (input?.customerId) {
                conditions.push(eq(warehousePosCustomer.id, input.customerId));
            }

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

            const customerIds = customers.map((customer) => customer.id);
            const dueRows = customerIds.length
                ? await db
                    .select({
                        customerId: warehousePosSale.customerId,
                        outstanding: sql<string>`COALESCE(SUM(${warehousePosSale.due}::numeric), 0)::text`,
                    })
                    .from(warehousePosSale)
                    .where(
                        and(
                            eq(warehousePosSale.warehouseId, warehouseId),
                            eq(warehousePosSale.status, "completed"),
                            inArray(warehousePosSale.customerId, customerIds),
                        ),
                    )
                    .groupBy(warehousePosSale.customerId)
                : [];
            const outstandingByCustomer = new Map(
                dueRows.map((row) => [row.customerId, toNumber(row.outstanding)]),
            );

            return {
                customers: customers.map((customer) => ({
                    ...customer,
                    outstanding: outstandingByCustomer.get(customer.id) ?? 0,
                })),
            };
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
                customerId: z.number().int().optional(),
                checkoutRequestId: z.string().trim().min(8).max(80),
                discount: z.number().nonnegative().optional(),
                note: z.string().optional(),
                terms: z.string().max(3000).optional(),
                deliveryMethod: z.string().trim().min(1).max(80),
                paymentStatus: z.enum(["paid", "partial", "due"]),
                saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                payments: z.array(z.object({
                    paymentAccountId: z.number().int().positive(),
                    receivedAmount: z.number().nonnegative(),
                })).min(1).max(8),
                heldCartId: z.number().int().optional(),
                items: z.array(cartItemInputSchema).min(1),
            }),
        )
        .handler(async ({ context, input }) => {
            const warehouseId = context.session.user.id;
            const existingSale = await db.query.warehousePosSale.findFirst({
                where: and(
                    eq(warehousePosSale.warehouseId, warehouseId),
                    eq(warehousePosSale.checkoutRequestId, input.checkoutRequestId),
                ),
            });
            if (existingSale) {
                return {
                    saleId: existingSale.id,
                    invoiceNo: existingSale.invoiceNo,
                    duplicate: true,
                    totals: {
                        subtotal: existingSale.subtotal,
                        discount: existingSale.discount,
                        tax: existingSale.tax,
                        total: existingSale.total,
                        paid: existingSale.paid,
                        due: existingSale.due,
                        received: existingSale.tenderedAmount ?? existingSale.paid,
                        change: existingSale.changeAmount,
                    },
                };
            }

            const discount = input.discount ?? 0;
            const { lines, subtotal } = await resolveSaleLines(warehouseId, input.items);
            if (discount > subtotal) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "Discount cannot exceed subtotal",
                });
            }
            const total = Math.max(0, subtotal - discount);

            const accountIds = input.payments.map((payment) => payment.paymentAccountId);
            const paymentAccounts = await db.query.financePaymentAccount.findMany({
                where: and(
                    eq(financePaymentAccount.ownerId, warehouseId),
                    eq(financePaymentAccount.ownerType, "warehouse"),
                    eq(financePaymentAccount.isActive, true),
                    inArray(financePaymentAccount.id, accountIds),
                ),
            });
            const accountById = new Map(paymentAccounts.map((account) => [account.id, account]));
            if (accountById.size !== new Set(accountIds).size) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "Select active payment accounts owned by this warehouse",
                });
            }

            let splitPayment;
            try {
                splitPayment = calculatePosSplitPayments({
                    payableTotal: total,
                    payments: input.payments.map((payment) => {
                        const account = accountById.get(payment.paymentAccountId);
                        if (!account || (account.type !== "cash" && account.type !== "bank")) {
                            throw new Error("Select a valid cash or bank account");
                        }
                        return {
                            accountId: account.id,
                            accountType: account.type,
                            receivedAmount: payment.receivedAmount,
                        };
                    }),
                });
            } catch (error) {
                throw new ORPCError("BAD_REQUEST", {
                    message: error instanceof Error ? error.message : "Invalid split payments",
                });
            }
            if (splitPayment.paymentStatus !== input.paymentStatus) {
                throw new ORPCError("BAD_REQUEST", {
                    message: `Payment status must be ${splitPayment.paymentStatus}`,
                });
            }

            let customerId: number | null = input.customerId ?? null;
            let customerName = "";
            let customerPhone: string | null = null;
            let customerAddress: string | null = null;

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

            try {
                validatePosDueCustomer(
                    { name: customerName, phone: customerPhone },
                    {
                        subtotal,
                        discount,
                        taxableAmount: total,
                        tax: 0,
                        total,
                        paid: splitPayment.appliedTotal,
                        due: splitPayment.due,
                        change: splitPayment.change,
                    },
                );
            } catch (error) {
                throw new ORPCError("BAD_REQUEST", {
                    message: error instanceof Error ? error.message : "Invalid Due customer",
                });
            }

            const invoiceNo = await generateInvoiceNo();

            const result = await db.transaction(async (tx) => {
                await tx.execute(
                    sql`SELECT pg_advisory_xact_lock(hashtext(${input.checkoutRequestId}))`,
                );
                const concurrentDuplicate = await tx.query.warehousePosSale.findFirst({
                    where: and(
                        eq(warehousePosSale.warehouseId, warehouseId),
                        eq(warehousePosSale.checkoutRequestId, input.checkoutRequestId),
                    ),
                });
                if (concurrentDuplicate) {
                    return { sale: concurrentDuplicate, duplicate: true };
                }

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
                        saleType: "wholesale",
                        invoiceNo,
                        checkoutRequestId: input.checkoutRequestId,
                        customerId,
                        customerName,
                        customerPhone,
                        customerAddress,
                        subtotal: toMoney(subtotal),
                        discount: toMoney(discount),
                        discountMode: "fixed",
                        discountValue: toMoney(discount),
                        tax: "0.00",
                        total: toMoney(total),
                        paid: toMoney(splitPayment.appliedTotal),
                        due: toMoney(splitPayment.due),
                        tenderedAmount: toMoney(splitPayment.receivedTotal),
                        changeAmount: toMoney(splitPayment.change),
                        paymentMethod: splitPayment.appliedTotal > 0
                            ? accountById.get(splitPayment.rows.find((row) => row.appliedAmount > 0)?.accountId ?? accountIds[0]!)?.type === "cash"
                                ? "cash"
                                : "bank"
                            : "due",
                        paymentStatus: splitPayment.paymentStatus,
                        deliveryMethod: input.deliveryMethod,
                        responsiblePersonId: warehouseId,
                        responsiblePersonName: context.session.user.name,
                        saleDate: input.saleDate,
                        terms: input.terms?.trim() || null,
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

                for (const payment of splitPayment.rows) {
                    const account = accountById.get(payment.accountId)!;
                    await tx.insert(warehousePosPayment).values({
                        saleId: sale.id,
                        paymentAccountId: account.id,
                        paymentMethod: account.type === "cash" ? "cash" : "bank",
                        amount: toMoney(payment.appliedAmount),
                        tenderedAmount: toMoney(payment.receivedAmount),
                        createdById: warehouseId,
                    });
                }

                await postWarehousePosSaleAccounting(tx, {
                    actorId: warehouseId,
                    due: splitPayment.due,
                    invoiceNo: sale.invoiceNo,
                    ownerId: warehouseId,
                    payments: splitPayment.rows.map((payment) => ({
                        appliedAmount: payment.appliedAmount,
                        paymentAccountId: payment.accountId,
                    })),
                    saleDate: input.saleDate,
                    saleId: sale.id,
                    total,
                });

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

                return { sale, duplicate: false };
            });

            return {
                saleId: result.sale.id,
                invoiceNo: result.sale.invoiceNo,
                duplicate: result.duplicate,
                totals: result.duplicate
                    ? {
                        subtotal: result.sale.subtotal,
                        discount: result.sale.discount,
                        tax: result.sale.tax,
                        total: result.sale.total,
                        paid: result.sale.paid,
                        due: result.sale.due,
                        received: result.sale.tenderedAmount ?? result.sale.paid,
                        change: result.sale.changeAmount,
                    }
                    : {
                        subtotal: toMoney(subtotal),
                        discount: toMoney(discount),
                        tax: "0.00",
                        total: toMoney(total),
                        paid: toMoney(splitPayment.appliedTotal),
                        due: toMoney(splitPayment.due),
                        received: toMoney(splitPayment.receivedTotal),
                        change: toMoney(splitPayment.change),
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
                            sku: true,
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
                            id: true,
                            amount: true,
                            tenderedAmount: true,
                            paymentAccountId: true,
                            paymentMethod: true,
                            paidAt: true,
                        },
                        with: {
                            paymentAccount: {
                                columns: { id: true, name: true, type: true },
                            },
                        },
                        orderBy: [warehousePosPayment.id],
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
                    paymentStatus: sale.paymentStatus,
                    deliveryMethod: sale.deliveryMethod,
                    responsiblePersonName: sale.responsiblePersonName,
                    saleDate: sale.saleDate,
                    subtotal: sale.subtotal,
                    discount: sale.discount,
                    tax: sale.tax,
                    total: sale.total,
                    paid: sale.paid,
                    due: sale.due,
                    tenderedAmount: sale.tenderedAmount,
                    changeAmount: sale.changeAmount,
                    createdAt: sale.createdAt,
                    note: sale.note,
                    terms: sale.terms,
                },
                store: {
                    code: warehouseId,
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
                payments: sale.payments,
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
