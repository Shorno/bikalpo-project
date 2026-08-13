"use client";

import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export function useMyToLetProperties(enabled = true) {
  return useQuery({
    ...orpc.toLetProperty.listMine.queryOptions(),
    enabled,
  });
}

export function useToLetPropertyNavigation() {
  const { data: session } = authClient.useSession();
  const isConsumer = session?.user?.role === "consumer";
  const propertiesQuery = useMyToLetProperties(isConsumer);
  const propertyCount = propertiesQuery.data?.properties.length ?? 0;
  const needsRegistration =
    isConsumer && propertiesQuery.isSuccess && propertyCount === 0;

  return {
    href: needsRegistration
      ? "/account/to-let/properties/new"
      : "/account/to-let/properties",
    label: needsRegistration ? "Property Registration" : "My Properties",
    description: needsRegistration
      ? "Register your property to start using To-Let"
      : "View your properties and manage To-Let spaces",
  };
}

export function useMyToLetProperty(propertyCode?: string) {
  return useQuery(
    orpc.toLetProperty.getMine.queryOptions({
      input: propertyCode ? { propertyCode } : skipToken,
    }),
  );
}

export function useCreateToLetProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpc.toLetProperty.create.mutationOptions(),
    onSuccess: () => {
      toast.success("Property registered successfully");
      queryClient.invalidateQueries({
        queryKey: orpc.toLetProperty.listMine.key(),
      });
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useUpdateToLetProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpc.toLetProperty.update.mutationOptions(),
    onSuccess: (_data, variables) => {
      toast.success("Property updated successfully");
      queryClient.invalidateQueries({
        queryKey: orpc.toLetProperty.listMine.key(),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.toLetProperty.getMine.key({
          input: { propertyCode: variables.propertyCode },
        }),
      });
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useArchiveToLetProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpc.toLetProperty.archiveProperty.mutationOptions(),
    onSuccess: () => {
      toast.success("Property registration deleted");
      queryClient.invalidateQueries({
        queryKey: orpc.toLetProperty.listMine.key(),
      });
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useCreateToLetUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpc.toLetProperty.createUnit.mutationOptions(),
    onSuccess: (_data, variables) => {
      toast.success("Unit created successfully");
      queryClient.invalidateQueries({
        queryKey: orpc.toLetProperty.listMine.key(),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.toLetProperty.getMine.key({
          input: { propertyCode: variables.propertyCode },
        }),
      });
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useUpdateToLetUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpc.toLetProperty.updateUnit.mutationOptions(),
    onSuccess: (_data, variables) => {
      toast.success("Unit updated successfully");
      queryClient.invalidateQueries({
        queryKey: orpc.toLetProperty.getMine.key({
          input: { propertyCode: variables.propertyCode },
        }),
      });
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useArchiveToLetUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpc.toLetProperty.archiveUnit.mutationOptions(),
    onSuccess: (_data, variables) => {
      toast.success("Unit removed");
      queryClient.invalidateQueries({
        queryKey: orpc.toLetProperty.listMine.key(),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.toLetProperty.getMine.key({
          input: { propertyCode: variables.propertyCode },
        }),
      });
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useMyToLetUnitListing(
  propertyCode?: string,
  unitCode?: string,
) {
  return useQuery(
    orpc.toLetUnitListing.getForUnit.queryOptions({
      input: propertyCode && unitCode ? { propertyCode, unitCode } : skipToken,
    }),
  );
}

function invalidateUnitListingQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  variables: { propertyCode: string; unitCode: string },
) {
  queryClient.invalidateQueries({
    queryKey: orpc.toLetUnitListing.getForUnit.key({
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
    queryKey: orpc.toLetProperty.listMine.key(),
  });
}

export function useCreateToLetUnitListing() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.toLetUnitListing.create.mutationOptions(),
    onSuccess: (_data, variables) => {
      toast.success("Listing draft saved");
      invalidateUnitListingQueries(queryClient, variables);
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useUpdateToLetUnitListing() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.toLetUnitListing.update.mutationOptions(),
    onSuccess: (_data, variables) => {
      toast.success("Listing updated");
      invalidateUnitListingQueries(queryClient, variables);
    },
    onError: (error) => toast.error(error.message),
  });
}

export function usePublishToLetUnitListing() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.toLetUnitListing.publish.mutationOptions(),
    onSuccess: (_data, variables) => {
      toast.success("Listing published successfully");
      invalidateUnitListingQueries(queryClient, variables);
    },
    onError: (error) => toast.error(error.message),
  });
}

export function usePauseToLetUnitListing() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.toLetUnitListing.pause.mutationOptions(),
    onSuccess: (_data, variables) => {
      toast.success("Listing unpublished");
      invalidateUnitListingQueries(queryClient, variables);
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useMarkToLetUnitRented() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.toLetUnitListing.markRented.mutationOptions(),
    onSuccess: (_data, variables) => {
      toast.success("Unit marked as rented");
      invalidateUnitListingQueries(queryClient, variables);
      queryClient.invalidateQueries({
        queryKey: orpc.toLetBooking.listOwnerForUnit.key({
          input: {
            propertyCode: variables.propertyCode,
            unitCode: variables.unitCode,
          },
        }),
      });
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useReactivateToLetUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.toLetUnitListing.reactivateUnit.mutationOptions(),
    onSuccess: (_data, variables) => {
      toast.success("Unit is vacant and ready to re-list");
      invalidateUnitListingQueries(queryClient, variables);
    },
    onError: (error) => toast.error(error.message),
  });
}
