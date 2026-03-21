"use client";

import { useState, useCallback, useRef } from "react";
import { client } from "@/utils/orpc";

export interface BarikoiPlace {
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
}

export function useBarikoiAutocomplete() {
  const [suggestions, setSuggestions] = useState<BarikoiPlace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback((query: string) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const places = await client.barikoi.autocomplete({ q: query });
        setSuggestions(places as BarikoiPlace[]);
      } catch (error) {
        console.error("Barikoi autocomplete error:", error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 350);
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  return { suggestions, isLoading, search, clearSuggestions };
}
