"use client";

/**
 * StaticMap — Read-only Leaflet map for displaying a point, polygon, or radius.
 *
 * Used across seller profile, order details, area previews, etc.
 * Uses OpenStreetMap tiles (free, no API key needed).
 * Must be dynamically imported because Leaflet requires `window`.
 */

import { MapContainer, TileLayer, Polygon, Marker, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface StaticMapProps {
    /** Center latitude */
    lat?: string | number | null;
    /** Center longitude */
    lng?: string | number | null;
    /** Polygon coordinates in GeoJSON format [[[lng, lat], ...]] */
    polygon?: number[][][] | null;
    /** Radius for circle display (in km) */
    radiusKm?: string | number | null;
    /** Map height */
    height?: string;
    /** Zoom level */
    zoom?: number;
    /** Polygon color */
    polygonColor?: string;
}

export default function StaticMap({
    lat,
    lng,
    polygon,
    radiusKm,
    height = "250px",
    zoom = 13,
    polygonColor = "#3b82f6",
}: StaticMapProps) {
    const parsedLat = typeof lat === "string" ? parseFloat(lat) : (lat ?? 23.8103);
    const parsedLng = typeof lng === "string" ? parseFloat(lng) : (lng ?? 90.4125);
    const parsedRadius =
        (typeof radiusKm === "string" ? parseFloat(radiusKm) : (radiusKm ?? 0)) * 1000;

    // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
    const polygonPositions: [number, number][] | null = polygon?.[0]
        ? polygon[0].map(([pLng, pLat]) => [pLat!, pLng!] as [number, number])
        : null;

    const center: [number, number] = [parsedLat, parsedLng];

    return (
        <div className="rounded-lg border overflow-hidden" style={{ height }}>
            <MapContainer
                center={center}
                zoom={zoom}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={false}
                dragging={false}
                zoomControl={false}
                doubleClickZoom={false}
                attributionControl={false}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Center marker */}
                <Marker position={center} />

                {/* Polygon */}
                {polygonPositions && polygonPositions.length >= 3 && (
                    <Polygon
                        positions={polygonPositions}
                        pathOptions={{
                            color: polygonColor,
                            weight: 2,
                            fillColor: polygonColor,
                            fillOpacity: 0.15,
                        }}
                    />
                )}

                {/* Radius circle */}
                {parsedRadius > 0 && (
                    <Circle
                        center={center}
                        radius={parsedRadius}
                        pathOptions={{
                            color: "#10b981",
                            weight: 2,
                            fillColor: "#10b981",
                            fillOpacity: 0.1,
                        }}
                    />
                )}
            </MapContainer>
        </div>
    );
}
