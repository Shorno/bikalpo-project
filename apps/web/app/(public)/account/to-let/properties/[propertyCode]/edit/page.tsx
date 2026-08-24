import type { Metadata } from "next";
import { PropertyEditForm } from "@/components/features/to-let/property/property-edit-form";

export const metadata: Metadata = {
  title: "Edit Property",
};

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ propertyCode: string }>;
}) {
  const { propertyCode } = await params;
  return <PropertyEditForm propertyCode={propertyCode} />;
}
