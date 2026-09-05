import { redirect } from "next/navigation";

export default function SystemControlPage() {
  redirect("/dashboard/user-roles#operational-controls");
}
