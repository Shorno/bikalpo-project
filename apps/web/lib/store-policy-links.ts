import { withCustomerStorefrontPreview } from "./customer-storefront-preview";

export const storePolicyLinks = [
  { id: "return-refund", label: "Return & Refund" },
  { id: "delivery", label: "Delivery Policy" },
  { id: "cancellation", label: "Cancellation" },
] as const;

export type StorePolicyId = (typeof storePolicyLinks)[number]["id"];

export function storePolicyHref(
  slug: string,
  policy: StorePolicyId,
  previewMode: boolean,
) {
  return withCustomerStorefrontPreview(
    `/stores/${encodeURIComponent(slug)}/policies/${policy}`,
    previewMode,
  );
}
