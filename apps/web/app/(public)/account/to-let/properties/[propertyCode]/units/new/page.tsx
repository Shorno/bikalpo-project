import type { Metadata } from "next";
import { UnitForm } from "@/components/features/to-let/property/unit-form";

export const metadata: Metadata = {
  title: "Create Property Unit",
};

export default async function CreatePropertyUnitPage({
  params,
}: {
  params: Promise<{ propertyCode: string }>;
}) {
  const { propertyCode } = await params;
  return <UnitForm propertyCode={propertyCode} />;
}
