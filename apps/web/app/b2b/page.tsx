import { B2bHero } from "@/components/features/landing/b2b/b2b-hero";
import { B2bPainPoints } from "@/components/features/landing/b2b/b2b-pain-points";
import { B2bNetwork } from "@/components/features/landing/b2b/b2b-network";
import { B2bOrderSystem } from "@/components/features/landing/b2b/b2b-order-system";
import { B2bDelivery } from "@/components/features/landing/b2b/b2b-delivery";
import { B2bSmartSupply } from "@/components/features/landing/b2b/b2b-smart-supply";
import { B2bNoWebsite } from "@/components/features/landing/b2b/b2b-no-website";
import { B2bRoles } from "@/components/features/landing/b2b/b2b-roles";
import { B2bBenefits } from "@/components/features/landing/b2b/b2b-benefits";
import { B2bTrial } from "@/components/features/landing/b2b/b2b-trial";
import { B2bTrust } from "@/components/features/landing/b2b/b2b-trust";
import { B2bVision } from "@/components/features/landing/b2b/b2b-vision";
import { B2bFaq } from "@/components/features/landing/b2b/b2b-faq";
import { B2bCta } from "@/components/features/landing/b2b/b2b-cta";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bikalpo Trade — Bangladesh's Digital B2B Wholesale Platform",
  description:
    "Control your supply, expand your market, increase your profit. Digital wholesale trade network for warehouses, shops & restaurants in Bangladesh.",
};

export const revalidate = 300;

export default function B2bHomePage() {
  return (
    <>
      {/* Section 01: Hero Positioning */}
      <B2bHero />
      {/* Section 02: Business Limitations / Pain Points */}
      <B2bPainPoints />
      {/* Section 03: Platform Network Architecture */}
      <B2bNetwork />
      {/* Section 04: Digital Order Collection System */}
      <B2bOrderSystem />
      {/* Section 05: Delivery Partner Integration */}
      <B2bDelivery />
      {/* Section 06: Smart Supply & Buying System */}
      <B2bSmartSupply />
      {/* Section 07: No Website Needed Advantage */}
      <B2bNoWebsite />
      {/* Section 08: Role-Based Business Control */}
      <B2bRoles />
      {/* Section 09: Real Business Benefits */}
      <B2bBenefits />
      {/* Section 10: Trial & Subscription Model */}
      <B2bTrial />
      {/* Section 11: Proof & Trust Block */}
      <B2bTrust />
      {/* Section 12: Future Vision + Demo */}
      <B2bVision />
      {/* Section 13: FAQ */}
      <B2bFaq />
      {/* Section 14: Final Conversion CTA */}
      <B2bCta />
    </>
  );
}
