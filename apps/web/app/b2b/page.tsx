import { BenefitsSection } from "@/components/features/landing/benefits-section";
import { BlogSection } from "@/components/features/landing/blog-section";
import { CtaSection } from "@/components/features/landing/cta-section";
import { FeatureGrid } from "@/components/features/landing/feature-grid";
import { HeroSection } from "@/components/features/landing/hero-section";
import { PricingSection } from "@/components/features/landing/pricing-section";
import { ProcessSteps } from "@/components/features/landing/process-steps";

export const revalidate = 300;

export default async function B2bHomePage() {
  return (
    <>
      <HeroSection />
      <FeatureGrid />
      <ProcessSteps />
      <PricingSection />
      <BenefitsSection />
      <BlogSection />
      <CtaSection />
    </>
  );
}
