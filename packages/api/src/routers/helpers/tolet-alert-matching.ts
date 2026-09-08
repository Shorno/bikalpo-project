export interface AlertMatchPreferences {
  preferredCategory: string;
  preferredLocation: string;
  minimumSizeSqFt: number;
}

export function alertLocationTerms(location: string) {
  const normalized = location.trim().toLowerCase().replace(/\s+/g, " ");
  if (["any", "any location"].includes(normalized)) return [];
  return normalized.split(/[\s,]+/).filter(Boolean);
}

// Only these three fields gate an alert; bedroom/bathroom/floor preferences do not.
export function matchesToLetAlert(
  preferences: AlertMatchPreferences,
  listing: { unitType: string; sizeSqFt: number; location: string },
) {
  return (preferences.preferredCategory === "any" || preferences.preferredCategory === listing.unitType)
    && listing.sizeSqFt >= preferences.minimumSizeSqFt
    && alertLocationTerms(preferences.preferredLocation).every(term => listing.location.toLowerCase().includes(term));
}
