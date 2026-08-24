"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

interface RequestBookingButtonProps {
  listingCode: string;
  availableFrom: string;
  minimumDate: string;
  qrToken?: string;
}

export function RequestBookingButton({
  listingCode,
  availableFrom,
  minimumDate,
  qrToken,
}: RequestBookingButtonProps) {
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const queryClient = useQueryClient();
  const createBooking = useMutation(orpc.toLetBooking.create.mutationOptions());
  const idempotencyKey = useRef<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const minimumMoveInDate =
    availableFrom > minimumDate ? availableFrom : minimumDate;
  const isCheckingSession = !isHydrated || isSessionPending;

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const submitBooking = async () => {
    if (isCheckingSession) return;

    if (!session?.user) {
      const redirect = encodeURIComponent(
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
      );
      window.location.assign(`/login?redirect=${redirect}`);
      return;
    }

    const user = session.user as {
      name?: string;
      phoneNumber?: string | null;
      role?: string | null;
    };
    if (user.role !== "consumer") {
      toast.error("A consumer account is required to request a booking");
      return;
    }

    const contactName = user.name?.trim() ?? "";
    const contactPhone = user.phoneNumber?.trim() ?? "";

    if (!contactName) {
      toast.error("Add your name to your account before requesting a booking");
      return;
    }
    if (contactPhone.length < 7 || contactPhone.length > 30) {
      toast.error(
        "Add a valid phone number to your account before requesting a booking",
      );
      return;
    }

    try {
      idempotencyKey.current ??= crypto.randomUUID();
      await createBooking.mutateAsync({
        listingCode,
        ...(qrToken ? { qrToken } : {}),
        idempotencyKey: idempotencyKey.current,
        desiredMoveInDate: minimumMoveInDate,
        contactName,
        contactPhone,
        message: undefined,
      });
      await queryClient.invalidateQueries({
        queryKey: orpc.toLetBooking.listMine.key(),
      });
      idempotencyKey.current = null;
      toast.success("Booking request sent");
      setIsSubmitted(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to send your booking request",
      );
    }
  };

  if (isSubmitted) {
    return (
      <div
        role="status"
        className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">Booking request sent</p>
            <p className="mt-1 text-emerald-800">
              The property owner will review your request.
            </p>
            <Link
              href="/account/to-let"
              className="mt-3 inline-flex font-semibold text-emerald-700 underline underline-offset-4 hover:text-emerald-800"
            >
              View your To-Let account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Button
      type="button"
      onClick={submitBooking}
      disabled={isCheckingSession || createBooking.isPending}
      className="mt-5 h-10 w-full bg-emerald-600 text-white hover:bg-emerald-700"
    >
      {createBooking.isPending ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        <CalendarCheck aria-hidden="true" />
      )}
      {isCheckingSession
        ? "Checking account..."
        : createBooking.isPending
          ? "Sending request..."
          : "Request Booking"}
    </Button>
  );
}
