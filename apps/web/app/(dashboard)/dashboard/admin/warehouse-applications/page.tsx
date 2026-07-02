import { redirect } from "next/navigation";

export const metadata = {
  title: "Warehouse Applications | Admin",
  description: "Review and manage warehouse applications",
};

export default function WarehouseApplicationsPage() {
  redirect("/dashboard/admin/applications");
}
