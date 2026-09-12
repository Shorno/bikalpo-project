import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { toLetAlertAccountQuery } from "./to-let-alert-cache";

test("saved alerts and inbox caches do not cross accounts or logout", async () => {
  const client = new QueryClient();
  try {
    for (const endpoint of ["listAlerts", "listAlertNotifications"]) {
      const prefix = ["toLetRental", endpoint];
      const alice = toLetAlertAccountQuery(prefix, "alice");
      const bob = toLetAlertAccountQuery(prefix, "bob");
      const guest = toLetAlertAccountQuery(prefix, undefined);
      client.setQueryData(alice.queryKey, { privateLocation: "Alice location" });
      assert.equal(client.getQueryData(bob.queryKey), undefined);
      assert.equal(client.getQueryData(guest.queryKey), undefined);
      assert.equal(guest.enabled, false);
      assert.equal(bob.placeholderData(), undefined);
      client.setQueryData(bob.queryKey, { privateLocation: "Bob location" });
      await client.invalidateQueries({ queryKey: prefix });
      assert.equal(client.getQueryState(alice.queryKey)?.isInvalidated, true);
      assert.equal(client.getQueryState(bob.queryKey)?.isInvalidated, true);
    }
  } finally { client.clear(); }
});

test("pending sessions never read a previous consumer's cached data", () => {
  const pending = toLetAlertAccountQuery(["alerts"], "alice", true, true);
  assert.equal(pending.enabled, false);
  assert.deepEqual(pending.queryKey, ["alerts", { consumerId: null }]);
  assert.equal(toLetAlertAccountQuery(["alerts"], "alice", false).enabled, false);
});
