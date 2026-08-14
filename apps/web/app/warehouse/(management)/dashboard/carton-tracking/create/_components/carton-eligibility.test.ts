import assert from "node:assert/strict";
import test from "node:test";
import { isCartonVariantEligible } from "./carton-eligibility";

test("carton selection includes direct and pack variants but excludes loose stock", () => {
  assert.equal(
    isCartonVariantEligible({ receivingMode: "direct", packType: "cylinder" }),
    true,
  );
  assert.equal(
    isCartonVariantEligible({ receivingMode: "pack", packType: "packet" }),
    true,
  );
  assert.equal(isCartonVariantEligible({ packType: "cylinder" }), true);
  assert.equal(
    isCartonVariantEligible({ receivingMode: "loose", packType: "loose" }),
    false,
  );
});
