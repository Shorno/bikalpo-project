"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, Loader2, MapPin } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    MapContainer,
    Marker,
    TileLayer,
    useMap,
    useMapEvents,
} from "react-leaflet";
import { Button } from "@/components/ui/button";

// Fix default marker icon for webpack/Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface AddressPickerProps {
    /** Current lat value (string) */
    lat?: string | null;
    /** Current lng value (string) */
    lng?: string | null;
    /** Called when user picks a location on the map */
    onLocationChange: (lat: string, lng: string) => void;
    /** Optional height for the map container */
    height?: string;
    /** Whether the picker is disabled */
    disabled?: boolean;
}

/** Default center: Dhaka, Bangladesh */
const DEFAULT_CENTER: [number, number] = [23.8103, 90.4125];
const DEFAULT_ZOOM = 13;

/** Inner component that handles map click events */
function MapClickHandler({
    onLocationChange,
}: {
    onLocationChange: (lat: number, lng: number) => void;
}) {
    useMapEvents({
        click(e) {
            onLocationChange(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

/** Inner component that flies to a location */
function FlyToLocation({ position }: { position: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (position) {
            map.flyTo(position, 16, { duration: 1.2 });
        }
    }, [map, position]);
    return null;
}

export function AddressPicker({
    lat,
    lng,
    onLocationChange,
    height = "250px",
    disabled = false,
}: AddressPickerProps) {
    const [isLocating, setIsLocating] = useState(false);
    const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(
        null,
    );
    const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);

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

    const handleMapClick = useCallback(
        (clickLat: number, clickLng: number) => {
            if (disabled) return;
            setMarkerPosition([clickLat, clickLng]);
            onLocationChange(clickLat.toFixed(6), clickLng.toFixed(6));
        },
        [disabled, onLocationChange],
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
                setMarkerPosition([latitude, longitude]);
                setFlyTarget([latitude, longitude]);
                onLocationChange(latitude.toFixed(6), longitude.toFixed(6));
                setIsLocating(false);
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
    }, [onLocationChange]);

    const center = markerPosition || DEFAULT_CENTER;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>
                        {markerPosition
                            ? `${markerPosition[0].toFixed(4)}, ${markerPosition[1].toFixed(4)}`
                            : "Tap the map or use GPS to set your location"}
                    </span>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
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
                className="rounded-lg overflow-hidden border"
                style={{ height }}
            >
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
                        <MapClickHandler onLocationChange={handleMapClick} />
                    )}
                    <FlyToLocation position={flyTarget} />
                    {markerPosition && <Marker position={markerPosition} />}
                </MapContainer>
            </div>
        </div>
    );
}
