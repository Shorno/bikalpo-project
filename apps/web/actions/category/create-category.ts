"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkAuth } from "@/app/(dashboard)/dashboard/admin/_actions/auth/checkAuth";
import { db } from "@/db/config";
import { category } from "@/db/schema/category";
import {
  type CreateCategoryFormValues,
  createCategorySchema,
} from "@/schema/category.scheam";

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

export default async function createCategory(
  formData: CreateCategoryFormValues,
): Promise<ActionResult<CreateCategoryFormValues>> {
  const session = await checkAuth();

  if (!session?.user || session?.user.role !== "admin") {
    return {
      success: false,
      status: 401,
      error: "Unauthorized",
    };
  }

  try {
    const result = createCategorySchema.safeParse(formData);

    if (!result.success) {
      return {
        success: false,
        status: 400,
        error: "Validation failed",
        details: z.treeifyError(result.error),
      };
    }

    const validData = result.data;

    const newCategory = await db.insert(category).values(validData).returning();

    // Revalidate only client-facing routes (not admin dashboard)
    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      status: 201,
      data: newCategory[0],
      message: "Category created successfully",
    };
  } catch (error) {
    console.error("Error creating categories:", error);

    return {
      success: false,
      status: 500,
      error: "An unexpected error occurred",
    };
  }
}
