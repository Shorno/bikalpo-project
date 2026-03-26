"use client";

/**
 * AreaPolygonEditor — Interactive Leaflet map for drawing and editing area polygons.
 *
 * Features:
 * - Barikoi address search with autocomplete
 * - Draggable center marker with reverse geocode
 * - Draw polygons by clicking on the map
 * - Radius circle overlay
 * - Set center point by clicking (when not drawing)
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
    useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useBarikoiAutocomplete } from "@/hooks/use-barikoi-autocomplete";
import type { BarikoiPlace } from "@/hooks/use-barikoi-autocomplete";
import { useBarikoiReverseGeocode } from "@/hooks/use-barikoi-reverse-geocode";

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

// Custom draggable center marker icon (blue teardrop)
const centerIcon = L.divIcon({
    className: "custom-center-marker",
    html: `
        <div style="
          width: 32px;
          height: 32px;
          background: #3b82f6;
          border: 3px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 12px rgba(59,130,246,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 8px;
            height: 8px;
            background: white;
            border-radius: 50%;
            transform: rotate(45deg);
          "></div>
        </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
});

export interface AddressInfo {
    address: string;
    area: string;
    district: string;
    division: string;
    postCode: string;
}

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
    /** Called when address is resolved via search or drag */
    onAddressResolved?: (info: AddressInfo) => void;
    /** Map height */
    height?: string;
    /** Read-only mode */
    readOnly?: boolean;
}

/** Fix map rendering in modals — invalidate size after container is fully visible */
function MapInvalidateSize() {
    const map = useMap();
    useEffect(() => {
        // Delay to let the dialog animation finish
        const timer = setTimeout(() => map.invalidateSize(), 300);
        return () => clearTimeout(timer);
    }, [map]);
    return null;
}

/** Recenter map when lat/lng props change */
function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
    const map = useMap();
    const prevRef = useRef({ lat, lng });

    useEffect(() => {
        if (
            !isNaN(lat) && !isNaN(lng) &&
            (prevRef.current.lat !== lat || prevRef.current.lng !== lng)
        ) {
            prevRef.current = { lat, lng };
            map.flyTo([lat, lng], map.getZoom(), { duration: 0.5 });
        }
    }, [lat, lng, map]);

    return null;
}

/** Click handler component to add points to polygon or set center */
function MapClickHandler({
    drawing,
    onAddPoint,
    onSetCenter,
}: {
    drawing: boolean;
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

/** Draggable center marker component */
function DraggableCenterMarker({
    position,
    onDragEnd,
}: {
    position: [number, number];
    onDragEnd: (latlng: [number, number]) => void;
}) {
    const markerRef = useRef<L.Marker>(null);

    const eventHandlers = {
        dragend() {
            const marker = markerRef.current;
            if (marker) {
                const pos = marker.getLatLng();
                onDragEnd([pos.lat, pos.lng]);
            }
        },
    };

    return (
        <Marker
            draggable
            position={position}
            ref={markerRef}
            eventHandlers={eventHandlers}
            icon={centerIcon}
        />
    );
}

export default function AreaPolygonEditor({
    polygon,
    centerLat,
    centerLng,
    radiusKm,
    onPolygonChange,
    onCenterChange,
    onAddressResolved,
    height = "400px",
    readOnly = false,
}: AreaPolygonEditorProps) {
    // ── Barikoi hooks ──
    const { suggestions, isLoading: searchLoading, search, clearSuggestions } =
        useBarikoiAutocomplete();
    const { reverseGeocode } = useBarikoiReverseGeocode();
    const [searchQuery, setSearchQuery] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [resolvedAddress, setResolvedAddress] = useState<AddressInfo | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // ── Polygon state ──
    const initialPoints: [number, number][] = polygon?.[0]
        ? polygon[0].map(([lng, lat]) => [lat!, lng!] as [number, number])
        : [];

    const [points, setPoints] = useState<[number, number][]>(initialPoints);
    const [drawing, setDrawing] = useState(false);

    // ── Center state ──
    const hasCenterProps = !!(centerLat && centerLng);
    const [center, setCenter] = useState<[number, number]>([
        parseFloat(centerLat || "23.8103"),
        parseFloat(centerLng || "90.4125"),
    ]);
    const [hasCenterBeenSet, setHasCenterBeenSet] = useState(hasCenterProps);
    const radius = parseFloat(radiusKm || "0") * 1000;

    // Default map center
    const mapCenter: [number, number] = centerLat && centerLng
        ? [parseFloat(centerLat), parseFloat(centerLng)]
        : points.length > 0
          ? points[0]!
          : [23.8103, 90.4125];

    // ── Close dropdown on outside click ──
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node)
            ) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    // ── Sync center state when parent lat/lng props change ──
    useEffect(() => {
        const lat = parseFloat(centerLat || "");
        const lng = parseFloat(centerLng || "");
        if (!isNaN(lat) && !isNaN(lng)) {
            setCenter([lat, lng]);
            setHasCenterBeenSet(true);
        }
    }, [centerLat, centerLng]);

    // ── Polygon helpers ──
    const notifyPolygonChange = useCallback(
        (newPoints: [number, number][]) => {
            if (!onPolygonChange) return;
            if (newPoints.length < 3) {
                onPolygonChange(null);
                return;
            }
            const geoJsonCoords = newPoints.map(([lat, lng]) => [lng, lat]);
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

    // ── Center helpers ──
    const updateCenter = useCallback(
        (latlng: [number, number]) => {
            setCenter(latlng);
            setHasCenterBeenSet(true);
            onCenterChange?.(latlng[0].toFixed(6), latlng[1].toFixed(6));
        },
        [onCenterChange],
    );

    const handleSetCenter = useCallback(
        (latlng: [number, number]) => {
            if (readOnly) return;
            updateCenter(latlng);
            // Reverse geocode when clicking map to set center
            reverseGeocode(latlng[0], latlng[1]).then((result) => {
                if (result) {
                    const info: AddressInfo = {
                        address: result.address || "",
                        area: result.area || "",
                        district: result.district || "",
                        division: result.division || "",
                        postCode: result.postCode || "",
                    };
                    setResolvedAddress(info);
                    setSearchQuery(result.address || "");
                    onAddressResolved?.(info);
                }
            });
        },
        [readOnly, updateCenter, reverseGeocode, onAddressResolved],
    );

    const handleMarkerDragEnd = useCallback(
        async (latlng: [number, number]) => {
            updateCenter(latlng);
            const result = await reverseGeocode(latlng[0], latlng[1]);
            if (result) {
                const info: AddressInfo = {
                    address: result.address || "",
                    area: result.area || "",
                    district: result.district || "",
                    division: result.division || "",
                    postCode: result.postCode || "",
                };
                setResolvedAddress(info);
                setSearchQuery(result.address || "");
                onAddressResolved?.(info);
            }
        },
        [updateCenter, reverseGeocode, onAddressResolved],
    );

    // ── Search helpers ──
    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        search(value);
        setShowSuggestions(true);
    };

    const handleSelectPlace = (place: BarikoiPlace) => {
        const latlng: [number, number] = [place.latitude, place.longitude];
        setSearchQuery(place.address);
        updateCenter(latlng);
        const info: AddressInfo = {
            address: place.address || "",
            area: place.area || "",
            district: "",
            division: "",
            postCode: String(place.postCode || ""),
        };
        setResolvedAddress(info);
        onAddressResolved?.(info);
        clearSuggestions();
        setShowSuggestions(false);
    };

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
        <div className="space-y-1.5">
            {/* Search Bar */}
            {!readOnly && (
                <div ref={dropdownRef} className="relative z-10">
                    <div className="relative">
                        <svg
                            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.3-4.3" />
                        </svg>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            onFocus={() =>
                                suggestions.length > 0 && setShowSuggestions(true)
                            }
                            placeholder="Search location..."
                            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                        {searchLoading && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
                        )}
                    </div>

                    {/* Suggestions Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute z-[1000] w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {suggestions.map((place) => (
                                <button
                                    key={place.id}
                                    type="button"
                                    onClick={() => handleSelectPlace(place)}
                                    className="w-full px-3 py-2 text-left hover:bg-muted transition-colors flex items-start gap-2 border-b border-border/50 last:border-0"
                                >
                                    <svg
                                        className="h-4 w-4 text-primary mt-0.5 shrink-0"
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                                        <circle cx="12" cy="10" r="3" />
                                    </svg>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">
                                            {place.address}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {place.area}
                                            {place.city ? ` • ${place.city}` : ""}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

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
                            : "Click or drag pin to set center"}
                    </span>
                </div>
            )}

            {/* Map */}
            <div
                className="rounded-lg border overflow-hidden relative z-0"
                style={{ height }}
            >
                <MapContainer
                    center={mapCenter}
                    zoom={12}
                    style={{ height: "100%", width: "100%" }}
                    scrollWheelZoom={true}
                    doubleClickZoom={false}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* Fix tile rendering in modal */}
                    <MapInvalidateSize />

                    {/* Click handler */}
                    {!readOnly && (
                        <MapClickHandler
                            drawing={drawing}
                            onAddPoint={handleAddPoint}
                            onSetCenter={handleSetCenter}
                        />
                    )}

                    {/* Re-center map when props change */}
                    <MapRecenter lat={center[0]} lng={center[1]} />

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

                    {/* Draggable center marker — only shown when explicitly set and not drawing */}
                    {hasCenterBeenSet && !drawing && (
                        readOnly ? (
                            <Marker position={center} icon={centerIcon} />
                        ) : (
                            <DraggableCenterMarker
                                position={center}
                                onDragEnd={handleMarkerDragEnd}
                            />
                        )
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

                {/* Drag instruction overlay */}
                {!readOnly && hasCenterBeenSet && !drawing && (
                    <div className="absolute top-3 left-3 z-[1000] bg-background/90 backdrop-blur-sm px-2.5 py-1 rounded-md shadow-sm border border-border/50">
                        <span className="text-xs text-muted-foreground font-medium">
                            📌 Drag pin to adjust
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
