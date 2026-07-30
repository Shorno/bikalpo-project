"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useMyToLetProperties } from "@/hooks/use-to-let-property-api";
import { PropertyCard } from "./property-card";
import {
  PropertiesListSkeleton,
  PropertyEmptyState,
  PropertyErrorState,
  PropertyPageHeader,
} from "./property-ui";
import type { ToLetPropertyView } from "./types";

function propertyRows(data: unknown): ToLetPropertyView[] {
  if (Array.isArray(data)) return data as ToLetPropertyView[];
  if (data && typeof data === "object" && "properties" in data) {
    const properties = (data as { properties?: unknown }).properties;
    return Array.isArray(properties) ? (properties as ToLetPropertyView[]) : [];
  }
  return [];
}

export function MyPropertiesClient() {
  const query = useMyToLetProperties();

  if (query.isLoading) return <PropertiesListSkeleton />;
  if (query.isError) {
    return <PropertyErrorState onRetry={() => query.refetch()} />;
  }

  const properties = propertyRows(query.data);

  return (
    <div className="space-y-5">
      <PropertyPageHeader
        title="My Properties"
        description="Register properties and manage their reusable physical units."
        action={
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
            <Link href="/account/to-let/properties/new">
              <Plus />
              Register Property
            </Link>
          </Button>
        }
      />

      {properties.length === 0 ? (
        <PropertyEmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {properties.map((property) => (
            <PropertyCard key={property.propertyCode} property={property} />
          ))}
        </div>
      )}
    </div>
  );
}
