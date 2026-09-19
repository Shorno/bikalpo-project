import { describe, expect, test } from "bun:test";
import { bannerLink, defaultToLetBanner, toLetBannerSchema } from "./tolet-banner";

describe("To-Let banner validation", () => {
  test("existing landing banner can be published unchanged", () => {
    expect(toLetBannerSchema.safeParse({ slides: defaultToLetBanner }).success).toBe(true);
  });
  test("accepts slides and safe links", () => {
    expect(toLetBannerSchema.safeParse({ slides: [{ title: "Find your home", imageUrl: "https://example.com/home.jpg", link: "/to-let/listings" }] }).success).toBe(true);
    expect(bannerLink.safeParse("https://example.com/offer").success).toBe(true);
  });
  test("rejects unsafe links and invalid image URLs", () => {
    for (const link of ["javascript:alert(1)", "//example.com", "/\\example.com", "https://", "https://user:password@example.com"]) expect(bannerLink.safeParse(link).success).toBe(false);
    expect(toLetBannerSchema.safeParse({ slides: [{ title: "", imageUrl: "data:image/png;base64,x", link: "" }] }).success).toBe(false);
  });
  test("requires one to ten slides", () => {
    expect(toLetBannerSchema.safeParse({ slides: [] }).success).toBe(false);
    expect(toLetBannerSchema.safeParse({ slides: Array(11).fill({ title: "Slide", imageUrl: "https://example.com/image.jpg", link: "" }) }).success).toBe(false);
  });
});
