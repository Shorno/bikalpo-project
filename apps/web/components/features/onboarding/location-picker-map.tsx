"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useBarikoiReverseGeocode } from "@/hooks/use-barikoi-reverse-geocode";

interface LocationPickerMapProps {
  latitude: number;
  longitude: number;
  onPositionChange: (
    lat: number,
    lng: number,
    addressInfo?: {
      address: string;
      addressBn: string;
      area: string;
      district: string;
      division: string;
      postCode: string;
    }
  ) => void;
}

export function LocationPickerMap({
  latitude,
  longitude,
  onPositionChange,
}: LocationPickerMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const { reverseGeocode } = useBarikoiReverseGeocode();

  // Create custom marker icon
  const createIcon = () => {
    return L.divIcon({
      className: "custom-marker",
      html: `
        <div style="
          width: 36px;
          height: 36px;
          background: #003178;
          border: 3px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 12px rgba(0,49,120,0.4);
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
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    });
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map
    const map = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom: 15,
      zoomControl: false,
    });

    // Add zoom control to bottom right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(map);

    // Add draggable marker
    const marker = L.marker([latitude, longitude], {
      draggable: true,
      icon: createIcon(),
    }).addTo(map);

    // Handle marker drag
    marker.on("dragend", async () => {
      const pos = marker.getLatLng();
      const result = await reverseGeocode(pos.lat, pos.lng);
      if (result) {
        onPositionChange(pos.lat, pos.lng, {
          address: result.address || "",
          addressBn: result.address_bn || "",
          area: result.area || "",
          district: result.district || "",
          division: result.division || "",
          postCode: result.postCode || "",
        });
      } else {
        onPositionChange(pos.lat, pos.lng);
      }
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker position when lat/lng changes externally (from autocomplete)
  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      const currentPos = markerRef.current.getLatLng();
      if (
        Math.abs(currentPos.lat - latitude) > 0.0001 ||
        Math.abs(currentPos.lng - longitude) > 0.0001
      ) {
        markerRef.current.setLatLng([latitude, longitude]);
        mapRef.current.flyTo([latitude, longitude], 16, {
          duration: 1,
        });
      }
    }
  }, [latitude, longitude]);

  return (
    <div className="relative">
      <div
        ref={mapContainerRef}
        className="w-full h-[300px]"
        style={{ zIndex: 1 }}
      />
      {/* Instruction overlay */}
      <div className="absolute top-3 left-3 z-[1000] bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[#003178] text-sm">
          pan_tool
        </span>
        <span className="text-xs text-gray-600 font-medium">
          Drag the pin to adjust location
        </span>
      </div>
    </div>
  );
}
