"use client";

import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";

export interface ToLetRentalContractView {
  contractCode: string;
  status: "active" | "leaving" | "completed";
  startDate: string;
  endDate: string;
  rentDueDay: number;
  monthlyRent: number;
  advanceAmount: number;
  securityDeposit: number;
  serviceCharge: number;
  parkingCharge: number;
  utilityCharge: number;
  activatedAt: string;
  leaveRequestedAt: string | null;
  accessEndsAt: string | null;
  completedAt: string | null;
  unitStatus: "vacant" | "booked" | "occupied" | "inactive";
  payments: Array<{
    cycleMonth: string;
    dueDate: string;
    amount: number;
    referenceName: string | null;
    status: "pending" | "paid";
    verifiedAt: string | null;
    otp: string | null;
  }>;
  comments: Array<{
    id: string;
    body: string;
    rating: number | null;
    isMine: boolean;
    createdAt: string;
  }>;
}

export function rentalFromResponse(
  data: unknown,
): ToLetRentalContractView | null {
  if (!data || typeof data !== "object" || !("contract" in data)) return null;
  const contract = (data as { contract?: unknown }).contract;
  return contract && typeof contract === "object"
    ? (contract as ToLetRentalContractView)
    : null;
}

export function useToLetRental(bookingCode?: string) {
  return useQuery({
    ...orpc.toLetRental.getForBooking.queryOptions({
      input: bookingCode ? { bookingCode } : skipToken,
    }),
    retry: false,
  });
}

function invalidateRentalContext(
  queryClient: ReturnType<typeof useQueryClient>,
  bookingCode: string,
) {
  queryClient.invalidateQueries({
    queryKey: orpc.toLetRental.getForBooking.key({ input: { bookingCode } }),
  });
  queryClient.invalidateQueries({ queryKey: orpc.toLetBooking.listMine.key() });
}

export function useActivateToLetContract() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.toLetRental.activate.mutationOptions(),
    onSuccess: (_data, variables) => {
      toast.success("Rental contract activated and Unit occupied");
      invalidateRentalContext(queryClient, variables.bookingCode);
      queryClient.invalidateQueries({
        queryKey: orpc.toLetProperty.getMine.key({
          input: { propertyCode: variables.propertyCode },
        }),
      });
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useVerifyToLetRentPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.toLetRental.verifyPayment.mutationOptions(),
    onSuccess: (_data, variables) => {
      toast.success("Rent payment confirmed");
      invalidateRentalContext(queryClient, variables.bookingCode);
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useRequestToLetLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.toLetRental.requestLeave.mutationOptions(),
    onSuccess: (_data, variables) => {
      toast.success("Leave scheduled and rental alert created");
      invalidateRentalContext(queryClient, variables.bookingCode);
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useCreateToLetAlert() {
  return useMutation({
    ...orpc.toLetRental.createAlert.mutationOptions(),
    onSuccess: () => toast.success("To-Let alert created"),
    onError: (error) => toast.error(error.message),
  });
}

export function useAddToLetRentalComment() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.toLetRental.addComment.mutationOptions(),
    onSuccess: (_data, variables) => {
      toast.success("Comment added");
      invalidateRentalContext(queryClient, variables.bookingCode);
    },
    onError: (error) => toast.error(error.message),
  });
}
