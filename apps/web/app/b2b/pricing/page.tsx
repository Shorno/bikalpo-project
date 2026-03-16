"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PricingHeroSection } from "@/components/features/landing/pricing-hero";
import { PricingCards } from "@/components/features/landing/pricing-cards";
import { EnterpriseSection } from "@/components/features/landing/enterprise-section";
import { ContactSection } from "@/components/features/landing/contact-section";
import { orpc } from "@/utils/orpc";

export default function PricingPage() {
    const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">(
        "monthly"
    );

    const { data: plans = [] } = useQuery({
        queryKey: ["landing", "pricing-plans"],
        queryFn: () => orpc.landing.getPricingPlans.call({}),
    });

    return (
        <>
            <PricingHeroSection
                billingPeriod={billingPeriod}
                onToggle={setBillingPeriod}
            />
            <PricingCards plans={plans} billingPeriod={billingPeriod} />
            <EnterpriseSection />
            <ContactSection />
        </>
    );
}
