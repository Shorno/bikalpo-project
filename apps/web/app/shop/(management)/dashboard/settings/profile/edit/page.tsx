import type { Metadata } from "next";
import { RetailerRegistrationProfileEditor } from "@/components/features/settings/retailer-registration-profile-editor";

export const metadata: Metadata = {
  title: "Edit Registration Profile | Retail Dashboard",
  description:
    "Update the registration profile connected to your retail account",
};

export default function EditRegistrationProfilePage() {
  return <RetailerRegistrationProfileEditor />;
}
