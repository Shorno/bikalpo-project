import type { Metadata } from "next";
import { PropertyDetailsClient } from "@/components/features/to-let/property/property-details-client";

export const metadata: Metadata = {
  title: "Property Details",
};

export default async function PropertyDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyCode: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ propertyCode }, query] = await Promise.all([params, searchParams]);
  return (
    <PropertyDetailsClient
      propertyCode={propertyCode}
      created={query.created === "1"}
    />
  );
}
