import { redirect } from "next/navigation";

export default function SupplyOrdersRedirectPage() {
  redirect("/warehouse/dashboard/order-management");
}
