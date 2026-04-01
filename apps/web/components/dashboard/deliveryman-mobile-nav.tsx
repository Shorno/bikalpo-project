"use client";

import {
  ClipboardCheckIcon,
  MapPinIcon,
  PackageIcon,
  TruckIcon,
  WalletIcon,
  BarChart3Icon,
  LogOutIcon,
  MenuIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const DM = "/deliveryman/dashboard";

const navItems = [
  { title: "My Tasks", url: DM, icon: ClipboardCheckIcon },
  { title: "Active Route", url: `${DM}/active-route`, icon: MapPinIcon },
  { title: "Reconciliation", url: `${DM}/reconciliation`, icon: WalletIcon },
  { title: "Empty Packs", url: `${DM}/empty-packs`, icon: PackageIcon },
  { title: "My Performance", url: `${DM}/performance`, icon: BarChart3Icon },
];

export function DeliverymanMobileNav() {
  const pathname = usePathname();
  const { data, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(!open)} className="p-1 -ml-1">
              {open ? <XIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
            </button>
            <div className="flex items-center gap-2">
              <TruckIcon className="w-5 h-5" />
              <span className="font-bold text-lg">ডেলিভারি</span>
            </div>
          </div>
          <div className="text-sm opacity-90">
            {isPending ? "..." : data?.user?.name || "Deliveryman"}
          </div>
        </div>
      </header>

      {/* Slide-in menu */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setOpen(false)}
          />
          <nav className="fixed left-0 top-0 h-full w-72 bg-white z-50 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <TruckIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold">{data?.user?.name || "Deliveryman"}</p>
                  <p className="text-xs opacity-80">{(data?.user as any)?.phoneNumber || ""}</p>
                </div>
              </div>
            </div>
            <div className="py-3">
              {navItems.map((item) => {
                const isActive = pathname === item.url;
                return (
                  <Link
                    key={item.url}
                    href={item.url}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700 border-r-3 border-emerald-600 font-semibold"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${isActive ? "text-emerald-600" : "text-gray-400"}`} />
                    {item.title}
                  </Link>
                );
              })}
            </div>
            <div className="border-t mt-auto absolute bottom-0 w-full p-4">
              <button
                onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/login"; } } })}
                className="flex items-center gap-3 text-red-600 text-sm w-full px-2 py-2 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOutIcon className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </nav>
        </>
      )}

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-40 safe-area-pb">
        <div className="flex">
          {navItems.slice(0, 4).map((item) => {
            const isActive = pathname === item.url;
            return (
              <Link
                key={item.url}
                href={item.url}
                className={`flex-1 flex flex-col items-center gap-1 py-2 text-[10px] transition-colors ${
                  isActive ? "text-emerald-600" : "text-gray-400"
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "text-emerald-600" : "text-gray-400"}`} />
                {item.title}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
