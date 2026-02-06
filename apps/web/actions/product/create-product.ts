"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkAuth } from "@/app/(dashboard)/dashboard/admin/_actions/auth/checkAuth";
import { db } from "@/db/config";
import { product, productImage } from "@/db/schema/product";
import {
  type CreateProductFormValues,
  createProductSchema,
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

export default async function createProduct(
  formData: CreateProductFormValues,
): Promise<ActionResult<CreateProductFormValues>> {
  const session = await checkAuth();

  if (!session?.user || session?.user.role !== "admin") {
    return {
      success: false,
      status: 401,
      error: "Unauthorized",
    };
  }

  try {
    const result = createProductSchema.safeParse(formData);

    if (!result.success) {
      return {
        success: false,
        status: 400,
        error: "Validation failed",
        details: z.treeifyError(result.error),
      };
    }

    const validData = result.data;
    const { additionalImages, ...productData } = validData;

    const newProduct = await db
      .insert(product)
      .values({
        ...productData,
        price: productData.price,
        subCategoryId: productData.subCategoryId || null,
        brandId: productData.brandId || null,
        sku: (productData.sku ?? "").toString().trim() || null,
        supplier: (productData.supplier ?? "").toString().trim() || null,
        reorderLevel: productData.reorderLevel ?? 0,
      })
      .returning();

    // Insert additional images if provided
    if (additionalImages && additionalImages.length > 0) {
      await db.insert(productImage).values(
        additionalImages.map((imageUrl) => ({
          productId: newProduct[0].id,
          imageUrl: imageUrl,
        })),
      );
    }

    revalidatePath("/products");
    revalidatePath("/");
    revalidatePath("/dashboard/admin/stock");
    revalidatePath("/dashboard/admin/products");

    return {
      success: true,
      status: 201,
      data: {
        ...newProduct[0],
        additionalImages,
        description: newProduct[0].description ?? undefined,
        subCategoryId: newProduct[0].subCategoryId ?? undefined,
        brandId: newProduct[0].brandId ?? undefined,
        features: newProduct[0].features ?? [],
        sku: newProduct[0].sku ?? undefined,
        supplier: newProduct[0].supplier ?? undefined,
      },
      message: "Product created successfully",
    };
  } catch (error) {
    console.error("Error creating product:", error);

    return {
      success: false,
      status: 500,
      error: "An unexpected error occurred",
    };
  }
}
