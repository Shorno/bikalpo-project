import { z } from "zod";

export const bannerLink = z.string().trim().max(2000).refine(value => {
  if (!value) return true;
  if (/[\\\s]/.test(value)) return false;
  if (/^\/(?!\/)/.test(value)) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}, "Use a site path or HTTPS URL");
export const toLetBannerSlideSchema = z.object({
  title: z.string().trim().min(1).max(150),
  imageUrl: z.union([z.literal("/images/to-let-aerial-city-banner.png"), z.url().refine(value => value.startsWith("https://"), "Use an HTTPS image")]),
  link: bannerLink.default(""),
});
export const toLetBannerSchema = z.object({ slides: z.array(toLetBannerSlideSchema).min(1).max(10) });
export type ToLetBannerSlide = z.infer<typeof toLetBannerSlideSchema>;
export const defaultToLetBanner: ToLetBannerSlide[] = [{ title: "Bangladesh's most trusted digital To-Let platform", imageUrl: "/images/to-let-aerial-city-banner.png", link: "" }];
