"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  MapPinIcon,
  NavigationIcon,
  PhoneCallIcon,
  Loader2Icon,
  TruckIcon,
} from "lucide-react";

export default function ActiveRoutePage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_AUTH_URL || "";

  const apiFetch = useCallback(async (path: string, opts?: RequestInit) => {
    const res = await fetch(`${apiBase}${path}`, {
      ...opts,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...opts?.headers },
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  }, [apiBase]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiFetch("/api/my-deliveries");
        setGroups(data.groups || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [apiFetch]);

  // Periodic GPS ping every 60 seconds
  useEffect(() => {
    const activeGroup = groups.find(g => g.status === "out_for_delivery");
    if (!activeGroup) {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      return;
    }

    const sendPing = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            await apiFetch("/api/deliveries/ping-location", {
              method: "POST",
              body: JSON.stringify({
                groupId: activeGroup.id,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                speed: pos.coords.speed ?? undefined,
              }),
            });
          } catch (err) {
            console.error("Ping failed:", err);
          }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 },
      );
    };

    // Send immediately, then every 60s
    sendPing();
    pingIntervalRef.current = setInterval(sendPing, 60000);
    return () => { if (pingIntervalRef.current) clearInterval(pingIntervalRef.current); };
  }, [groups, apiFetch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2Icon className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  const activeGroup = groups.find(g => g.status === "out_for_delivery");

  if (!activeGroup) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <NavigationIcon className="w-10 h-10 text-gray-300" />
        </div>
        <h2 className="text-lg font-semibold text-gray-700 mb-1">No Active Route</h2>
        <p className="text-sm text-gray-500">Start a delivery trip from My Tasks to see your route.</p>
      </div>
    );
  }

  const pendingInvoices = activeGroup.invoices.filter((inv: any) => inv.status === "pending");
  const deliveredInvoices = activeGroup.invoices.filter((inv: any) => inv.status === "delivered");
  const failedInvoices = activeGroup.invoices.filter((inv: any) => inv.status === "failed");

  return (
    <div className="p-3 space-y-4">
      {/* Status header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-4 text-white">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 bg-green-300 rounded-full animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider">Live Route</span>
        </div>
        <h2 className="text-lg font-bold">{activeGroup.groupName}</h2>
        <p className="text-sm opacity-90 mt-1">
          {pendingInvoices.length} stops remaining • {deliveredInvoices.length} delivered • {failedInvoices.length} failed
        </p>
        <div className="mt-3 bg-white/20 rounded-lg h-2">
          <div
            className="bg-white rounded-lg h-2 transition-all"
            style={{ width: `${((deliveredInvoices.length + failedInvoices.length) / activeGroup.invoices.length) * 100}%` }}
          />
        </div>
      </div>

      {/* GPS sharing indicator */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
          <MapPinIcon className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <p className="text-xs font-semibold text-blue-800">GPS Tracking Active</p>
          <p className="text-[10px] text-blue-600">Location shared every 60 seconds</p>
        </div>
      </div>

      {/* Stop list */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700 px-1">Delivery Stops</h3>
        {activeGroup.invoices.map((inv: any, idx: number) => {
          const address = inv.invoice.order?.shippingAddress || "";
          const phone = inv.invoice.customer?.phoneNumber || inv.invoice.order?.shippingPhone;
          const statusColors = {
            pending: "border-l-amber-400 bg-white",
            delivered: "border-l-emerald-400 bg-emerald-50/50",
            failed: "border-l-red-400 bg-red-50/50",
          }[inv.status as string] || "bg-white";

          return (
            <div key={inv.id} className={`rounded-xl border-l-4 shadow-sm border p-3 ${statusColors}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      inv.status === "pending" ? "bg-amber-100 text-amber-700" :
                      inv.status === "delivered" ? "bg-emerald-100 text-emerald-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      #{idx + 1}
                    </span>
                    <p className="text-sm font-semibold text-gray-900">
                      {inv.invoice.customer?.shopName || inv.invoice.customer?.name || `Invoice #${inv.invoice.invoiceNumber}`}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 ml-6">{address}</p>
                  <p className="text-xs font-medium text-gray-700 ml-6 mt-1">৳{parseFloat(inv.invoice.grandTotal).toFixed(0)}</p>
                </div>
                <div className="flex gap-1.5">
                  {phone && (
                    <a
                      href={`tel:${phone}`}
                      className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center"
                    >
                      <PhoneCallIcon className="w-4 h-4 text-blue-600" />
                    </a>
                  )}
                  {address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center"
                    >
                      <NavigationIcon className="w-4 h-4 text-emerald-600" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
