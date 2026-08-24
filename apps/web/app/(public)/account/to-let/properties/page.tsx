import type { Metadata } from "next";
import { MyPropertiesClient } from "@/components/features/to-let/property/my-properties-client";

export const metadata: Metadata = {
  title: "My Properties",
};

export default function AccountToLetPropertiesPage() {
  return <MyPropertiesClient />;
}
