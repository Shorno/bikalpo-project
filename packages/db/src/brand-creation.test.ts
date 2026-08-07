import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveBrandCreationAction,
  shouldDeactivateOmittedBrands,
  validateBrandCreationSubmission,
} from "./brand-creation";

test("brand creation actions distinguish empty and configured cores in both modes", () => {
  assert.deepEqual(
    resolveBrandCreationAction({ mode: "batch", configuredBrandCount: 0 }),
    { kind: "add_brands", label: "Add Brands" },
  );
  assert.deepEqual(
    resolveBrandCreationAction({ mode: "batch", configuredBrandCount: 2 }),
    { kind: "edit_configuration", label: "Edit Configuration" },
  );
  assert.deepEqual(
    resolveBrandCreationAction({ mode: "single", configuredBrandCount: 0 }),
    { kind: "add_brand", label: "Add Brand" },
  );
  assert.deepEqual(
    resolveBrandCreationAction({ mode: "single", configuredBrandCount: 2 }),
    { kind: "manage_brands", label: "Manage Brands" },
  );
});

test("single mode accepts exactly one brand while batch mode accepts one or more", () => {
  assert.deepEqual(validateBrandCreationSubmission("single", 0), {
    valid: false,
    message: "Select exactly one brand before saving",
  });
  assert.deepEqual(validateBrandCreationSubmission("single", 1), {
    valid: true,
  });
  assert.deepEqual(validateBrandCreationSubmission("single", 2), {
    valid: false,
    message: "Single-brand mode accepts exactly one brand per save",
  });
  assert.deepEqual(validateBrandCreationSubmission("batch", 0), {
    valid: false,
    message: "Add at least one brand before saving",
  });
  assert.deepEqual(validateBrandCreationSubmission("batch", 3), {
    valid: true,
  });
});

test("only batch mode synchronizes omitted brands", () => {
  assert.equal(shouldDeactivateOmittedBrands("batch"), true);
  assert.equal(shouldDeactivateOmittedBrands("single"), false);
});

test("separate single-mode submissions preserve earlier brand products", () => {
  const configuredBrands = new Set<string>();
  const save = (submittedBrands: string[]) => {
    if (shouldDeactivateOmittedBrands("single")) {
      for (const brand of configuredBrands) {
        if (!submittedBrands.includes(brand)) configuredBrands.delete(brand);
      }
    }
    for (const brand of submittedBrands) configuredBrands.add(brand);
  };

  save(["Brand A"]);
  save(["Brand B"]);
  save(["Brand A"]);

  assert.deepEqual([...configuredBrands], ["Brand A", "Brand B"]);
});
