"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db/config";
import {
  estimate,
  estimateItem,
  type NewEstimateItem,
} from "@/db/schema/estimate";
import { auth } from "@/lib/auth";
import {
  type UpdateEstimateFormValues,
  updateEstimateSchema,
} from "@/schema/estimate.schema";

export async function updateEstimate(data: UpdateEstimateFormValues) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = updateEstimateSchema.safeParse(data);
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0]?.message || "Invalid input",
      };
    }

    const { id, customerId, items, discount, validUntil, notes, status } =
      validatedData.data;

    // Get existing estimate
    const existingEstimate = await db.query.estimate.findFirst({
      where: eq(estimate.id, id),
      with: { items: true },
    });

    if (!existingEstimate) {
      return { success: false, error: "Estimate not found" };
    }

    // Check permissions - only creator (salesman) or admin can update
    const isCreator = existingEstimate.salesmanId === session.user.id;
    const isAdmin = session.user.role === "admin";

    if (!isCreator && !isAdmin) {
      return {
        success: false,
        error: "Not authorized to update this estimate",
      };
    }

    // Cannot update converted estimates
    if (existingEstimate.status === "converted") {
      return { success: false, error: "Cannot update converted estimates" };
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (customerId) updateData.customerId = customerId;
    if (validUntil !== undefined) updateData.validUntil = validUntil;
    if (notes !== undefined) updateData.notes = notes;
    if (status) {
      updateData.status = status;

      // Set timestamps based on status
      if (status === "sent" && existingEstimate.status !== "sent") {
        updateData.sentAt = new Date();
      }
    }

    // Update with new items if provided
    if (items && items.length > 0) {
      // Recalculate totals
      const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
      const finalDiscount = discount ?? Number(existingEstimate.discount);
      const total = subtotal - finalDiscount;

      updateData.subtotal = subtotal.toString();
      updateData.discount = finalDiscount.toString();
      updateData.total = total.toString();

      await db.transaction(async (tx) => {
        // Update estimate
        await tx.update(estimate).set(updateData).where(eq(estimate.id, id));

        // Delete old items
        await tx.delete(estimateItem).where(eq(estimateItem.estimateId, id));

        // Insert new items
        const itemsToInsert: NewEstimateItem[] = items.map((item) => ({
          estimateId: id,
          productId: item.productId,
          productName: item.productName,
          productImage: item.productImage || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
          discount: (item.discount || 0).toString(),
          totalPrice: item.totalPrice.toString(),
        }));

        await tx.insert(estimateItem).values(itemsToInsert);
      });
    } else if (discount !== undefined) {
      // Only update discount
      const subtotal = Number(existingEstimate.subtotal);
      const total = subtotal - discount;
      updateData.discount = discount.toString();
      updateData.total = total.toString();

      await db.update(estimate).set(updateData).where(eq(estimate.id, id));
    } else if (Object.keys(updateData).length > 0) {
      // Update only metadata
      await db.update(estimate).set(updateData).where(eq(estimate.id, id));
    }

    revalidatePath("/employee/estimates");
    revalidatePath(`/employee/estimates/${id}`);
    revalidatePath("/dashboard/admin/estimates");

    return { success: true };
  } catch (error) {
    console.error("Error updating estimate:", error);
    return { success: false, error: "Failed to update estimate" };
  }
}

export async function sendEstimate(estimateId: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const existingEstimate = await db.query.estimate.findFirst({
      where: eq(estimate.id, estimateId),
    });

    if (!existingEstimate) {
      return { success: false, error: "Estimate not found" };
    }

    if (
      existingEstimate.salesmanId !== session.user.id &&
      session.user.role !== "admin"
    ) {
      return { success: false, error: "Not authorized" };
    }

    if (existingEstimate.status !== "draft") {
      return { success: false, error: "Only draft estimates can be sent" };
    }

    const discount = Number((existingEstimate as any).discount || 0);
    const hasDiscount = discount > 0;

    const newStatus = hasDiscount ? "pending" : "sent";

    const updateData: Record<string, unknown> = {
      status: newStatus,
    };

    if (newStatus === "sent") {
      updateData.sentAt = new Date();
    }

    await db
      .update(estimate)
      .set(updateData)
      .where(eq(estimate.id, estimateId));

    revalidatePath("/employee/estimates");
    revalidatePath("/dashboard/admin/estimates");

    return { success: true };
  } catch (error) {
    console.error("Error sending estimate:", error);
    return { success: false, error: "Failed to send estimate" };
  }
}

export async function deleteEstimate(estimateId: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const existingEstimate = await db.query.estimate.findFirst({
      where: eq(estimate.id, estimateId),
    });

    if (!existingEstimate) {
      return { success: false, error: "Estimate not found" };
    }

    // Only creator or admin can delete
    if (
      existingEstimate.salesmanId !== session.user.id &&
      session.user.role !== "admin"
    ) {
      return { success: false, error: "Not authorized" };
    }

    // Cannot delete converted estimates
    if (existingEstimate.status === "converted") {
      return { success: false, error: "Cannot delete converted estimates" };
    }

    await db.delete(estimate).where(eq(estimate.id, estimateId));

    revalidatePath("/employee/estimates");
    revalidatePath("/dashboard/admin/estimates");

    return { success: true };
  } catch (error) {
    console.error("Error deleting estimate:", error);
    return { success: false, error: "Failed to delete estimate" };
  }
}
