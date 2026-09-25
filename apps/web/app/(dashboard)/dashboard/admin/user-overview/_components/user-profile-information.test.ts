import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ApplicationDetailData } from "@/components/features/admin/application-detail-sections";
import {
  BusinessInformation,
  DocumentsContent,
  FinancialInformation,
} from "./user-detail-content";
import { profileContacts } from "./user-profile-contacts";

const detail: ApplicationDetailData = {
  ownerName: "Business owner",
  businessAddress: "Saved business address",
  phoneNumber: "01700000000",
  email: "business@example.com",
  businessNature: "retail_shop",
  productTypeName: "Grocery",
  yearsInBusiness: "5+ Years",
  monthlyRevenue: "Above ৳10 Lakh",
  area: "Saved area",
  thana: "Saved thana",
  district: "Dhaka",
  division: "Dhaka",
  postCode: "1200",
  tradeLicenseNumber: "TRADE-SAVED",
  tinNumber: "TIN-SAVED",
  binNumber: "BIN-SAVED",
  messengerUrl: "https://m.me/saved-business",
  telegramUrl: "https://t.me/saved-business",
  twitterUrl: "https://x.com/saved-business",
};

test("profile and editor keep a cleared business email blank, separate from account email", () => {
  const account = {
    name: "Account owner",
    email: "sign-in@example.com",
    phoneNumber: "+8801700000000",
  };
  assert.equal(
    profileContacts(account, { ...detail, email: null }).email,
    null,
  );
  assert.equal(profileContacts(account, { ...detail, email: "" }).email, null);
  assert.equal(profileContacts(account, detail).email, detail.email);
  assert.equal(profileContacts(account, null).email, account.email);
  assert.equal(
    profileContacts({ ...account, email: "8801700000000@bikalpo.com" }, null)
      .email,
    null,
  );
});

function renderInformation(value = detail) {
  return renderToStaticMarkup(
    createElement(BusinessInformation, {
      detail: value,
      businessName: "Saved business",
    }),
  );
}

test("admin profiles display contacts, location and tax fields saved in settings", () => {
  const html = renderInformation();
  for (const value of [
    "Mobile Number",
    "01700000000",
    "Email Address",
    "business@example.com",
    "Owner Name",
    "Business owner",
    "Upazila / Thana",
    "Saved thana",
    "Post Code",
    "1200",
    "TRADE-SAVED",
    "TIN-SAVED",
    "BIN-SAVED",
  ]) {
    assert.ok(html.includes(value), `Missing saved profile field: ${value}`);
  }
});

test("all saved social channels render links and unsafe addresses remain plain text", () => {
  const html = renderInformation({
    ...detail,
    websiteUrl: "javascript:alert(1)",
  });
  for (const href of [
    detail.messengerUrl,
    detail.telegramUrl,
    detail.twitterUrl,
  ]) {
    assert.ok(
      html.includes(`href="${href}"`),
      `Missing social channel: ${href}`,
    );
  }
  assert.ok(!html.includes('href="javascript:'));
});

test("warehouse documents keep their own label and are omitted when absent", () => {
  const documentUrl = "https://example.com/warehouse-document.pdf";
  const render = (value: ApplicationDetailData) =>
    renderToStaticMarkup(createElement(DocumentsContent, { detail: value }));
  const html = render({ ...detail, documentUrls: { warehouse: documentUrl } });
  assert.ok(html.includes("Warehouse Photo"));
  assert.ok(html.includes(`href="${documentUrl}"`));
  assert.ok(!render(detail).includes("Warehouse Photo"));
});

test("financial settings show saved bank and mobile accounts with recorded status and masked numbers", () => {
  const html = renderToStaticMarkup(
    createElement(FinancialInformation, {
      detail,
      accounts: [
        {
          id: "bank",
          type: "bank",
          providerName: "Saved Bank",
          accountName: "Business banking",
          accountNumber: "1234567890",
          isActive: true,
        },
        {
          id: "mobile",
          type: "mobile_banking",
          providerName: "Saved Mobile Provider",
          accountName: "Business mobile",
          accountNumber: "01900000123",
          isActive: false,
        },
      ],
    }),
  );
  for (const text of [
    "Bank Accounts",
    "Mobile Banking",
    "Saved Bank",
    "Saved Mobile Provider",
    "Business banking",
    "Business mobile",
    "Active",
    "Inactive",
    "••••••••7890",
    "••••••••0123",
  ]) {
    assert.ok(html.includes(text), `Missing saved financial detail: ${text}`);
  }
  assert.ok(!html.includes("1234567890"));
  assert.ok(!html.includes("01900000123"));
  assert.equal(
    renderToStaticMarkup(
      createElement(FinancialInformation, { detail, accounts: [] }),
    ),
    "",
  );
});

test("missing optional settings stay blank and saved operating hours are retained", () => {
  const html = renderToStaticMarkup(
    createElement(BusinessInformation, {
      businessName: "Saved business",
      detail: { ownerName: "", phoneNumber: "", businessAddress: "" },
      openingTime: "08:30",
      closingTime: "22:00",
    }),
  );
  assert.ok(html.includes("Not recorded"));
  assert.ok(html.includes("08:30"));
  assert.ok(html.includes("22:00"));
  assert.ok(!html.includes("Business Registration"));
  assert.ok(!html.includes("Messenger"));
  assert.ok(!html.includes("undefined"));
  assert.ok(
    !renderInformation({
      ...detail,
      email: "8801700000000@bikalpo.com",
    }).includes("8801700000000@bikalpo.com"),
  );
});
