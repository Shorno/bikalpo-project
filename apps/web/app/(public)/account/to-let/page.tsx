import type { Metadata } from "next";
import { MyBookingsClient } from "@/components/features/to-let/booking/my-bookings-client";

export const metadata: Metadata = {
  title: "My Bookings",
  description: "Track To-Let booking requests and rental history.",
};

export default function AccountToLetPage() {
  return <MyBookingsClient />;
}
