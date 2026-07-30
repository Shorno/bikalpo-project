"use client";

import { Archive, Bath, BedDouble, Layers3, Maximize2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useArchiveToLetUnit } from "@/hooks/use-to-let-property-api";
import { UnitStatusBadge } from "./property-ui";
import { humanize, type ToLetUnitView } from "./types";

export function UnitCard({
  propertyCode,
  unit,
}: {
  propertyCode: string;
  unit: ToLetUnitView;
}) {
  const imageUrl = unit.imageUrls[0] || "/placeholder-image.svg";
  const removeUnit = useArchiveToLetUnit();

  const remove = async () => {
    try {
      await removeUnit.mutateAsync({ propertyCode, unitCode: unit.unitCode });
    } catch {
      // The mutation hook shows the API error.
    }
  };

  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="relative aspect-video bg-gray-100">
        <Image
          src={imageUrl}
          alt={`${unit.name} unit`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
          unoptimized={imageUrl.startsWith("http")}
        />
        <div className="absolute right-3 top-3">
          <UnitStatusBadge status={unit.status} />
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-900">{unit.name}</h3>
            <p className="mt-0.5 font-mono text-xs text-gray-500">
              {unit.unitCode}
            </p>
          </div>
          <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
            {humanize(unit.unitType)}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            <Layers3 className="size-3.5 text-gray-400" /> Floor{" "}
            {unit.floorNumber}
          </span>
          <span className="flex items-center gap-1.5">
            <Maximize2 className="size-3.5 text-gray-400" /> {unit.sizeSqFt} sq
            ft
          </span>
          <span className="flex items-center gap-1.5">
            <BedDouble className="size-3.5 text-gray-400" /> {unit.bedrooms} bed
          </span>
          <span className="flex items-center gap-1.5">
            <Bath className="size-3.5 text-gray-400" /> {unit.bathrooms} bath
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            asChild
            className={unit.status === "vacant" ? undefined : "sm:col-span-2"}
          >
            <Link
              href={`/account/to-let/properties/${propertyCode}/units/${unit.unitCode}`}
            >
              View Details
            </Link>
          </Button>
          {unit.status === "vacant" ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Archive className="size-4" /> Remove Unit
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove {unit.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Any current Listing will be closed and pending requests
                    rejected. The Unit disappears from this active list, while
                    its permanent ID and history remain preserved.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={removeUnit.isPending}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={removeUnit.isPending}
                    onClick={() => void remove()}
                  >
                    {removeUnit.isPending ? "Removing…" : "Remove Unit"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </div>
    </article>
  );
}
