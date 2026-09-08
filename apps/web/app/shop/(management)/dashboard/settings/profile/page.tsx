import type { Metadata } from "next";
import { RetailerRegistrationProfileView } from "@/components/features/settings/retailer-registration-profile-view";

export const metadata: Metadata = {
  title: "Registration Profile | Retail Dashboard",
  description: "View the registration profile connected to your retail account",
};

export default function RegistrationProfilePage() {
  return <RetailerRegistrationProfileView />;
}
