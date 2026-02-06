"use server";

import { eq, like, or } from "drizzle-orm";
import { db } from "@/db/config";
import { user } from "@/db/schema/auth-schema";

export async function getCustomers(query?: string) {
  try {
    const filters = [eq(user.role, "customer")];

    if (query) {
      filters.push(
        or(
          like(user.name, `%${query}%`),
          like(user.email, `%${query}%`),
          like(user.phoneNumber, `%${query}%`),
        ) as any,
      );
    }

    const data = await db.query.user.findMany({
      where: (_fields, { and }) => and(...filters),
      columns: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        shopName: true,
      },
      limit: 20,
    });

    return { success: true, data };
  } catch (error) {
    console.error("Error fetching customers:", error);
    return { success: false, error: "Failed to fetch customers", data: [] };
  }
}
