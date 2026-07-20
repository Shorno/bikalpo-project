import { redirect } from "next/navigation";

export default function RetailRiderAssignmentPage() {
  redirect("/dashboard/delivery-team/assignments?view=riders");
}
