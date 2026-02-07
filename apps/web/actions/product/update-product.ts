"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { updatePendingOrdersForProduct } from "@/actions/order/update-pending-orders-for-product";
import { checkAuth } from "@/utils/auth";
import { db } from "@/db/config";
import { product, productImage } from "@/db/schema/product";
import {
  type UpdateProductFormValues,
  updateProductSchema,
} from "@/schema/product.schema";

export type ActionResult<TData = unknown> =
  | {
      success: true;
      status: number;
      data: TData;
      message?: string;
    }
  | {
      success: false;
      status: number;
      error: string;
      details?: unknown;
    };

export default async function updateProduct(
  formData: UpdateProductFormValues,
): Promise<ActionResult<UpdateProductFormValues>> {
  const session = await checkAuth();

  if (!session?.user || session?.user.role !== "admin") {
    return {
      success: false,
      status: 401,
      error: "Unauthorized",
    };
  }

  try {
    const result = updateProductSchema.safeParse(formData);

    if (!result.success) {
      return {
        success: false,
        status: 400,
        error: "Validation failed",
        details: z.treeifyError(result.error),
      };
    }

    const validData = result.data;
    const { id, additionalImages, ...updateData } = validData;

    // Get current product price before update
    const [currentProduct] = await db
      .select({ price: product.price })
      .from(product)
      .where(eq(product.id, id));

    const oldPrice = currentProduct?.price;

    const updatedProduct = await db
      .update(product)
      .set({
        ...updateData,
        price: updateData.price,
        subCategoryId: updateData.subCategoryId || null,
        brandId: updateData.brandId || null,
        sku: (updateData.sku ?? "").toString().trim() || null,
        supplier: (updateData.supplier ?? "").toString().trim() || null,
        reorderLevel: updateData.reorderLevel ?? 0,
      })
      .where(eq(product.id, id))
      .returning();

    if (!updatedProduct.length) {
      return {
        success: false,
        status: 404,
        error: "Product not found",
      };
    }

    // Update additional images: delete existing and insert new ones
    if (additionalImages !== undefined) {
      // Delete existing additional images
      await db.delete(productImage).where(eq(productImage.productId, id));

      // Insert new additional images if provided
      if (additionalImages.length > 0) {
        await db.insert(productImage).values(
          additionalImages.map((imageUrl) => ({
            productId: id,
            imageUrl: imageUrl,
          })),
        );
      }
    }

    // Update pending orders if price changed
    if (
      oldPrice &&
      updateData.price &&
      oldPrice !== updateData.price.toString()
    ) {
      await updatePendingOrdersForProduct(id, updateData.price.toString());
    }

    revalidatePath("/products");
    revalidatePath("/");
    revalidatePath("/dashboard/admin/stock");
    revalidatePath("/dashboard/admin/products");

    return {
      success: true,
      status: 200,
      data: {
        ...updatedProduct[0],
        additionalImages,
        description: updatedProduct[0].description ?? undefined,
        subCategoryId: updatedProduct[0].subCategoryId ?? undefined,
        brandId: updatedProduct[0].brandId ?? undefined,
        features: updatedProduct[0].features ?? [],
        sku: updatedProduct[0].sku ?? undefined,
        supplier: updatedProduct[0].supplier ?? undefined,
      },
      message: "Product updated successfully",
    };
  } catch (error) {
    console.error("Error updating product:", error);

    return {
      success: false,
      status: 500,
      error: "An unexpected error occurred",
    };
  }
}
