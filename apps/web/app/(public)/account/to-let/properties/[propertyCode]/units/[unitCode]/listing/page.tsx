import type { Metadata } from "next";
import { ListingForm } from "@/components/features/to-let/property/listing-form";

export const metadata: Metadata = {
  title: "Manage To-Let Listing",
};

export default async function ManageToLetListingPage({
  params,
}: {
  params: Promise<{ propertyCode: string; unitCode: string }>;
}) {
  const { propertyCode, unitCode } = await params;

  return <ListingForm propertyCode={propertyCode} unitCode={unitCode} />;
}
