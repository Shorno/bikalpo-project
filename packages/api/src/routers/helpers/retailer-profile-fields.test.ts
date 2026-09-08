import assert from "node:assert/strict";
import test from "node:test";
import { user } from "@bikalpo-project/db/schema/auth-schema";
import { sellerApplication } from "@bikalpo-project/db/schema/seller-application";
import { eq, getTableColumns } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  retailerBusinessContactInformationSchema,
  retailerRegistrationProfileSchema,
  retailerRequiredThanaSchema,
  retailerShopProfileSchema,
  retailerThanaSchema,
} from "./retailer-profile-fields";

const legacyContactInput = {
  phoneNumber: "01700000000",
  email: null,
  whatsappNumber: null,
  facebookUrl: null,
  websiteUrl: null,
};

test("thana trims before checking its limit and supports omission and clearing", () => {
  assert.equal(retailerThanaSchema.parse("  Dhanmondi  "), "Dhanmondi");
  assert.equal(
    retailerThanaSchema.parse(`  ${"a".repeat(100)}  `),
    "a".repeat(100),
  );
  assert.equal(retailerThanaSchema.safeParse("a".repeat(101)).success, false);
  assert.equal(retailerThanaSchema.parse(undefined), undefined);
  assert.equal(retailerThanaSchema.parse(null), null);
});

test("business profile updates require a usable Thana", () => {
  assert.equal(retailerRequiredThanaSchema.parse("  Savar  "), "Savar");
  assert.equal(retailerRequiredThanaSchema.safeParse("").success, false);
  assert.equal(retailerRequiredThanaSchema.safeParse(null).success, false);
});

test("contact updates accept older clients and preserve Instagram compatibility", () => {
  assert.deepEqual(
    retailerBusinessContactInformationSchema.parse(legacyContactInput),
    legacyContactInput,
  );
  for (const instagramUrl of [null, "https://www.instagram.com/example"]) {
    assert.equal(
      retailerBusinessContactInformationSchema.parse({
        ...legacyContactInput,
        instagramUrl,
      }).instagramUrl,
      instagramUrl,
    );
  }
});

for (const field of ["messengerUrl", "telegramUrl"] as const) {
  test(`${field} trims HTTP(S) URLs and accepts null`, () => {
    for (const value of [
      "https://m.me/example",
      "http://t.me/example?start=profile#contact",
      "HTTPS://example.com/contact",
    ]) {
      assert.equal(
        retailerBusinessContactInformationSchema.parse({
          ...legacyContactInput,
          [field]: `  ${value}  `,
        })[field],
        value,
      );
    }
    assert.equal(
      retailerBusinessContactInformationSchema.parse({
        ...legacyContactInput,
        [field]: null,
      })[field],
      null,
    );
  });

  test(`${field} rejects unsafe protocols, malformed URLs, and excessive length`, () => {
    for (const value of [
      "javascript:alert(1)",
      "data:text/html,unsafe",
      "file:///etc/passwd",
      "ftp://example.com/contact",
      "mailto:contact@example.com",
      "tg://resolve?domain=example",
      "//example.com/contact",
      "https://",
      "not a URL",
      "",
      `https://example.com/${"a".repeat(2049 - "https://example.com/".length)}`,
    ]) {
      assert.equal(
        retailerBusinessContactInformationSchema.safeParse({
          ...legacyContactInput,
          [field]: value,
        }).success,
        false,
        value,
      );
    }
    const maxLengthUrl = `https://example.com/${"a".repeat(2048 - "https://example.com/".length)}`;
    assert.equal(
      retailerBusinessContactInformationSchema.parse({
        ...legacyContactInput,
        [field]: ` ${maxLengthUrl} `,
      })[field],
      maxLengthUrl,
    );
  });
}

test("profile columns are nullable and updates preserve omitted values or clear explicit nulls", () => {
  const columns = getTableColumns(sellerApplication);
  for (const field of ["thana", "messengerUrl", "telegramUrl"] as const) {
    assert.equal(columns[field].notNull, false);
    assert.equal(columns[field].hasDefault, false);
  }

  // Compile the same Drizzle update shape locally; no database connection is used.
  const db = drizzle.mock();
  const update = (input: Record<string, unknown>) =>
    db
      .update(sellerApplication)
      .set({
        ...retailerBusinessContactInformationSchema.parse(input),
        thana: retailerThanaSchema.parse(input.thana),
      })
      .where(eq(sellerApplication.id, "owned-application"))
      .toSQL();

  const omitted = update(legacyContactInput);
  for (const column of [
    "thana",
    "messenger_url",
    "telegram_url",
    "instagram_url",
  ]) {
    assert.equal(omitted.sql.includes(`"${column}" =`), false);
  }
  const saved = update({
    ...legacyContactInput,
    thana: "  Dhanmondi  ",
    messengerUrl: " https://m.me/example ",
    telegramUrl: " https://t.me/example ",
  });
  for (const value of [
    "Dhanmondi",
    "https://m.me/example",
    "https://t.me/example",
  ]) {
    assert.ok(saved.params.includes(value));
  }
  const cleared = update({
    ...legacyContactInput,
    thana: null,
    messengerUrl: null,
    telegramUrl: null,
    instagramUrl: null,
  });
  for (const column of [
    "thana",
    "messenger_url",
    "telegram_url",
    "instagram_url",
  ]) {
    const parameter = cleared.sql.match(new RegExp(`"${column}" = \\$(\\d+)`));
    assert.ok(parameter, `${column} is included in the update`);
    assert.equal(cleared.params[Number(parameter[1]) - 1], null);
  }
});

test("shop profile supports logo-only, hours-only, and legacy combined updates", () => {
  for (const input of [
    { shopLogo: "https://example.com/logo.png" },
    { shopLogo: null },
    { openingTime: "09:00", closingTime: "18:00" },
    { openingTime: null, closingTime: null },
    { shopLogo: null, openingTime: "00:00", closingTime: "23:59" },
  ]) {
    assert.deepEqual(retailerShopProfileSchema.parse(input), input);
  }
});

test("shop profile rejects updates with no recognized changes", () => {
  for (const input of [{}, { shopLogo: undefined }, { ignored: "value" }]) {
    assert.equal(retailerShopProfileSchema.safeParse(input).success, false);
  }
});

test("shop profile rejects partial hours and mismatched null states", () => {
  for (const openingTime of [undefined, null, "09:00"]) {
    for (const closingTime of [undefined, null, "18:00"]) {
      const validPair =
        (openingTime === undefined && closingTime === undefined) ||
        (openingTime === null && closingTime === null) ||
        (typeof openingTime === "string" && typeof closingTime === "string");
      assert.equal(
        retailerShopProfileSchema.safeParse({
          shopLogo: "https://example.com/logo.png",
          openingTime,
          closingTime,
        }).success,
        validPair,
        `opening=${openingTime}, closing=${closingTime}`,
      );
    }
  }
  for (const invalidTime of ["24:00", "12:60", "9:00", "", "09:00:00"]) {
    for (const field of ["openingTime", "closingTime"]) {
      assert.equal(
        retailerShopProfileSchema.safeParse({
          openingTime: "09:00",
          closingTime: "18:00",
          [field]: invalidTime,
        }).success,
        false,
      );
    }
  }
});

test("shop profile updates omit untouched logo or hours in generated SQL", () => {
  const db = drizzle.mock();
  const update = (value: unknown) => {
    const input = retailerShopProfileSchema.parse(value);
    return db
      .update(user)
      .set({
        shopLogo: input.shopLogo,
        shopOpeningTime: input.openingTime,
        shopClosingTime: input.closingTime,
      })
      .where(eq(user.id, "current-owner"))
      .toSQL();
  };
  const logoOnly = update({ shopLogo: "https://example.com/logo.png" });
  assert.ok(logoOnly.sql.includes(`"${user.shopLogo.name}" =`));
  assert.equal(
    logoOnly.sql.includes(`"${user.shopOpeningTime.name}" =`),
    false,
  );
  assert.equal(
    logoOnly.sql.includes(`"${user.shopClosingTime.name}" =`),
    false,
  );
  for (const hours of [
    { openingTime: "09:00", closingTime: "18:00" },
    { openingTime: null, closingTime: null },
  ]) {
    const hoursOnly = update(hours);
    assert.equal(hoursOnly.sql.includes(`"${user.shopLogo.name}" =`), false);
    for (const [column, value] of [
      [user.shopOpeningTime.name, hours.openingTime],
      [user.shopClosingTime.name, hours.closingTime],
    ] as const) {
      const parameter = hoursOnly.sql.match(
        new RegExp(`"${column}" = \\$(\\d+)`),
      );
      assert.ok(parameter);
      assert.equal(hoursOnly.params[Number(parameter[1]) - 1], value);
    }
  }
});

const completeRegistrationProfile = {
  applicant: {
    profilePhotoUrl: "https://example.com/owner.jpg",
    ownerName: "  Amina Rahman  ",
    dateOfBirth: "1990-05-12",
    gender: "female" as const,
    personalAddress: "12 Lake Road, Dhaka",
    personalArea: "Dhanmondi",
    personalDistrict: "Dhaka",
    personalDivision: "Dhaka",
    personalPostCode: "1209",
    personalLatitude: 23.7461,
    personalLongitude: 90.3742,
  },
  business: {
    shopLogo: "https://example.com/shop-logo.png",
    shopName: "  Amina General Store  ",
    businessType: "retail" as const,
    productTypeId: 4,
    businessNature: "retail_shop" as const,
    yearsInBusiness: "1 - 5 Years",
    monthlyRevenue: "৳2 Lakh - ৳10 Lakh",
    binNumber: "BIN-100",
    tinNumber: "TIN-200",
    tradeLicenseNumber: "TL-300",
    shopAddress: "12 Market Road, Dhaka",
    area: "Dhanmondi",
    thana: "Dhanmondi",
    district: "Dhaka",
    division: "Dhaka",
    postCode: "1209",
    latitude: 23.7461,
    longitude: 90.3742,
  },
  contacts: {
    phoneNumber: "01700000000",
    email: "owner@example.com",
    whatsappNumber: "01700000000",
    facebookUrl: "https://facebook.com/example",
    messengerUrl: "https://m.me/example",
    instagramUrl: "https://instagram.com/example",
    websiteUrl: "https://example.com",
    telegramUrl: "https://t.me/example",
    tiktokUrl: "https://tiktok.com/@example",
    twitterUrl: "https://x.com/example",
  },
  documents: {
    tradeLicense: "https://example.com/trade-license.pdf",
    nid: "https://example.com/nid.jpg",
    shopPhoto: "https://example.com/shop.jpg",
    storeFront: "https://example.com/storefront.jpg",
    warehouse: null,
  },
};

test("registration profile accepts the complete owner-editable application contract", () => {
  const parsed = retailerRegistrationProfileSchema.parse(
    completeRegistrationProfile,
  );

  assert.equal(parsed.applicant.ownerName, "Amina Rahman");
  assert.equal(parsed.business.shopName, "Amina General Store");
  assert.equal(parsed.business.area, "Dhanmondi");
  assert.equal(parsed.contacts.telegramUrl, "https://t.me/example");
  assert.equal(
    parsed.documents.tradeLicense,
    "https://example.com/trade-license.pdf",
  );
});

test("registration profile requires coordinate pairs and safe document URLs", () => {
  assert.equal(
    retailerRegistrationProfileSchema.safeParse({
      ...completeRegistrationProfile,
      applicant: {
        ...completeRegistrationProfile.applicant,
        personalLongitude: null,
      },
    }).success,
    false,
  );
  assert.equal(
    retailerRegistrationProfileSchema.safeParse({
      ...completeRegistrationProfile,
      documents: {
        ...completeRegistrationProfile.documents,
        nid: "javascript:alert(1)",
      },
    }).success,
    false,
  );
});
