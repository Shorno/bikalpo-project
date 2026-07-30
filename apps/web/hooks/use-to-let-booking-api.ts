"use client";

import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";

export type ToLetBookingStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled";

export interface ToLetBookingRequestView {
  bookingCode: string;
  status: ToLetBookingStatus;
  contactName: string;
  contactPhone: string;
  desiredMoveInDate: string | null;
  message: string | null;
  responseNote: string | null;
  createdAt: string;
  respondedAt: string | null;
  cancelledAt: string | null;
  offerSnapshot: {
    version: number;
    capturedAt: string;
    listingCode: string;
    title: string;
    description: string | null;
    monthlyRent: number | null;
    advanceAmount: number | null;
    securityDeposit: number | null;
    serviceCharge: number | null;
    serviceChargeIncluded: boolean;
    parkingCharge: number | null;
    parkingChargeIncluded: boolean;
    utilityCharge: number | null;
    utilityChargeIncluded: boolean;
    availableFrom: string;
    preferredTenant: "family" | "bachelor" | "office" | "female" | "any";
    hasInternet: boolean;
    otherFacilities: string | null;
    imageUrl: string | null;
    property: {
      propertyCode: string;
      name: string;
      location: string;
      description: string | null;
      facilities: {
        hasParking: boolean;
        hasLift: boolean;
        hasSecurityGuard: boolean;
        hasCctv: boolean;
        hasGenerator: boolean;
        hasWaterSupply: boolean;
        hasGasConnection: boolean;
        hasElectricity: boolean;
      } | null;
    };
    unit: {
      unitCode: string;
      name: string;
      unitType: string;
      floorNumber: number;
      sizeSqFt: number;
      bedrooms: number;
      bathrooms: number;
      balconies: number;
      hasDrawingRoom?: boolean;
      hasDiningSpace?: boolean;
      hasKitchen?: boolean;
      isFurnished?: boolean;
      description?: string | null;
      imageUrls?: string[];
    };
    ownerContact: {
      name: string;
      phone: string;
    };
  };
}

export function bookingRequestsFromResponse(
  data: unknown,
): ToLetBookingRequestView[] {
  if (Array.isArray(data)) return data as ToLetBookingRequestView[];
  if (!data || typeof data !== "object") return [];

  const response = data as { bookings?: unknown; requests?: unknown };
  const rows = response.bookings ?? response.requests;
  return Array.isArray(rows) ? (rows as ToLetBookingRequestView[]) : [];
}

export function useMyToLetBookings() {
  return useQuery(orpc.toLetBooking.listMine.queryOptions());
}

export function useOwnerToLetBookingRequests(
  propertyCode?: string,
  unitCode?: string,
) {
  return useQuery(
    orpc.toLetBooking.listOwnerForUnit.queryOptions({
      input: propertyCode && unitCode ? { propertyCode, unitCode } : skipToken,
    }),
  );
}

export function useCancelMyToLetBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpc.toLetBooking.cancelMine.mutationOptions(),
    onSuccess: () => {
      toast.success("Booking request cancelled");
      queryClient.invalidateQueries({
        queryKey: orpc.toLetBooking.listMine.key(),
      });
    },
    onError: (error) => toast.error(error.message),
  });
}

function invalidateOwnerBookingContext(
  queryClient: ReturnType<typeof useQueryClient>,
  variables: { propertyCode: string; unitCode: string },
) {
  queryClient.invalidateQueries({
    queryKey: orpc.toLetBooking.listOwnerForUnit.key({
      input: {
        propertyCode: variables.propertyCode,
        unitCode: variables.unitCode,
      },
    }),
  });
  queryClient.invalidateQueries({
    queryKey: orpc.toLetProperty.getMine.key({
      input: { propertyCode: variables.propertyCode },
    }),
  });
  queryClient.invalidateQueries({
    queryKey: orpc.toLetUnitListing.getForUnit.key({
      input: {
        propertyCode: variables.propertyCode,
        unitCode: variables.unitCode,
      },
    }),
  });
  queryClient.invalidateQueries({
    queryKey: orpc.toLetBooking.listMine.key(),
  });
}

export function useAcceptToLetBookingRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpc.toLetBooking.accept.mutationOptions(),
    onSuccess: (_data, variables) => {
      toast.success("Booking request accepted and Unit booked");
      invalidateOwnerBookingContext(queryClient, variables);
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useRejectToLetBookingRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpc.toLetBooking.reject.mutationOptions(),
    onSuccess: (_data, variables) => {
      toast.success("Booking request rejected");
      invalidateOwnerBookingContext(queryClient, variables);
    },
    onError: (error) => toast.error(error.message),
  });
}
