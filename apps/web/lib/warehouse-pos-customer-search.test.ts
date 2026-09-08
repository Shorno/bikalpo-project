import assert from "node:assert/strict";
import test from "node:test";

import { getCustomerSearchState } from "./warehouse-pos-customer-search";

test("customer creation is offered only for a completed, successful search with no matches", () => {
  const ready = {
    search: "Rahim",
    debouncedSearch: "Rahim",
    isFetching: false,
    isError: false,
    hasData: true,
    matchCount: 0,
  };
  assert.equal(getCustomerSearchState(ready), "empty");
  assert.equal(getCustomerSearchState({ ...ready, matchCount: 2 }), "matches");
  assert.equal(getCustomerSearchState({ ...ready, search: "" }), "idle");
  assert.equal(
    getCustomerSearchState({ ...ready, search: "Rahima" }),
    "loading",
  );
  assert.equal(
    getCustomerSearchState({ ...ready, isFetching: true }),
    "loading",
  );
  assert.equal(getCustomerSearchState({ ...ready, hasData: false }), "loading");
  assert.equal(getCustomerSearchState({ ...ready, isError: true }), "error");
});
