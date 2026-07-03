import { db } from "@bikalpo-project/db";
import { kycVerification } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { desc, eq } from "drizzle-orm";

export type KycStatus = "verified" | "pending" | "failed" | "unverified";

export function deriveKycStatus(
  status: string | null | undefined,
): KycStatus {
  if (!status) return "unverified";
  if (status === "verified") return "verified";
  if (status === "pending") return "pending";
  if (status === "failed") return "failed";
  return "unverified";
}

export async function getLatestKycRecord(userId: string) {
  return db.query.kycVerification.findFirst({
    where: eq(kycVerification.userId, userId),
    orderBy: [desc(kycVerification.createdAt)],
  });
}

export async function createPendingKycForUser(userId: string) {
  const [record] = await db
    .insert(kycVerification)
    .values({
      userId,
      status: "pending",
    })
    .returning();

  return record;
}

export async function ensurePendingKycForUser(userId: string) {
  const latest = await getLatestKycRecord(userId);
  if (!latest) {
    return createPendingKycForUser(userId);
  }
  return latest;
}

export async function verifyKycForUser(
  userId: string,
  { adminId, adminNotes }: { adminId: string; adminNotes?: string | null },
) {
  let latest = await getLatestKycRecord(userId);

  if (!latest) {
    latest = await createPendingKycForUser(userId);
  }

  if (latest.status === "verified") {
    throw new ORPCError("CONFLICT", {
      message: "KYC is already verified",
    });
  }

  const [updated] = await db
    .update(kycVerification)
    .set({
      status: "verified",
      adminNotes: adminNotes || null,
      reviewedBy: adminId,
      reviewedAt: new Date(),
    })
    .where(eq(kycVerification.id, latest.id))
    .returning();

  return updated;
}
