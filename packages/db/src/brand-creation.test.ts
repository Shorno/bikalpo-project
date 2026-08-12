import assert from "node:assert/strict";
import test from "node:test";
import {
  countAddableBrands,
  resolveBrandCreationAction,
  resolveSingleBrandVariantDefaults,
  shouldDeactivateOmittedBrands,
  validateBrandCreationSubmission,
} from "./brand-creation";

test("brand creation actions distinguish empty and configured cores in both modes", () => {
  assert.deepEqual(
    resolveBrandCreationAction({
      mode: "batch",
      configuredBrandCount: 0,
      addableBrandCount: 3,
    }),
    { kind: "add_brands", label: "Add Brands", disabled: false },
  );
  assert.deepEqual(
    resolveBrandCreationAction({
      mode: "batch",
      configuredBrandCount: 2,
      addableBrandCount: 1,
    }),
    {
      kind: "edit_configuration",
      label: "Edit Configuration",
      disabled: false,
    },
  );
  assert.deepEqual(
    resolveBrandCreationAction({
      mode: "single",
      configuredBrandCount: 0,
      addableBrandCount: 3,
    }),
    { kind: "add_brand", label: "Add Brand", disabled: false },
  );
  assert.deepEqual(
    resolveBrandCreationAction({
      mode: "single",
      configuredBrandCount: 2,
      addableBrandCount: 1,
    }),
    { kind: "add_brand", label: "Add Brand", disabled: false },
  );
  assert.deepEqual(
    resolveBrandCreationAction({
      mode: "single",
      configuredBrandCount: 2,
      addableBrandCount: 0,
    }),
    {
      kind: "all_brands_added",
      label: "All Brands Added",
      disabled: true,
    },
  );
});

test("addable brands exclude active and inactive configured products", () => {
  assert.equal(countAddableBrands([1, 2, 3, 4], [2, 4]), 2);
  assert.equal(countAddableBrands([1, 2], [1, 2, 3]), 0);
});

test("single-brand defaults use only compatible variants from that Admin preset brand", () => {
  assert.deepEqual(
    resolveSingleBrandVariantDefaults({
      brandId: 7,
      compatibleVariantOptionIds: [10, 11, 12],
      adminPresetBrands: [
        { brandId: 7, variantOptionIds: [12, 10, 99, 10] },
        { brandId: 8, variantOptionIds: [11] },
      ],
    }),
    {
      source: "admin_preset",
      variantOptionIds: [12, 10],
    },
  );
});

test("single-brand defaults start empty for brands absent from the Admin preset", () => {
  assert.deepEqual(
    resolveSingleBrandVariantDefaults({
      brandId: 9,
      compatibleVariantOptionIds: [10, 11, 12],
      adminPresetBrands: [{ brandId: 7, variantOptionIds: [10, 11] }],
    }),
    { source: "manual", variantOptionIds: [] },
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
