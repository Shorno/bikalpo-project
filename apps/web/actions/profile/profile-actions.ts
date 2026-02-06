"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkAuth } from "@/app/(dashboard)/dashboard/admin/_actions/auth/checkAuth";
import { db } from "@/db/config";
import { user, userProfile } from "@/db/schema";

const profileSchema = z.object({
  businessName: z.string().min(1, "Business name is required").max(100),
  ownerName: z.string().min(1, "Owner name is required").max(100),
  phoneNumber: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  facebook: z
    .string()
    .url("Invalid Facebook URL")
    .optional()
    .nullable()
    .or(z.literal("")),
  whatsapp: z.string().optional().nullable(),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

export async function updateProfile(data: ProfileFormData) {
  try {
    const session = await checkAuth();

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const validated = profileSchema.parse(data);

    // Check if profile exists
    const [existingProfile] = await db
      .select({ id: userProfile.id })
      .from(userProfile)
      .where(eq(userProfile.userId, session.user.id))
      .limit(1);

    if (existingProfile) {
      // Update existing profile
      await db
        .update(userProfile)
        .set({
          businessName: validated.businessName,
          ownerName: validated.ownerName,
          phoneNumber: validated.phoneNumber || null,
          vatNumber: validated.vatNumber || null,
          address: validated.address || null,
          facebook: validated.facebook || null,
          whatsapp: validated.whatsapp || null,
        })
        .where(eq(userProfile.userId, session.user.id));
    } else {
      // Create new profile
      await db.insert(userProfile).values({
        userId: session.user.id,
        businessName: validated.businessName,
        ownerName: validated.ownerName,
        phoneNumber: validated.phoneNumber || null,
        vatNumber: validated.vatNumber || null,
        address: validated.address || null,
        facebook: validated.facebook || null,
        whatsapp: validated.whatsapp || null,
      });
    }

    revalidatePath("/account/profile");
    revalidatePath("/account");

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
    console.error("Error updating profile:", error);
    return { success: false, error: "Failed to update profile" };
  }
}

export async function getProfile() {
  try {
    const session = await checkAuth();

    if (!session?.user?.id) {
      return null;
    }

    // Get user data
    const [userData] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
      })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (!userData) return null;

    // Get profile data
    const [profileData] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, session.user.id))
      .limit(1);

    return {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      businessName: profileData?.businessName || null,
      ownerName: profileData?.ownerName || userData.name || null,
      phoneNumber: profileData?.phoneNumber || userData.phoneNumber || null,
      vatNumber: profileData?.vatNumber || null,
      address: profileData?.address || null,
      facebook: profileData?.facebook || null,
      // Use user's phone number as default for whatsapp if not set
      whatsapp: profileData?.whatsapp || userData.phoneNumber || null,
    };
  } catch (error) {
    console.error("Error fetching profile:", error);
    return null;
  }
}
