import assert from "node:assert/strict";
import test from "node:test";
import { shouldLogRpcResponseAsError } from "./orpc-error-logging";

test("handled domain responses do not trigger the development error overlay", () => {
  assert.equal(shouldLogRpcResponseAsError(400), false);
  assert.equal(shouldLogRpcResponseAsError(409), false);
  assert.equal(shouldLogRpcResponseAsError(500), true);
  assert.equal(shouldLogRpcResponseAsError(503), true);
});
