"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { user } from "@/db/schema/auth-schema";
import {
  estimate,
  estimateItem,
  type NewEstimateItem,
} from "@/db/schema/estimate";
import { auth } from "@/lib/auth";
import {
  type CreateEstimateFormValues,
  createEstimateSchema,
} from "@/schema/estimate.schema";

type CreateEstimateResult =
  | { success: true; message: string; count: number }
  | { success: false; error: string; details?: string[] };

export async function createEstimate(
  data: CreateEstimateFormValues,
): Promise<CreateEstimateResult> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized. Please log in to continue.",
      };
    }

    // Only salesman or admin can create estimates
    if (session.user.role !== "salesman" && session.user.role !== "admin") {
      return {
        success: false,
        error:
          "Permission denied. Only salesmen and admins can create estimates.",
      };
    }

    // Validate input with detailed error messages
    const validatedData = createEstimateSchema.safeParse(data);
    if (!validatedData.success) {
      const details = validatedData.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      );
      return {
        success: false,
        error: "Validation failed",
        details,
      };
    }

    const { customerIds, items, discount, validUntil, notes } =
      validatedData.data;

    // Generate estimate number: EST-YYYYMMDD-XXXX
    const generateEstimateNumber = () => {
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const random = Math.random().toString(36).slice(2, 6).toUpperCase();
      return `EST-${date}-${random}`;
    };

    let createdCount = 0;

    await db.transaction(async (tx) => {
      for (const customerId of customerIds) {
        // Verify customer exists
        const customer = await tx.query.user.findFirst({
          where: eq(user.id, customerId),
        });

        if (!customer) {
          continue;
        }

        const estimateNumber = generateEstimateNumber();

        // Calculate totals
        const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
        const total = subtotal - discount;

        // Check if any price modifications require admin approval
        // (either overall discount or per-item discounts)
        const hasItemDiscounts = items.some((item) => (item.discount ?? 0) > 0);
        const needsApproval = discount > 0 || hasItemDiscounts;

        // If no discount, automatically approve so customer sees it
        // If has discount, set to pending for admin approval
        const status = needsApproval ? "pending" : "approved";

        // Create estimate
        const [newEstimate] = await tx
          .insert(estimate)
          .values({
            estimateNumber,
            customerId,
            salesmanId: session.user.id,
            subtotal: subtotal.toString(),
            discount: discount.toString(),
            total: total.toString(),
            status,
            validUntil: validUntil
              ? validUntil.toISOString().split("T")[0]
              : null,
            notes: notes || null,
            approvedAt: status === "approved" ? new Date() : null,
          })
          .returning();

        // Insert items
        const itemsToInsert: NewEstimateItem[] = items.map((item) => ({
          estimateId: newEstimate.id,
          productId: item.productId,
          productName: item.productName,
          productImage: item.productImage || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
          discount: (item.discount || 0).toString(),
          totalPrice: item.totalPrice.toString(),
        }));

        await tx.insert(estimateItem).values(itemsToInsert);
        createdCount++;
      }
    });

    // Handle case where no estimates were created
    if (createdCount === 0) {
      return {
        success: false,
        error: "No estimates created. All specified customers were not found.",
      };
    }

    revalidatePath("/employee/estimates");
    revalidatePath("/dashboard/sales/estimates");
    revalidatePath("/dashboard/admin/estimates");

    // Build success message
    const message =
      createdCount === 1
        ? `Estimate created successfully`
        : `${createdCount} estimates created successfully`;

    return {
      success: true,
      message,
      count: createdCount,
    };
  } catch (error) {
    console.error("Error creating estimate:", error);
    return {
      success: false,
      error:
        "An unexpected error occurred while creating the estimate. Please try again.",
    };
  }
}
