"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { itemRequest, type NewItemRequest } from "@/db/schema/item-request";
import { auth } from "@/lib/auth";
import {
  type CreateItemRequestFormValues,
  createItemRequestSchema,
} from "@/schema/item-request.schema";

// Generate unique request number
function generateRequestNumber(): string {
  const prefix = "REQ";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export async function createItemRequest(data: CreateItemRequestFormValues) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Please login to submit a request" };
    }

    // Validate input
    const validatedData = createItemRequestSchema.safeParse(data);
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0]?.message || "Invalid input",
      };
    }

    const { itemName, brand, category, quantity, description, image } =
      validatedData.data;

    // Create the request
    const [newRequest] = await db
      .insert(itemRequest)
      .values({
        requestNumber: generateRequestNumber(),
        customerId: session.user.id,
        itemName,
        brand: brand || null,
        category: category || null,
        quantity,
        description: description || null,
        image: image || null,
        status: "pending",
      } as NewItemRequest)
      .returning();

    revalidatePath("/account/requests");
    revalidatePath("/dashboard/item-requests");

    return { success: true, request: newRequest };
  } catch (error) {
    console.error("Error creating item request:", error);
    return { success: false, error: "Failed to submit request" };
  }
}
