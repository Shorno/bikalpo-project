"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

interface RequestBookingDialogProps {
  listingCode: string;
  title: string;
  availableFrom: string;
}

function todayAsIsoDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function RequestBookingDialog({
  listingCode,
  title,
  availableFrom,
}: RequestBookingDialogProps) {
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const queryClient = useQueryClient();
  const createBooking = useMutation(orpc.toLetBooking.create.mutationOptions());
  const idempotencyKey = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [desiredMoveInDate, setDesiredMoveInDate] = useState("");
  const [message, setMessage] = useState("");
  const today = todayAsIsoDate();
  const minimumMoveInDate = availableFrom > today ? availableFrom : today;

  const openBooking = () => {
    if (isSessionPending) return;

    if (!session?.user) {
      const redirect = encodeURIComponent(window.location.pathname);
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

    setContactName((current) => current || user.name || "");
    setContactPhone((current) => current || user.phoneNumber || "");

    setOpen(true);
  };

  const submitBooking = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = contactName.trim();
    const trimmedPhone = contactPhone.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName) {
      toast.error("Enter your contact name");
      return;
    }
    if (trimmedPhone.length < 7 || trimmedPhone.length > 30) {
      toast.error("Enter a contact phone number between 7 and 30 characters");
      return;
    }
    if (!desiredMoveInDate || desiredMoveInDate < minimumMoveInDate) {
      toast.error(`Choose a date on or after ${minimumMoveInDate}`);
      return;
    }
    if (trimmedMessage.length > 1000) {
      toast.error("Your message cannot exceed 1000 characters");
      return;
    }

    try {
      idempotencyKey.current ??= crypto.randomUUID();
      await createBooking.mutateAsync({
        listingCode,
        idempotencyKey: idempotencyKey.current,
        desiredMoveInDate,
        contactName: trimmedName,
        contactPhone: trimmedPhone,
        message: trimmedMessage || undefined,
      });
      await queryClient.invalidateQueries({
        queryKey: orpc.toLetBooking.listMine.key(),
      });
      idempotencyKey.current = null;
      toast.success("Booking request sent");
      setOpen(false);
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
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
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
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        onClick={openBooking}
        disabled={isSessionPending}
        className="mt-5 h-10 w-full bg-emerald-600 text-white hover:bg-emerald-700"
      >
        <CalendarCheck />
        {isSessionPending ? "Checking account..." : "Request Booking"}
      </Button>

      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Request a booking</DialogTitle>
          <DialogDescription>
            Send a request for {title}. The owner will review it before any
            booking is confirmed.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={submitBooking}>
          <div className="space-y-2">
            <Label htmlFor="booking-contact-name">Contact name</Label>
            <Input
              id="booking-contact-name"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              autoComplete="name"
              required
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="booking-contact-phone">Contact phone</Label>
            <Input
              id="booking-contact-phone"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
              autoComplete="tel"
              inputMode="tel"
              minLength={7}
              maxLength={30}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="booking-move-in-date">Desired move-in date</Label>
            <Input
              id="booking-move-in-date"
              type="date"
              value={desiredMoveInDate}
              onChange={(event) => setDesiredMoveInDate(event.target.value)}
              min={minimumMoveInDate}
              required
            />
            <p className="text-xs text-gray-500">
              This unit is available from {availableFrom}.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="booking-message">Message (optional)</Label>
            <Textarea
              id="booking-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Introduce yourself or share any questions for the owner."
            />
            <p className="text-right text-xs text-gray-500">
              {message.length}/1000
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createBooking.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={createBooking.isPending}
            >
              {createBooking.isPending ? (
                <Loader2 className="animate-spin" />
              ) : null}
              Send request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
