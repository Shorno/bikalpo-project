import { relations } from "drizzle-orm";
import {
    boolean,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    serial,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { productType } from "./product-type";
import { category } from "./category";

// === Variant Option Enums ===

/** Variant option type: pack (e.g. 1KG Pack, 5L Jar) or loose (e.g. per KG) */
export const variantOptionTypeEnum = pgEnum("variant_option_type", [
    "pack",
    "loose",
]);

// === Global Variant Option ===

/**
 * A reusable, admin-managed variant option in the global catalog.
 *
 * Scoping:
 *   - typeId=null, categoryId=null → Global (available to ALL core products)
 *   - typeId=set, categoryId=null → Type-wide (e.g. all Grocery core products)
 *   - typeId=set, categoryId=set → Category-specific (e.g. only Oil core products)
 *
 * Examples: "1KG Pack", "5L Jar", "Size M", "Loose", "Carton Pack"
 */
export const variantOption = pgTable("variant_option", {
    id: serial("id").primaryKey(),

    /** Display name (e.g. "1KG Pack", "250ML Bottle", "Size M") */
    name: varchar("name", { length: 100 }).notNull(),

    /** Unit of measurement (e.g. "KG", "ML", "L", "Pc", "Size", "Box", "Carton", "Ton", "Pair", "Unit") */
    unit: varchar("unit", { length: 20 }).notNull(),

    /** Size/value within the unit (e.g. "1", "5", "S", "XL", "38"). Null for loose/generic. */
    size: varchar("size", { length: 20 }),

    /** Whether this is a pack variant or loose variant */
    variantType: variantOptionTypeEnum("variant_type").default("pack").notNull(),

    /** Structured source of truth. Legacy rows may remain null during migration. */
    definitionKind: varchar("definition_kind", { length: 20 }),
    definition: jsonb("definition").$type<Record<string, unknown>>(),
    displayAlias: varchar("display_alias", { length: 100 }),
    canonicalSignature: varchar("canonical_signature", { length: 255 }),
    needsReview: boolean("needs_review").default(false).notNull(),

    /** Scoping: Product Type FK. Null means "Global" (available to all types). */
    typeId: integer("type_id").references(() => productType.id, {
        onDelete: "restrict",
    }),

    /** Scoping: Category FK. Null when typeId is null (Global) or type-wide. */
    categoryId: integer("category_id").references(() => category.id, {
        onDelete: "restrict",
    }),

    /** Auto-generated 2-digit SKU code within scope (e.g. "01", "02"). Immutable after creation. */
    skuCode: varchar("sku_code", { length: 2 }),

    /** Whether this variant option is active */
    isActive: boolean("is_active").default(true).notNull(),

    /** Sort order for display */
    sortOrder: integer("sort_order").default(0).notNull(),

    ...timestamps,
});

// === Relations ===

export const variantOptionRelations = relations(variantOption, ({ one }) => ({
    type: one(productType, {
        fields: [variantOption.typeId],
        references: [productType.id],
    }),
    category: one(category, {
        fields: [variantOption.categoryId],
        references: [category.id],
    }),
}));

// === Types ===

export type VariantOption = typeof variantOption.$inferSelect;
export type NewVariantOption = typeof variantOption.$inferInsert;
