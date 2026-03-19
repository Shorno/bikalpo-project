"use client";

/**
 * AreaPolygonEditor — Interactive Leaflet map for drawing and editing area polygons.
 *
 * Features:
 * - Draw polygons by clicking on the map
 * - Edit existing polygon shapes
 * - Delete polygons
 * - Export GeoJSON coordinates for saving to DB
 * - Set center point by clicking (when no polygon mode)
 *
 * Uses OpenStreetMap tiles (free, no API key needed).
 * Must be dynamically imported because Leaflet requires `window`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
    MapContainer,
    TileLayer,
    Polygon,
    Marker,
    Circle,
    useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon issue in webpack/next.js
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

interface AreaPolygonEditorProps {
    /** Existing polygon coordinates [[[lng, lat], ...]] (GeoJSON format) */
    polygon?: number[][][] | null;
    /** Center point latitude */
    centerLat?: string | null;
    /** Center point longitude */
    centerLng?: string | null;
    /** Radius in km (for circle display) */
    radiusKm?: string | null;
    /** Called when polygon changes */
    onPolygonChange?: (coords: number[][][] | null) => void;
    /** Called when center point changes */
    onCenterChange?: (lat: string, lng: string) => void;
    /** Map height */
    height?: string;
    /** Read-only mode */
    readOnly?: boolean;
}

/** Click handler component to add points to polygon or set center */
function MapClickHandler({
    drawing,
    points,
    onAddPoint,
    onSetCenter,
}: {
    drawing: boolean;
    points: [number, number][];
    onAddPoint: (latlng: [number, number]) => void;
    onSetCenter: (latlng: [number, number]) => void;
}) {
    useMapEvents({
        click(e) {
            if (drawing) {
                onAddPoint([e.latlng.lat, e.latlng.lng]);
            } else {
                onSetCenter([e.latlng.lat, e.latlng.lng]);
            }
        },
    });
    return null;
}

export default function AreaPolygonEditor({
    polygon,
    centerLat,
    centerLng,
    radiusKm,
    onPolygonChange,
    onCenterChange,
    height = "400px",
    readOnly = false,
}: AreaPolygonEditorProps) {
    // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
    const initialPoints: [number, number][] = polygon?.[0]
        ? polygon[0].map(([lng, lat]) => [lat!, lng!] as [number, number])
        : [];

    const [points, setPoints] = useState<[number, number][]>(initialPoints);
    const [drawing, setDrawing] = useState(false);
    const [center, setCenter] = useState<[number, number]>([
        parseFloat(centerLat || "23.8103"),
        parseFloat(centerLng || "90.4125"),
    ]);
    const radius = parseFloat(radiusKm || "0") * 1000; // km to meters

    // Default map center: use centerLat/centerLng, or first polygon point, or Dhaka
    const mapCenter: [number, number] = centerLat && centerLng
        ? [parseFloat(centerLat), parseFloat(centerLng)]
        : points.length > 0
          ? points[0]!
          : [23.8103, 90.4125]; // Default: Dhaka, Bangladesh

    // Notify parent of polygon changes
    const notifyPolygonChange = useCallback(
        (newPoints: [number, number][]) => {
            if (!onPolygonChange) return;
            if (newPoints.length < 3) {
                onPolygonChange(null);
                return;
            }
            // Convert Leaflet [lat, lng] back to GeoJSON [lng, lat]
            const geoJsonCoords = newPoints.map(([lat, lng]) => [lng, lat]);
            // Close the ring (GeoJSON requires first === last)
            if (
                geoJsonCoords.length > 0 &&
                (geoJsonCoords[0]![0] !==
                    geoJsonCoords[geoJsonCoords.length - 1]![0] ||
                    geoJsonCoords[0]![1] !==
                        geoJsonCoords[geoJsonCoords.length - 1]![1])
            ) {
                geoJsonCoords.push([...geoJsonCoords[0]!]);
            }
            onPolygonChange([geoJsonCoords]);
        },
        [onPolygonChange],
    );

    const handleAddPoint = useCallback(
        (latlng: [number, number]) => {
            const newPoints = [...points, latlng];
            setPoints(newPoints);
            notifyPolygonChange(newPoints);
        },
        [points, notifyPolygonChange],
    );

    const handleSetCenter = useCallback(
        (latlng: [number, number]) => {
            if (readOnly) return;
            setCenter(latlng);
            onCenterChange?.(latlng[0].toFixed(6), latlng[1].toFixed(6));
        },
        [readOnly, onCenterChange],
    );

    const handleClearPolygon = () => {
        setPoints([]);
        notifyPolygonChange([]);
    };

    const handleUndoPoint = () => {
        const newPoints = points.slice(0, -1);
        setPoints(newPoints);
        notifyPolygonChange(newPoints);
    };

    return (
        <div className="space-y-2">
            {/* Toolbar */}
            {!readOnly && (
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setDrawing(!drawing)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                            drawing
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background hover:bg-muted border-border"
                        }`}
                    >
                        {drawing ? "✏️ Drawing..." : "🔷 Draw Polygon"}
                    </button>
                    {points.length > 0 && (
                        <>
                            <button
                                type="button"
                                onClick={handleUndoPoint}
                                className="px-3 py-1.5 text-xs font-medium rounded-md border bg-background hover:bg-muted border-border"
                            >
                                ↩ Undo
                            </button>
                            <button
                                type="button"
                                onClick={handleClearPolygon}
                                className="px-3 py-1.5 text-xs font-medium rounded-md border bg-background hover:bg-destructive/10 hover:text-destructive border-border"
                            >
                                🗑 Clear
                            </button>
                        </>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                        {drawing
                            ? `Click map to add points (${points.length} points)`
                            : "Click map to set center point"}
                    </span>
                </div>
            )}

            {/* Map */}
            <div
                className="rounded-lg border overflow-hidden"
                style={{ height }}
            >
                <MapContainer
                    center={mapCenter}
                    zoom={12}
                    style={{ height: "100%", width: "100%" }}
                    scrollWheelZoom={true}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* Click handler */}
                    {!readOnly && (
                        <MapClickHandler
                            drawing={drawing}
                            points={points}
                            onAddPoint={handleAddPoint}
                            onSetCenter={handleSetCenter}
                        />
                    )}

                    {/* Polygon overlay */}
                    {points.length >= 3 && (
                        <Polygon
                            positions={points}
                            pathOptions={{
                                color: "#3b82f6",
                                weight: 2,
                                fillColor: "#3b82f6",
                                fillOpacity: 0.15,
                            }}
                        />
                    )}

                    {/* Polygon points markers (while drawing) */}
                    {drawing &&
                        points.map((p, i) => (
                            <Marker
                                key={`point-${i}`}
                                position={p}
                            />
                        ))}

                    {/* Center marker */}
                    {center && !drawing && (
                        <Marker position={center} />
                    )}

                    {/* Radius circle */}
                    {radius > 0 && center && (
                        <Circle
                            center={center}
                            radius={radius}
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
        </div>
    );
}
