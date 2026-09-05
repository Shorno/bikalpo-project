import {
  sellerApplication,
  user,
  warehouseApplication,
} from "@bikalpo-project/db/schema";
import { sql } from "drizzle-orm";
import { canonicalBusinessLocation } from "./business-location-names";

/** One approved business registration per current seller account. Never personal location. */
export const registeredSellers = sql`
with registrations as (
  select ${user.id} as id, ${user.shopName} as name, ${user.shopSlug} as slug,
    'shop_owner' as role, ${sellerApplication.businessNature} as nature,
    ${sellerApplication.shopAddress} as address,
    ${sellerApplication.district} as district, ${sellerApplication.division} as division,
    ${sellerApplication.latitude} as latitude, ${sellerApplication.longitude} as longitude,
    row_number() over (partition by ${user.id} order by ${sellerApplication.updatedAt} desc, ${sellerApplication.id} desc) as rank
  from ${user} inner join ${sellerApplication} on ${sellerApplication.userId} = ${user.id}
  where ${user.role} = 'shop_owner' and ${user.sellerStatus} = 'approved'
    and ${user.banned} is not true and ${sellerApplication.status} = 'approved'
  union all
  select ${user.id}, ${user.warehouseName}, ${user.warehouseSlug},
    'warehouse', ${warehouseApplication.businessNature}, ${warehouseApplication.warehouseAddress},
    ${warehouseApplication.district}, ${warehouseApplication.division},
    ${warehouseApplication.latitude}, ${warehouseApplication.longitude},
    row_number() over (partition by ${user.id} order by ${warehouseApplication.updatedAt} desc, ${warehouseApplication.id} desc)
  from ${user} inner join ${warehouseApplication} on ${warehouseApplication.userId} = ${user.id}
  where ${user.role} = 'warehouse' and ${user.banned} is not true
    and ${warehouseApplication.status} = 'approved'
), normalized as (
  select id, name, slug, role, nature, address,
    regexp_replace(trim(district), '\\s+', ' ', 'g') as district,
    regexp_replace(trim(division), '\\s+', ' ', 'g') as division,
    case when latitude ~ '^[0-9]{1,2}(\\.[0-9]+)?$' then latitude::numeric end as latitude,
    case when longitude ~ '^[0-9]{1,3}(\\.[0-9]+)?$' then longitude::numeric end as longitude
  from registrations where rank = 1
), canonical as (
  select id, name, slug, role, nature, address, latitude, longitude,
    ${canonicalBusinessLocation(sql`district`)} as district,
    ${canonicalBusinessLocation(sql`division`)} as division from normalized
), located_sellers as (
  select *, lower(district) as district_key, lower(division) as division_key
  from canonical
  where district <> '' and division <> ''
    and latitude between 20.5 and 26.7 and longitude between 87.9 and 92.7
)`;

export function sellerLocationsQuery() {
  return sql`${registeredSellers}
    select district_key as "districtKey", division_key as "divisionKey",
      min(district) as district, min(division) as division, count(*)::int as count
    from located_sellers group by district_key, division_key
    order by count(*) desc, min(district), min(division)`;
}

export function sellersByLocationQuery(
  district: string,
  division: string,
  page = 1,
  limit = 24,
) {
  return sql`${registeredSellers}, filtered as (
    select id, name, slug, role, nature, address, district, division
    from located_sellers
    where district_key = lower(regexp_replace(trim(${district}), '\\s+', ' ', 'g'))
      and division_key = lower(regexp_replace(trim(${division}), '\\s+', ' ', 'g'))
  ), totals as (
    select count(*)::int as total_count,
      greatest(1, ceil(count(*)::numeric / ${limit}))::int as total_pages from filtered
  ), paging as (
    select *, least(${page}, total_pages)::int as page from totals
  )
  select total_count as "totalCount", total_pages as "totalPages", page,
    coalesce((select json_agg(list) from (
      select * from filtered order by name, id limit ${limit}
      offset (select (page - 1) * ${limit} from paging)
    ) list), '[]'::json) as sellers from paging`;
}
