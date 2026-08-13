"use client";

import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";

export const toLetAlertCategoryOptions = [
  { value: "any", label: "Any rental type" },
  { value: "family_flat", label: "Family To-Let" },
  { value: "bachelor_room", label: "Bachelor Room" },
  { value: "sublet", label: "Sublet" },
  { value: "shop", label: "Shop" },
  { value: "office", label: "Office" },
  { value: "warehouse", label: "Warehouse" },
  { value: "garage", label: "Garage" },
  { value: "other", label: "Other" },
] as const;

export type ToLetAlertCategory =
  (typeof toLetAlertCategoryOptions)[number]["value"];

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

export interface ToLetRentalAlertView {
  id: string;
  preferredCategory: ToLetAlertCategory;
  preferredLocation: string;
  minimumSizeSqFt: number;
  minimumBedrooms: number;
  minimumBathrooms: number;
  minimumBalconies: number;
  balconyPreference: "required" | "optional" | "not_required";
  preferredFloor: string;
  status: "active" | "paused" | "fulfilled";
  createdAt: string;
  updatedAt: string;
}

function isToLetRentalAlertView(value: unknown): value is ToLetRentalAlertView {
  if (!value || typeof value !== "object") return false;
  const alert = value as Record<string, unknown>;
  const nonNegativeIntegerFields = [
    alert.minimumSizeSqFt,
    alert.minimumBedrooms,
    alert.minimumBathrooms,
    alert.minimumBalconies,
  ];

  return (
    typeof alert.id === "string" &&
    toLetAlertCategoryOptions.some(
      ({ value: category }) => category === alert.preferredCategory,
    ) &&
    typeof alert.preferredLocation === "string" &&
    nonNegativeIntegerFields.every(
      (field) =>
        typeof field === "number" && Number.isInteger(field) && field >= 0,
    ) &&
    (alert.balconyPreference === "required" ||
      alert.balconyPreference === "optional" ||
      alert.balconyPreference === "not_required") &&
    typeof alert.preferredFloor === "string" &&
    (alert.status === "active" ||
      alert.status === "paused" ||
      alert.status === "fulfilled") &&
    typeof alert.createdAt === "string" &&
    typeof alert.updatedAt === "string"
  );
}

export function alertsFromResponse(data: unknown): ToLetRentalAlertView[] {
  if (!data || typeof data !== "object" || !("alerts" in data)) return [];
  const alerts = (data as { alerts?: unknown }).alerts;
  return Array.isArray(alerts) ? alerts.filter(isToLetRentalAlertView) : [];
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
  const queryClient = useQueryClient();

  return useMutation({
    ...orpc.toLetRental.createAlert.mutationOptions(),
    onSuccess: () => {
      toast.success("To-Let alert saved");
      queryClient.invalidateQueries({
        queryKey: orpc.toLetRental.listAlerts.key(),
      });
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useMyToLetAlerts(enabled = true) {
  return useQuery({
    ...orpc.toLetRental.listAlerts.queryOptions(),
    enabled,
    retry: false,
  });
}

export function useUpdateToLetAlertStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpc.toLetRental.updateAlertStatus.mutationOptions(),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.status === "active" ? "Alert resumed" : "Alert paused",
      );
      queryClient.invalidateQueries({
        queryKey: orpc.toLetRental.listAlerts.key(),
      });
    },
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
