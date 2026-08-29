---
version: 1
slug: "apps-web-components-account-account-sidebar-tsx"
primary_target: "apps/web/components/account/account-sidebar.tsx"
related_targets: ["apps/web/components/shop/account-overview-client.tsx","apps/web/app/(public)/account/layout.tsx","apps/web/app/shop/(storefront)/account/layout.tsx"]
---

# Account management surface

- Scope and mode: The authenticated buyer account shell and landing overview; Operate mode.
- Audience and job: Consumers checking identity, delivery details, and order activity, with retailer/shop-owner buyers using the same user-facing account URL vocabulary where capabilities overlap.
- Primary tasks: Understand account completeness, manage personal profile and addresses, find order history, and reach Bikalpo-specific buying and support workflows without scanning a flat menu.
- Content and constraints: Preserve existing real workflows; do not expose payment, wishlist, return, review, or followed-store destinations until their user-facing capability is complete. Keep public and shop route adapters working. Use the Logistics Registry system: restrained Registry Blue, cool neutrals, structural borders, no decorative shadow or gradients.
- Direction: `ACCOUNT-REGISTRY-2026` — a compact registry desk with narrow grouped navigation, an asymmetric profile/address summary, and a dense recent-order ledger. The memorable moment is the landing view answering “who am I, where will it arrive, and what is happening with my orders?” in one scan.
- Responsive behavior: Persistent sidebar on desktop; one accessible disclosure on small screens using the same grouped navigation source.
- Unresolved: Consumer-safe returns, payment management, wishlist, personal review history, and followed-store listing remain later product phases.
