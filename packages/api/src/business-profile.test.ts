import assert from "node:assert/strict";
import test from "node:test";
import { computeProfileCompletion } from "./business-profile";

test("missing registration and empty documents do not inflate completion", () => {
  assert.equal(computeProfileCompletion(null, null), 0);
  assert.equal(
    computeProfileCompletion(
      { documents: [], documentUrls: {}, bankName: "  " },
      {},
    ),
    0,
  );
});

test("combines saved account identity with registration answers", () => {
  assert.equal(
    computeProfileCompletion(
      {
        profilePhotoUrl: "https://example.com/photo.jpg",
        businessCategory: "Grocery",
        district: "Dhaka",
        bankName: "Business bank",
        documentUrls: { tradeLicense: "https://example.com/license.pdf" },
      },
      {
        ownerName: "Owner",
        phoneNumber: "01700000000",
        email: "owner@example.com",
        shopName: "Grocery Shop",
      },
    ),
    100,
  );
});

test("legacy application identity and document lists count once per category", () => {
  assert.equal(
    computeProfileCompletion(
      {
        ownerName: "Owner",
        phoneNumber: "01700000000",
        email: "owner@example.com",
        warehouseName: "Warehouse",
        documents: ["https://example.com/license.pdf"],
        documentUrls: { nid: " " },
      },
      {},
    ),
    56,
  );
});
