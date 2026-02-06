"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db/config";
import { address } from "@/db/schema/address";
import { auth } from "@/lib/auth";

const addressSchema = z.object({
  label: z.string().min(1, "Label is required"),
  recipientName: z.string().min(2, "Recipient name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  area: z.string().optional(),
  postalCode: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export type AddressFormData = z.infer<typeof addressSchema>;

export async function getMyAddresses() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated", addresses: [] };
    }

    const addresses = await db.query.address.findMany({
      where: eq(address.userId, session.user.id),
      orderBy: [desc(address.isDefault), desc(address.createdAt)],
    });

    return { success: true, addresses };
  } catch (error) {
    console.error("Error getting addresses:", error);
    return { success: false, error: "Failed to get addresses", addresses: [] };
  }
}

export async function addAddress(data: AddressFormData) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const result = addressSchema.safeParse(data);
    if (!result.success) {
      return { success: false, error: result.error.issues[0]?.message };
    }

    // If this is the first address or marked as default, unset other defaults
    if (data.isDefault) {
      await db
        .update(address)
        .set({ isDefault: false })
        .where(eq(address.userId, session.user.id));
    }

    // Check if this is the first address
    const existingAddresses = await db.query.address.findFirst({
      where: eq(address.userId, session.user.id),
    });

    const [newAddress] = await db
      .insert(address)
      .values({
        userId: session.user.id,
        label: data.label,
        recipientName: data.recipientName,
        phone: data.phone,
        address: data.address,
        city: data.city,
        area: data.area || null,
        postalCode: data.postalCode || null,
        isDefault: data.isDefault || !existingAddresses, // First address is default
      })
      .returning();

    revalidatePath("/account/addresses");
    return { success: true, address: newAddress };
  } catch (error) {
    console.error("Error adding address:", error);
    return { success: false, error: "Failed to add address" };
  }
}

export async function updateAddress(id: number, data: AddressFormData) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const result = addressSchema.safeParse(data);
    if (!result.success) {
      return { success: false, error: result.error.issues[0]?.message };
    }

    // Verify ownership
    const existing = await db.query.address.findFirst({
      where: and(eq(address.id, id), eq(address.userId, session.user.id)),
    });

    if (!existing) {
      return { success: false, error: "Address not found" };
    }

    // If marked as default, unset other defaults
    if (data.isDefault) {
      await db
        .update(address)
        .set({ isDefault: false })
        .where(eq(address.userId, session.user.id));
    }

    const [updated] = await db
      .update(address)
      .set({
        label: data.label,
        recipientName: data.recipientName,
        phone: data.phone,
        address: data.address,
        city: data.city,
        area: data.area || null,
        postalCode: data.postalCode || null,
        isDefault: data.isDefault ?? existing.isDefault,
        updatedAt: new Date(),
      })
      .where(eq(address.id, id))
      .returning();

    revalidatePath("/account/addresses");
    return { success: true, address: updated };
  } catch (error) {
    console.error("Error updating address:", error);
    return { success: false, error: "Failed to update address" };
  }
}

export async function deleteAddress(id: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify ownership
    const existing = await db.query.address.findFirst({
      where: and(eq(address.id, id), eq(address.userId, session.user.id)),
    });

    if (!existing) {
      return { success: false, error: "Address not found" };
    }

    await db.delete(address).where(eq(address.id, id));

    // If deleted address was default, set first remaining as default
    if (existing.isDefault) {
      const remaining = await db.query.address.findFirst({
        where: eq(address.userId, session.user.id),
        orderBy: [desc(address.createdAt)],
      });

      if (remaining) {
        await db
          .update(address)
          .set({ isDefault: true })
          .where(eq(address.id, remaining.id));
      }
    }

    revalidatePath("/account/addresses");
    return { success: true };
  } catch (error) {
    console.error("Error deleting address:", error);
    return { success: false, error: "Failed to delete address" };
  }
}

export async function setDefaultAddress(id: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify ownership
    const existing = await db.query.address.findFirst({
      where: and(eq(address.id, id), eq(address.userId, session.user.id)),
    });

    if (!existing) {
      return { success: false, error: "Address not found" };
    }

    // Unset all defaults
    await db
      .update(address)
      .set({ isDefault: false })
      .where(eq(address.userId, session.user.id));

    // Set this as default
    await db.update(address).set({ isDefault: true }).where(eq(address.id, id));

    revalidatePath("/account/addresses");
    return { success: true };
  } catch (error) {
    console.error("Error setting default address:", error);
    return { success: false, error: "Failed to set default address" };
  }
}
