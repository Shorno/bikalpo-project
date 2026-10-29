import { sellerApplication } from "@bikalpo-project/db/schema";
import { inArray, sql } from "drizzle-orm";

export type ShopCardProfile = {
  userId: string;
  area: string | null;
  district: string | null;
  division: string | null;
  nature: string | null;
  category: string | null;
  images: string[];
};

/** Public card fields from the latest approved registration, never identity documents. */
export function shopCardProfilesQuery(shopIds: string[]) {
  return sql`
    select distinct on (${sellerApplication.userId})
      ${sellerApplication.userId} as "userId",
      ${sellerApplication.area} as area,
      ${sellerApplication.district} as district,
      ${sellerApplication.division} as division,
      ${sellerApplication.businessNature} as nature,
      ${sellerApplication.businessCategory} as category,
      array_remove(array[
        nullif(${sellerApplication.documentUrls}->>'storeFront', ''),
        nullif(${sellerApplication.documentUrls}->>'shopPhoto', ''),
        nullif(${sellerApplication.documentUrls}->>'warehouse', '')
      ], null) as images
    from ${sellerApplication}
    where ${inArray(sellerApplication.userId, shopIds)}
      and ${sellerApplication.status} = 'approved'
    order by ${sellerApplication.userId},
      ${sellerApplication.updatedAt} desc, ${sellerApplication.id} desc
  `;
}
