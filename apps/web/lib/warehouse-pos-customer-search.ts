export function getCustomerSearchState(input: {
  search: string;
  debouncedSearch: string;
  isFetching: boolean;
  isError: boolean;
  hasData: boolean;
  matchCount: number;
}) {
  if (!input.search.trim()) return "idle";
  if (input.search.trim() !== input.debouncedSearch || input.isFetching)
    return "loading";
  if (input.isError) return "error";
  if (!input.hasData) return "loading";
  return input.matchCount > 0 ? "matches" : "empty";
}
