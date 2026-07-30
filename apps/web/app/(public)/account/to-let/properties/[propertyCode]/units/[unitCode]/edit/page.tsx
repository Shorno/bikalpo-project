import type { Metadata } from "next";
import { UnitForm } from "@/components/features/to-let/property/unit-form";

export const metadata: Metadata = {
  title: "Edit Property Unit",
};

export default async function EditPropertyUnitPage({
  params,
}: {
  params: Promise<{ propertyCode: string; unitCode: string }>;
}) {
  const { propertyCode, unitCode } = await params;
  return <UnitForm propertyCode={propertyCode} unitCode={unitCode} />;
}
