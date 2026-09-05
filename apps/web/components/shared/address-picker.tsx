"use client";

import { Crosshair, Loader2, MapPin } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** Resolved address from reverse geocoding */
export interface ResolvedAddress {
    /** Full formatted address */
    displayName: string;
    /** Road / house number */
    road: string;
    /** Neighbourhood / suburb / area */
    area: string;
    /** City / town */
    city: string;
    /** Postal code */
    postalCode: string;
    /** District */
    district: string;
    /** State / division */
    state: string;
}

interface AddressPickerProps {
    /** Current lat value (string) */
    lat?: string | null;
    /** Current lng value (string) */
    lng?: string | null;
    /** Called when user picks a location on the map */
    onLocationChange: (lat: string, lng: string) => void;
    /** Called when reverse geocoding resolves an address from the pin */
    onAddressResolved?: (address: ResolvedAddress) => void;
    /** Optional height for the map container */
    height?: string;
    /** Whether the picker is disabled */
    disabled?: boolean;
}

/** Default center: Dhaka, Bangladesh */
const DEFAULT_CENTER: [number, number] = [23.8103, 90.4125];
const DEFAULT_ZOOM = 13;

/** Reverse geocode using OSM Nominatim (free, no API key) */
async function reverseGeocode(
    lat: number,
    lng: number,
): Promise<ResolvedAddress | null> {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=en`,
            {
                headers: {
                    "User-Agent": "BikalpoApp/1.0",
                },
            },
        );
        if (!res.ok) return null;
        const data = await res.json();
        const addr = data.address || {};

        return {
            displayName: data.display_name || "",
            road: [addr.house_number, addr.road].filter(Boolean).join(" "),
            area:
                addr.neighbourhood ||
                addr.suburb ||
                addr.village ||
                addr.hamlet ||
                "",
            city:
                addr.city ||
                addr.town ||
                addr.county ||
                addr.state_district ||
                "",
            postalCode: addr.postcode || "",
            district: addr.state_district || addr.county || "",
            state: addr.state || "",
        };
    } catch (err) {
        console.error("Reverse geocoding failed:", err);
        return null;
    }
}

export function AddressPicker({
    lat,
    lng,
    onLocationChange,
    onAddressResolved,
    height = "250px",
    disabled = false,
}: AddressPickerProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [isResolving, setIsResolving] = useState(false);
    const [markerPosition, setMarkerPosition] = useState<
        [number, number] | null
    >(null);
    const [addressLabel, setAddressLabel] = useState<string>("");
    const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);

    // Only mount after client-side hydration
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Initialize marker from props
    useEffect(() => {
        if (lat && lng) {
            const parsedLat = parseFloat(lat);
            const parsedLng = parseFloat(lng);
            if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
                setMarkerPosition([parsedLat, parsedLng]);
            }
        }
    }, [lat, lng]);

    /** Handle a location pick — update coords and reverse geocode */
    const handleLocationPick = useCallback(
        async (pickLat: number, pickLng: number) => {
            if (disabled) return;
            setMarkerPosition([pickLat, pickLng]);
            onLocationChange(pickLat.toFixed(6), pickLng.toFixed(6));

            // Reverse geocode to auto-fill address
            setIsResolving(true);
            setAddressLabel("Resolving address...");
            const resolved = await reverseGeocode(pickLat, pickLng);
            setIsResolving(false);

            if (resolved) {
                setAddressLabel(
                    resolved.road || resolved.area || resolved.displayName,
                );
                onAddressResolved?.(resolved);
            } else {
                setAddressLabel(
                    `${pickLat.toFixed(4)}, ${pickLng.toFixed(4)}`,
                );
            }
        },
        [disabled, onLocationChange, onAddressResolved],
    );

    const handleGeolocation = useCallback(() => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser");
            return;
        }

        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;

                // Bangladesh bounding box check
                const inBangladesh =
                    latitude >= 20.5 &&
                    latitude <= 26.7 &&
                    longitude >= 87.9 &&
                    longitude <= 92.7;

                if (!inBangladesh) {
                    alert(
                        "GPS returned a location outside Bangladesh. This can happen with VPN/proxy. Please click the map to pin your location instead.",
                    );
                    setIsLocating(false);
                    return;
                }

                setMarkerPosition([latitude, longitude]);
                setFlyTarget([latitude, longitude]);
                setIsLocating(false);
                handleLocationPick(latitude, longitude);
            },
            (error) => {
                console.error("Geolocation error:", error);
                alert(
                    "Could not get your location. Please allow location access or pick on the map.",
                );
                setIsLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000 },
        );
    }, [handleLocationPick]);

    const center = markerPosition || DEFAULT_CENTER;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                        {isResolving
                            ? "Resolving address..."
                            : addressLabel ||
                              (markerPosition
                                  ? `${markerPosition[0].toFixed(4)}, ${markerPosition[1].toFixed(4)}`
                                  : "Tap the map or use GPS to set your location")}
                    </span>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 shrink-0 ml-2"
                    onClick={handleGeolocation}
                    disabled={isLocating || disabled}
                >
                    {isLocating ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                        <Crosshair className="h-3 w-3" />
                    )}
                    {isLocating ? "Locating..." : "Use GPS"}
                </Button>
            </div>

            <div
                className="relative z-0 overflow-hidden rounded-lg border"
                style={{ height }}
            >
                {isMounted ? (
                    <LeafletMap
                        center={center}
                        markerPosition={markerPosition}
                        flyTarget={flyTarget}
                        disabled={disabled}
                        onLocationPick={handleLocationPick}
                    />
                ) : (
                    <div
                        className="bg-muted animate-pulse flex items-center justify-center text-sm text-muted-foreground"
                        style={{ height: "100%" }}
                    >
                        Loading map...
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Inner Leaflet map component — only rendered client-side after mount.
 * All Leaflet imports happen lazily inside this component.
 */
function LeafletMap({
    center,
    markerPosition,
    flyTarget,
    disabled,
    onLocationPick,
}: {
    center: [number, number];
    markerPosition: [number, number] | null;
    flyTarget: [number, number] | null;
    disabled: boolean;
    onLocationPick: (lat: number, lng: number) => void;
}) {
    // Lazy import Leaflet + react-leaflet only on client
    const [leafletReady, setLeafletReady] = useState(false);
    const [Components, setComponents] = useState<any>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const L = (await import("leaflet")).default;
            await import("leaflet/dist/leaflet.css");

            // Fix default marker icon
            delete (L.Icon.Default.prototype as any)._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl:
                    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
                iconUrl:
                    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
                shadowUrl:
                    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
            });

            const rl = await import("react-leaflet");
            if (!cancelled) {
                setComponents(rl);
                setLeafletReady(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    if (!leafletReady || !Components) {
        return (
            <div
                className="bg-muted animate-pulse flex items-center justify-center text-sm text-muted-foreground"
                style={{ height: "100%" }}
            >
                Loading map...
            </div>
        );
    }

    const {
        MapContainer,
        TileLayer,
        Marker,
        useMap,
        useMapEvents,
    } = Components;

    return (
        <MapContainer
            center={center}
            zoom={DEFAULT_ZOOM}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
            zoomControl={false}
        >
            <TileLayer
                attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {!disabled && (
                <ClickHandler
                    useMapEvents={useMapEvents}
                    onLocationPick={onLocationPick}
                />
            )}
            <FlyHandler useMap={useMap} position={flyTarget} />
            {markerPosition && <Marker position={markerPosition} />}
        </MapContainer>
    );
}

/** Map click handler — receives useMapEvents as prop to avoid top-level import */
function ClickHandler({
    useMapEvents,
    onLocationPick,
}: {
    useMapEvents: any;
    onLocationPick: (lat: number, lng: number) => void;
}) {
    useMapEvents({
        click(e: any) {
            onLocationPick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

/** Fly-to handler — receives useMap as prop */
function FlyHandler({
    useMap,
    position,
}: {
    useMap: any;
    position: [number, number] | null;
}) {
    const map = useMap();
    useEffect(() => {
        if (position) {
            map.flyTo(position, 16, { duration: 1.2 });
        }
    }, [map, position]);
    return null;
}
