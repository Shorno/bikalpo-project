import { db } from "@bikalpo-project/db";
import { toletAlertNotification, toletProperty, toletRentalAlert, toletUnit, toletUnitListing } from "@bikalpo-project/db/schema";
import { and, eq, gte, ne, or, sql } from "drizzle-orm";
import { alertLocationTerms } from "../routers/helpers/tolet-alert-matching";
import { toLetListingCutoff } from "../routers/helpers/tolet-marketplace-visibility";

/** Reconcile matching public listings on inbox refresh; works even after time offline.
 * Existing available matches are included when saving a search. Paused searches
 * stop discovery, but previously received notifications and read states persist.
 */
export async function syncToLetAlertNotifications(userId: string, database: Pick<typeof db, "select" | "execute"> = db) {
  const alerts = await database.select().from(toletRentalAlert).where(and(
    eq(toletRentalAlert.userId, userId), eq(toletRentalAlert.status, "active"),
  ));
  if (!alerts.length) return;
  const location = sql`lower(CASE WHEN ${toletUnit.addressOverride} IS NULL
    THEN concat_ws(' ', ${toletProperty.area}, ${toletProperty.upazila}, ${toletProperty.district}, ${toletProperty.division}, ${toletProperty.fullAddress})
    ELSE concat_ws(' ', ${toletUnit.addressOverride}->>'area', ${toletUnit.addressOverride}->>'upazila', ${toletUnit.addressOverride}->>'district', ${toletUnit.addressOverride}->>'division', ${toletUnit.addressOverride}->>'fullAddress') END)`;
  const matching = or(...alerts.map(alert => and(
    alert.preferredCategory === "any" ? undefined : eq(toletUnit.unitType, alert.preferredCategory),
    gte(toletUnit.sizeSqFt, alert.minimumSizeSqFt),
    ...alertLocationTerms(alert.preferredLocation).map(term => sql`position(${term} in ${location}) > 0`),
  )));
  // One atomic insert-select avoids races and scanning/materializing every listing.
  await database.execute(sql`
    INSERT INTO "tolet_alert_notification" ("id", "user_id", "listing_id")
    SELECT gen_random_uuid()::text, ${userId}, ${toletUnitListing.id}
    FROM ${toletUnitListing}
    INNER JOIN ${toletUnit} ON ${toletUnitListing.unitId} = ${toletUnit.id}
    INNER JOIN ${toletProperty} ON ${toletUnit.propertyId} = ${toletProperty.id}
    WHERE ${and(
      matching,
      eq(toletUnitListing.status, "active"), eq(toletUnitListing.visibility, "public"),
      eq(toletUnit.status, "vacant"), eq(toletProperty.status, "active"),
      ne(toletProperty.ownerUserId, userId),
      sql`coalesce(${toletUnitListing.publishedAt}, ${toletUnitListing.createdAt}) > ${toLetListingCutoff()}`,
    )}
    ON CONFLICT ("user_id", "listing_id") DO NOTHING
  `);
}
