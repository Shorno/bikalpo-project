import type { Metadata } from "next";
import { UnitDetailsClient } from "@/components/features/to-let/property/unit-details-client";

export const metadata: Metadata = {
  title: "Property Unit Details",
};

export default async function PropertyUnitDetailsPage({
  params,
}: {
  params: Promise<{ propertyCode: string; unitCode: string }>;
}) {
  const { propertyCode, unitCode } = await params;
  return <UnitDetailsClient propertyCode={propertyCode} unitCode={unitCode} />;
}
