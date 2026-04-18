/**
 * Backfill Script: Move brandId from variant to product level.
 *
 * For products where all variants share the same brandId → set product.brandId
 * For products where variants have DIFFERENT brands → split into separate products
 *
 * Run with: npx tsx packages/db/src/backfill-brand-to-product.ts
 */

import { db } from "./index";
import { product, productVariant } from "./schema";
import { eq, sql, and, inArray } from "drizzle-orm";

async function main() {
    console.log("=== Backfill: Move brandId from variant to product ===\n");

    // 1. Get all products
    const allProducts = await db.query.product.findMany({
        with: {
            variants: {
                columns: { id: true, brandId: true, unitLabel: true },
            },
        },
    });

    console.log(`Found ${allProducts.length} products to process.\n`);

    let updated = 0;
    let split = 0;
    let skipped = 0;

    for (const prod of allProducts) {
        // Get unique brand IDs from variants (excluding null)
        const variantBrandIds = [...new Set(
            prod.variants
                .map(v => v.brandId)
                .filter((id): id is number => id != null)
        )];

        if (variantBrandIds.length === 0) {
            // No variant has a brand. Product already has brandId or needs one.
            if (prod.brandId) {
                console.log(`  [SKIP] Product #${prod.id} "${prod.name}" — already has product-level brandId=${prod.brandId}`);
                skipped++;
            } else {
                console.log(`  [WARN] Product #${prod.id} "${prod.name}" — no brand on product or variants`);
                skipped++;
            }
            continue;
        }

        if (variantBrandIds.length === 1) {
            // All variants share the same brand → set on product
            const brandId = variantBrandIds[0]!;
            if (prod.brandId === brandId) {
                console.log(`  [SKIP] Product #${prod.id} "${prod.name}" — brandId already correct (${brandId})`);
                skipped++;
            } else {
                await db.update(product)
                    .set({ brandId })
                    .where(eq(product.id, prod.id));
                console.log(`  [SET]  Product #${prod.id} "${prod.name}" → brandId=${brandId}`);
                updated++;
            }
            continue;
        }

        // Multiple brands! Need to split.
        console.log(`  [SPLIT] Product #${prod.id} "${prod.name}" has ${variantBrandIds.length} brands: ${variantBrandIds.join(", ")}`);

        // Keep the first brand on the original product
        const [firstBrand, ...otherBrands] = variantBrandIds;

        // Update original product with the first brand
        await db.update(product)
            .set({ brandId: firstBrand })
            .where(eq(product.id, prod.id));

        // Move variants of other brands to new products
        for (const bId of otherBrands) {
            // Create a copy of the product with this brand
            const [newProd] = await db.insert(product).values({
                name: prod.name,
                slug: `${prod.slug}-brand-${bId}`,
                description: prod.description,
                categoryId: prod.categoryId,
                subCategoryId: prod.subCategoryId,
                brandId: bId,
                coreProductId: prod.coreProductId,
                size: prod.size,
                unitSize: prod.unitSize,
                price: prod.price,
                image: prod.image,
                inStock: prod.inStock,
                isFeatured: prod.isFeatured,
            }).returning();

            if (!newProd) continue;

            // Move variants with this brand to the new product
            const variantsToMove = prod.variants.filter(v => v.brandId === bId);
            if (variantsToMove.length > 0) {
                await db.update(productVariant)
                    .set({ productId: newProd.id })
                    .where(inArray(productVariant.id, variantsToMove.map(v => v.id)));
            }

            console.log(`    → Created product #${newProd.id} for brand ${bId} with ${variantsToMove.length} variants`);
            split++;
        }
        updated++;
    }

    console.log(`\n=== Done ===`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Split into new products: ${split}`);
    console.log(`  Skipped: ${skipped}`);

    process.exit(0);
}

main().catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
});
