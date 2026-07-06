import { redirect } from "next/navigation";

export const metadata = {
  title: "Seller Applications | Admin",
  description: "Review and manage seller applications",
};

export default function SellerApplicationsPage() {
  redirect("/dashboard/admin/applications");
}
