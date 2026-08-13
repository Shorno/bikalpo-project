import type { Metadata } from "next";
import { PropertyRegistrationWizard } from "@/components/features/to-let/property/property-registration-wizard";

export const metadata: Metadata = {
  title: "Register Property",
};

export default function RegisterPropertyPage() {
  return <PropertyRegistrationWizard />;
}
