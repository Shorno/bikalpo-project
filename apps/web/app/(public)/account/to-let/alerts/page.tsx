import type { Metadata } from "next";
import { MyAlertsClient } from "@/components/features/to-let/alerts/my-alerts-client";

export const metadata: Metadata = {
  title: "My To-Let Alert",
  description: "Create and manage your saved To-Let search alerts.",
};

export default function MyToLetAlertsPage() {
  return <MyAlertsClient />;
}
