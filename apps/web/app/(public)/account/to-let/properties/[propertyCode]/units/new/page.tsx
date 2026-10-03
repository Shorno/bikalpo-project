import type { Metadata } from "next";
import { NewListingWizard } from "@/components/features/to-let/property/listing-form";

export const metadata: Metadata = {
  title: "Create To-Let Listing",
};

export default async function CreatePropertyUnitPage({
  params,
}: {
  params: Promise<{ propertyCode: string }>;
}) {
  const { propertyCode } = await params;
  return <NewListingWizard propertyCode={propertyCode} />;
}
