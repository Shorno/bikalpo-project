"use client";

import { useState, useCallback } from "react";
import { client } from "@/utils/orpc";

export interface BarikoiReverseGeoResult {
  address: string;
  address_bn: string;
  area: string;
  area_bn: string;
  city: string;
  city_bn: string;
  district: string;
  division: string;
  sub_district: string;
  postCode: string;
  thana: string;
  thana_bn: string;
  country: string;
}

export function useBarikoiReverseGeocode() {
  const [isLoading, setIsLoading] = useState(false);

  const reverseGeocode = useCallback(
    async (
      latitude: number,
      longitude: number
    ): Promise<BarikoiReverseGeoResult | null> => {
      setIsLoading(true);
      try {
        const result = await client.barikoi.reverseGeocode({
          latitude,
          longitude,
        });
        return result as BarikoiReverseGeoResult | null;
      } catch (error) {
        console.error("Barikoi reverse geocode error:", error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { reverseGeocode, isLoading };
}
