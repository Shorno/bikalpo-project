// Appending the identity retains the oRPC prefix used for invalidation, while
// preventing cached results/placeholder data from crossing account boundaries.
export function toLetAlertAccountQuery(queryKey: readonly unknown[], userId: string | undefined, enabled = true, sessionPending = false) {
  return {
    queryKey: [...queryKey, { consumerId: sessionPending ? null : userId ?? null }],
    enabled: enabled && !sessionPending && Boolean(userId),
    placeholderData: () => undefined,
  };
}
