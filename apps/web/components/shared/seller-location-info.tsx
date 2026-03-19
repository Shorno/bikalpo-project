"use client";

import { MapPin, Navigation } from "lucide-react";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";

const StaticMap = dynamic(
    () => import("@/components/shared/static-map"),
    {
        ssr: false,
        loading: () => (
            <div className="h-[180px] bg-muted animate-pulse rounded-lg" />
        ),
    },
);

// ─── Seller Distance Badge ─────────────────────────────

interface SellerDistanceBadgeProps {
    /** Distance in km */
    distanceKm: number | null | undefined;
    /** Optional class name */
    className?: string;
}

/**
 * Displays seller distance as a small badge.
 * Returns null if distance is not available.
 */
export function SellerDistanceBadge({
    distanceKm,
    className = "",
}: SellerDistanceBadgeProps) {
    if (distanceKm == null) return null;

    const displayDistance =
        distanceKm < 1
            ? `${Math.round(distanceKm * 1000)}m away`
            : `${distanceKm.toFixed(1)}km away`;

    return (
        <Badge
            variant="outline"
            className={`text-xs font-normal gap-1 ${className}`}
        >
            <Navigation className="h-3 w-3 text-blue-500" />
            {displayDistance}
        </Badge>
    );
}

// ─── Delivery Area Info ─────────────────────────────────

interface DeliveryAreaInfoProps {
    /** Seller's latitude */
    shopLat?: string | null;
    /** Seller's longitude */
    shopLng?: string | null;
    /** Areas the seller serves (names) */
    areaNames?: string[];
    /** Seller's address */
    shopAddress?: string | null;
}

/**
 * Shows the seller's delivery area info with optional static map.
 */
export function DeliveryAreaInfo({
    shopLat,
    shopLng,
    areaNames = [],
    shopAddress,
}: DeliveryAreaInfoProps) {
    const hasCoordinates =
        shopLat &&
        shopLng &&
        !isNaN(parseFloat(shopLat)) &&
        !isNaN(parseFloat(shopLng));

    if (!hasCoordinates && areaNames.length === 0 && !shopAddress) return null;

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5 text-gray-700">
                <MapPin className="h-4 w-4 text-emerald-600" />
                Delivery Area
            </h3>

            {/* Area badges */}
            {areaNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {areaNames.map((name) => (
                        <Badge
                            key={name}
                            variant="secondary"
                            className="text-xs"
                        >
                            {name}
                        </Badge>
                    ))}
                </div>
            )}

            {/* Static map showing shop location */}
            {hasCoordinates && (
                <StaticMap
                    lat={shopLat!}
                    lng={shopLng!}
                    zoom={14}
                    height="180px"
                />
            )}

            {/* Address text */}
            {shopAddress && (
                <p className="text-xs text-gray-500 flex items-start gap-1.5">
                    <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                    {shopAddress}
                </p>
            )}
        </div>
    );
}
