import type { Metadata } from "next";
import { MyPostsClient } from "@/components/features/to-let/property/my-posts-client";

export const metadata: Metadata = {
  title: "My Posts",
  description: "Manage active, paused, booked, and contract To-Let posts.",
};

export default function AccountToLetPostsPage() {
  return <MyPostsClient />;
}
