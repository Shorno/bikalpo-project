"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkAuth } from "@/utils/auth";
import { db } from "@/db/config";
import { brand } from "@/db/schema/brand";
import {
  type CreateBrandFormValues,
  createBrandSchema,
} from "@/schema/brand.schema";

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

export default async function createBrand(
  formData: CreateBrandFormValues,
): Promise<ActionResult<CreateBrandFormValues>> {
  const session = await checkAuth();

  if (!session?.user || session?.user.role !== "admin") {
    return {
      success: false,
      status: 401,
      error: "Unauthorized",
    };
  }

  try {
    const result = createBrandSchema.safeParse(formData);

    if (!result.success) {
      return {
        success: false,
        status: 400,
        error: "Validation failed",
        details: z.treeifyError(result.error),
      };
    }

    const validData = result.data;

    const newBrand = await db.insert(brand).values(validData).returning();

    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      status: 201,
      data: newBrand[0],
      message: "Brand created successfully",
    };
  } catch (error) {
    console.error("Error creating brand:", error);

    return {
      success: false,
      status: 500,
      error: "An unexpected error occurred",
    };
  }
}
