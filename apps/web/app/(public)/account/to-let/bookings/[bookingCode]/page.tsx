import type { Metadata } from "next";
import { BookingDetailsClient } from "@/components/features/to-let/booking/booking-details-client";

export const metadata: Metadata = {
  title: "Rental Details",
  description: "Review a To-Let booking request and its captured rental offer.",
};

export default async function BookingDetailsPage({
  params,
}: {
  params: Promise<{ bookingCode: string }>;
}) {
  const { bookingCode } = await params;
  return <BookingDetailsClient bookingCode={bookingCode} />;
}
