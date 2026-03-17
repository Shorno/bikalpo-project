import { AdvantageDetail } from "@/components/features/landing/advantage-detail";
import { FeaturesHero } from "@/components/features/landing/features-hero";
import { NumberedFeatureGrid } from "@/components/features/landing/numbered-feature-grid";
import { PricingSection } from "@/components/features/landing/pricing-section";

export const revalidate = 300;

export default async function FeaturesPage() {
  return (
    <>
      <FeaturesHero />
      <NumberedFeatureGrid />
      <AdvantageDetail />
      <PricingSection />
    </>
  );
}
