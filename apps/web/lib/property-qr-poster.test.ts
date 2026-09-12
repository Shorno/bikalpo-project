import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PropertyQrPoster } from "../components/features/to-let/property/property-qr-poster";

test("poster uses actual property identity and a real QR with four-module quiet zone", () => {
  const markup = renderToStaticMarkup(
    createElement(PropertyQrPoster, {
      propertyName: "Noor Villa & Green Tower",
      propertyCode: "PR-2026-100001",
      location: "Mohammadpur, Dhaka",
      qrUrl: "https://bikalpo.com/to-let/qr/test-token",
    }),
  );
  assert.match(markup, /viewBox="0 0 1024 1536"/);
  assert.match(markup, /Noor Villa &amp; Green Tower/);
  assert.match(markup, /PR-2026-100001/);
  assert.match(markup, /Mohammadpur, Dhaka/);
  assert.match(markup, /<path/);
  assert.doesNotMatch(markup, /PR-100245/);
});

test("unresolved origin does not render a misleading relative QR", () => {
  const markup = renderToStaticMarkup(
    createElement(PropertyQrPoster, {
      propertyName: "<script> & test",
      propertyCode: "PR-1",
      location: "",
      qrUrl: "",
    }),
  );
  assert.match(markup, /Preparing QR/);
  assert.match(markup, /&lt;script&gt;/);
  assert.match(markup, /Location available on property page/);
  assert.doesNotMatch(markup, /<path/);
});
