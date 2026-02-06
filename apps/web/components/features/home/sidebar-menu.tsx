"use client";

import {
  ChevronRight,
  ClipboardList,
  LogOut,
  MessageSquare,
  ShoppingCart,
  User,
} from "lucide-react";
import Link from "next/link";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";

export function SidebarMenu() {
  const { totalItems } = useCart();

  const menuItems = [
    {
      icon: ClipboardList,
      label: "My Orders History",
      href: "/account/orders",
    },
    { icon: User, label: "My Profile", href: "/account/security" },
    {
      icon: MessageSquare,
      label: "My Request Item",
      href: "/account/requests",
      count: 3,
    },
    {
      icon: ShoppingCart,
      label: "My Cart",
      href: "/checkout",
      count: totalItems,
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-emerald-50/50">
        <h3 className="font-semibold text-emerald-900 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Dashboard
        </h3>
      </div>
      <div className="divide-y divide-gray-50">
        {menuItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <item.icon
                size={18}
                className="text-gray-400 group-hover:text-emerald-600 transition-colors"
              />
              <span className="text-sm font-medium text-gray-700">
                {item.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {item.count !== undefined && (
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-colors",
                    "bg-emerald-100 text-emerald-700",
                  )}
                >
                  {item.count}
                </span>
              )}
              <ChevronRight size={14} className="text-gray-300" />
            </div>
          </Link>
        ))}
        <button
          type="button"
          className="w-full flex items-center gap-3 p-4 hover:bg-red-50 transition-colors text-red-600 group"
        >
          <LogOut size={18} className="text-red-400 group-hover:text-red-600" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}
