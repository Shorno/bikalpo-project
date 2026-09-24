"use client";

import { DoorOpen, MessageSquareText } from "lucide-react";
import Link from "next/link";
import {
  bookingRequestsFromResponse,
  useMyToLetBookings,
} from "@/hooks/use-to-let-booking-api";

const actionClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/20 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function TenantRentalActions({ listingCode }: { listingCode: string }) {
  const { data } = useMyToLetBookings();
  const rental = bookingRequestsFromResponse(data).find(
    (booking) =>
      booking.offerSnapshot.listingCode === listingCode &&
      (booking.rentalSummary?.status === "active" ||
        booking.rentalSummary?.status === "leaving"),
  );
  if (!rental) return null;

  const bookingHref = `/account/to-let/bookings/${rental.bookingCode}`;
  return (
    <>
      <Link href={bookingHref} className={actionClassName}>
        <DoorOpen className="size-4" aria-hidden="true" />
        Leave
      </Link>
      <Link href={`${bookingHref}#rental-comments`} className={actionClassName}>
        <MessageSquareText className="size-4" aria-hidden="true" />
        Comment
      </Link>
    </>
  );
}
