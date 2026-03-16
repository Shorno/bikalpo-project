import { client } from "@/utils/orpc";
import { PricingClient } from "./pricing-client";

export async function PricingSection() {
  const plans = await client.landing.getPricingPlans().catch(() => []);
  return <PricingClient plans={plans} />;
}
