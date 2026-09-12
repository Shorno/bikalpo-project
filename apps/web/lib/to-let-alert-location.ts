import { districtsForDivision } from "../constants/bangladesh-locations";

export interface AlertLocationSelection {
  division: string;
  district: string;
  upazila: string;
  area: string;
}

export type AlertLocationField = keyof AlertLocationSelection;

export const emptyAlertLocation: AlertLocationSelection = {
  division: "",
  district: "",
  upazila: "",
  area: "",
};

export const alertLocationFieldOrder: AlertLocationField[] = [
  "division",
  "district",
  "upazila",
  "area",
];

// Changing a parent must not leave an address from the previous branch selected.
export function updateAlertLocation(
  selection: AlertLocationSelection,
  field: AlertLocationField,
  value: string,
): AlertLocationSelection {
  const trimmed = value.trim();
  if (selection[field] === trimmed) return selection;
  const next = { ...selection, [field]: trimmed };
  for (const child of alertLocationFieldOrder.slice(
    alertLocationFieldOrder.indexOf(field) + 1,
  )) {
    next[child] = "";
  }
  return next;
}

// Reuse the persisted, token-matched location contract. No migration or changes to
// existing saved searches are needed; omitted child levels mean "any" at that level.
export function preferredAlertLocation(selection: AlertLocationSelection) {
  return (
    [
      ...new Set(
        [
          selection.area,
          selection.upazila,
          selection.district,
          selection.division,
        ]
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ].join(", ") || "Any location"
  );
}

export function alertLocationError(
  selection: AlertLocationSelection,
): string | null {
  if (
    selection.division &&
    districtsForDivision(selection.division).length === 0
  ) {
    return "Choose a listed division.";
  }
  if (
    selection.district &&
    !districtsForDivision(selection.division).includes(selection.district)
  ) {
    return "Choose a district in your selected division.";
  }
  if (selection.upazila && !selection.district)
    return "Choose a district before the Upazila / Thana.";
  if (selection.area && !selection.upazila)
    return "Choose an Upazila / Thana before the area.";
  if (
    [selection.upazila, selection.area].some(
      (value) => value.trim().length === 1,
    )
  ) {
    return "Location names must have at least 2 characters.";
  }
  if (preferredAlertLocation(selection).length > 200) {
    return "This location is too long. Shorten the area or Upazila / Thana name.";
  }
  return null;
}

export function alertPreferenceInteger(value: string, maximum: number) {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}
