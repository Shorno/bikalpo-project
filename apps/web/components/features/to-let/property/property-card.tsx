import { Building2, MapPin, Settings2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PropertyStatusBadge } from "./property-ui";
import { humanize, type ToLetPropertyView } from "./types";

export function PropertyCard({ property }: { property: ToLetPropertyView }) {
  const unitCount = property.unitCount ?? property.units?.length ?? 0;
  const imageUrl = property.coverImageUrl || "/placeholder-image.svg";

  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="relative aspect-[16/7] bg-gray-100">
        <Image
          src={imageUrl}
          alt={`${property.name} cover`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
          unoptimized={imageUrl.startsWith("http")}
        />
        <div className="absolute right-3 top-3">
          <PropertyStatusBadge status={property.status} />
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <Building2 className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold text-gray-900">
              {property.name}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-gray-500">
              {property.propertyCode}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm text-gray-600">
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-gray-400" />
            <span className="line-clamp-2">
              {property.area}, {property.district}, {property.division}
            </span>
          </p>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
            <span>{humanize(property.propertyType)}</span>
            <span className="font-medium text-gray-900">
              {unitCount} of {property.declaredTotalUnits} units created
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          asChild
          className="mt-4 w-full hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
        >
          <Link href={`/account/to-let/properties/${property.propertyCode}`}>
            <Settings2 />
            Manage Property
          </Link>
        </Button>
      </div>
    </article>
  );
}
