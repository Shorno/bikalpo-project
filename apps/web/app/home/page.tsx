import { HeroSection } from "@/components/features/landing/hero-section";
import { FeatureGrid } from "@/components/features/landing/feature-grid";
import { ProcessSteps } from "@/components/features/landing/process-steps";
import { PricingSection } from "@/components/features/landing/pricing-section";
import { BenefitsSection } from "@/components/features/landing/benefits-section";
import { BlogSection } from "@/components/features/landing/blog-section";
import { CtaSection } from "@/components/features/landing/cta-section";
import { client } from "@/utils/orpc";

export const revalidate = 300; // Revalidate every 5 minutes

export default async function HomePage() {
    // Fetch pricing plans server-side
    let plans = [];
    try {
        plans = await client.landing.getPricingPlans();
    } catch {
        // Fallback to static pricing if API fails
        plans = [];
    }

    return (
        <>
            <HeroSection />
            <FeatureGrid />
            <ProcessSteps />
            <PricingSection plans={plans} />
            <BenefitsSection />
            <BlogSection />
            <CtaSection />
        </>
    );
}
