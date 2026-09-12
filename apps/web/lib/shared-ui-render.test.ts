import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Calendar } from "../components/ui/calendar";
import { FieldSet } from "../components/ui/field";
import { Skeleton } from "../components/ui/skeleton";

test("calendar keeps its root slot and calendar content", () => {
  const html = renderToStaticMarkup(createElement(Calendar, {
    month: new Date(2026, 8, 1),
    className: "calendar-smoke",
  }));
  assert.match(html, /data-slot="calendar"/);
  assert.match(html, /calendar-smoke/);
  assert.match(html, /September/);
});

test("field set preserves native attributes and child content", () => {
  const html = renderToStaticMarkup(createElement(FieldSet, {
    id: "fieldset-smoke", disabled: true,
  }, "Field content"));
  assert.match(html, /<fieldset/);
  assert.match(html, /id="fieldset-smoke"/);
  assert.match(html, /disabled=""/);
  assert.match(html, /Field content/);
});

test("skeleton preserves its native attributes and style classes", () => {
  const html = renderToStaticMarkup(createElement(Skeleton, {
    id: "skeleton-smoke", className: "custom-skeleton", "aria-hidden": true,
  }));
  assert.match(html, /data-slot="skeleton"/);
  assert.match(html, /id="skeleton-smoke"/);
  assert.match(html, /custom-skeleton/);
  assert.match(html, /aria-hidden="true"/);
});
