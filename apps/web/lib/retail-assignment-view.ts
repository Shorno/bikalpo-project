export const RETAIL_ASSIGNMENT_PATH =
  "/dashboard/delivery-team/assignments" as const;

export type RetailAssignmentView = "groups" | "riders";

export function normalizeRetailAssignmentView(
  value: string | null | undefined,
): RetailAssignmentView {
  return value === "riders" ? "riders" : "groups";
}

export function getRetailAssignmentViewHref(
  view: RetailAssignmentView,
  currentSearch = "",
) {
  const searchParams = new URLSearchParams(currentSearch);
  searchParams.set("view", view);

  return `${RETAIL_ASSIGNMENT_PATH}?${searchParams.toString()}`;
}
