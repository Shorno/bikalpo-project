/**
 * Barikoi Location API Router
 *
 * Proxies Barikoi API calls through the server to keep the API key secure.
 * Provides autocomplete and reverse geocoding endpoints for the onboarding wizard.
 */
import { z } from "zod";
import { publicProcedure } from "../index";
import { env } from "@bikalpo-project/env/server";
import { normalizeBarikoiReversePlace } from "./barikoi-location";

const BARIKOI_BASE = "https://barikoi.xyz/v2/api/search";

export const barikoiRouter = {
  // ── Autocomplete: search for places ─────────────────────────
  autocomplete: publicProcedure
    .route({
      method: "GET",
      path: "/barikoi/autocomplete",
      tags: ["Barikoi"],
      summary: "Autocomplete place search via Barikoi API",
    })
    .input(
      z.object({
        q: z.string().min(2),
        city: z.string().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const params = new URLSearchParams({
        api_key: env.BARIKOI_API_KEY,
        q: input.q,
        sub_area: "true",
        sub_district: "true",
      });

      if (input.city) {
        params.set("city", input.city);
      }

      const response = await fetch(
        `${BARIKOI_BASE}/autocomplete/place?${params}`,
      );
      const data: any = await response.json();

      if (data.status === 200 && data.places) {
        return data.places as Array<{
          id: number;
          longitude: number;
          latitude: number;
          address: string;
          address_bn: string;
          city: string;
          city_bn: string;
          area: string;
          area_bn: string;
          postCode: number;
          pType: string;
          uCode: string;
        }>;
      }

      return [];
    }),

  // ── Reverse Geocode: lat/lng → address ──────────────────────
  reverseGeocode: publicProcedure
    .route({
      method: "GET",
      path: "/barikoi/reverse-geocode",
      tags: ["Barikoi"],
      summary: "Reverse geocode coordinates via Barikoi API",
    })
    .input(
      z.object({
        latitude: z.number(),
        longitude: z.number(),
      }),
    )
    .handler(async ({ input }) => {
      const params = new URLSearchParams({
        api_key: env.BARIKOI_API_KEY,
        longitude: input.longitude.toString(),
        latitude: input.latitude.toString(),
        district: "true",
        address: "true",
        area: "true",
        division: "true",
        sub_district: "true",
        thana: "true",
      });

      const response = await fetch(`${BARIKOI_BASE}/reverse/geocode?${params}`);
      const data: any = await response.json();

      if (data.status === 200 && data.place) {
        return normalizeBarikoiReversePlace(data.place);
      }

      return null;
    }),
};
