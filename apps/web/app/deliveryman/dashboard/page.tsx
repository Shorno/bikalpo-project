import { redirect } from "next/navigation";
import { getDeliverySubdomainUrl } from "@/lib/delivery-routing";

export default function LegacyDeliverymanDashboardRedirect() {
  redirect(`${getDeliverySubdomainUrl()}/dashboard`);
}
