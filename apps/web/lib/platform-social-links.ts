import { publicSocialUrl } from "./shop-footer-links";

/**
 * Bikalpo's own social profiles. Every storefront footer shows these (not
 * the individual store's), so they're set once for the platform.
 * A profile without a configured URL renders as "coming soon".
 */
export const platformSocialLinks = [
  {
    label: "Facebook",
    url: publicSocialUrl(process.env.NEXT_PUBLIC_BIKALPO_FACEBOOK_URL),
  },
  {
    label: "Instagram",
    url: publicSocialUrl(process.env.NEXT_PUBLIC_BIKALPO_INSTAGRAM_URL),
  },
] as const;
