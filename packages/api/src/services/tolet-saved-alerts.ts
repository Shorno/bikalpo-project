import { toletRentalAlert } from "@bikalpo-project/db/schema";
import type { db } from "@bikalpo-project/db";
import { ORPCError } from "@orpc/server";
import { and, count, eq, inArray, sql } from "drizzle-orm";

type AlertInput = Pick<typeof toletRentalAlert.$inferInsert,
  "preferredCategory" | "preferredLocation" | "minimumSizeSqFt" | "minimumBedrooms" |
  "minimumBathrooms" | "minimumBalconies" | "balconyPreference" | "preferredFloor">;
type AlertTransaction = Pick<typeof db, "execute" | "select" | "update" | "insert">;

// Call only inside a READ COMMITTED transaction. Every alert-creation path uses
// this per-consumer transaction lock before checking duplicates or the quota.
export async function saveToLetAlert(tx: AlertTransaction, userId: string, input: AlertInput, sourceContractId?: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'tolet-alerts:' + userId}, 0))`);
  const [existing] = await tx.select().from(toletRentalAlert).where(and(
    eq(toletRentalAlert.userId, userId), inArray(toletRentalAlert.status, ["active", "paused"]),
    eq(toletRentalAlert.preferredCategory, input.preferredCategory),
    eq(toletRentalAlert.preferredLocation, input.preferredLocation),
    eq(toletRentalAlert.minimumSizeSqFt, input.minimumSizeSqFt ?? 0),
    eq(toletRentalAlert.minimumBedrooms, input.minimumBedrooms ?? 0),
    eq(toletRentalAlert.minimumBathrooms, input.minimumBathrooms ?? 0),
    eq(toletRentalAlert.minimumBalconies, input.minimumBalconies ?? 0),
    eq(toletRentalAlert.balconyPreference, input.balconyPreference ?? "optional"),
    eq(toletRentalAlert.preferredFloor, input.preferredFloor ?? "any"),
  )).limit(1);
  if (existing) {
    if (existing.status === "paused") {
      const [resumed] = await tx.update(toletRentalAlert).set({ status: "active", updatedAt: new Date() })
        .where(and(eq(toletRentalAlert.id, existing.id), eq(toletRentalAlert.userId, userId))).returning();
      if (!resumed) throw new ORPCError("CONFLICT", { message: "The saved alert changed. Please try again." });
      return resumed;
    }
    return existing;
  }
  const [total] = await tx.select({ value: count() }).from(toletRentalAlert).where(eq(toletRentalAlert.userId, userId));
  if ((total?.value ?? 0) >= 50) throw new ORPCError("BAD_REQUEST", { message: "You can keep up to 50 saved To-Let alerts" });
  const [saved] = await tx.insert(toletRentalAlert).values({ ...input, userId, sourceContractId }).returning();
  if (!saved) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Unable to save the To-Let alert" });
  return saved;
}
