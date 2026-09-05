import { db } from "@bikalpo-project/db";
import { z } from "zod";
import { publicProcedure } from "../index";
import {
  sellerLocationsQuery,
  sellersByLocationQuery,
} from "./helpers/seller-directory";

type SellerLocation = {
  districtKey: string;
  divisionKey: string;
  district: string;
  division: string;
  count: number;
};
type Seller = {
  id: string;
  name: string | null;
  slug: string | null;
  role: "shop_owner" | "warehouse";
  nature: string | null;
  address: string;
  district: string;
  division: string;
};

export const sellerDirectoryRouter = {
  locations: publicProcedure
    .route({
      method: "GET",
      path: "/seller-directory/locations",
      tags: ["Sellers"],
      summary: "Count registered sellers by business map location",
    })
    .handler(async () => {
      const result = await db.execute(sellerLocationsQuery());
      return { locations: result.rows as SellerLocation[] };
    }),
  list: publicProcedure
    .route({
      method: "GET",
      path: "/seller-directory",
      tags: ["Sellers"],
      summary: "List sellers registered in a district",
    })
    .input(
      z.object({
        district: z.string().trim().min(1).max(100),
        division: z.string().trim().min(1).max(100),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(48).default(24),
      }),
    )
    .handler(async ({ input }) => {
      const result = await db.execute(
        sellersByLocationQuery(
          input.district,
          input.division,
          input.page,
          input.limit,
        ),
      );
      return result.rows[0] as {
        sellers: Seller[];
        totalCount: number;
        totalPages: number;
        page: number;
      };
    }),
};
