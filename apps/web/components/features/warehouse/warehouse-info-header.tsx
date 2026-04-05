"use client";

import { useState } from "react";
import {
  Building2,
  MapPin,
  Truck,
  UserPlus,
  UserCheck,
  MessageCircle,
  X,
  Phone,
  Mail,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface WarehouseInfoHeaderProps {
  name: string;
  location: string;
  deliveryCoverage: string;
  image?: string;
}

function ContactModal({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>

        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            Contact {name}
          </h3>
          <p className="text-sm text-gray-500 mb-5">
            Reach out for orders, inquiries, or support
          </p>

          <div className="space-y-3">
            <a
              href="tel:+8801700000000"
              className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Call Warehouse</p>
                <p className="text-xs text-gray-500">+880 1700-000000</p>
              </div>
            </a>

            <a
              href="mailto:warehouse@bikalpo.com"
              className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Email</p>
                <p className="text-xs text-gray-500">warehouse@bikalpo.com</p>
              </div>
            </a>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
              <div className="w-10 h-10 rounded-lg bg-gray-600 flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Business Hours</p>
                <p className="text-xs text-gray-500">Sat - Thu, 9:00 AM - 6:00 PM</p>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full mt-4 h-10 border-gray-200 font-medium"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export function WarehouseInfoHeader({
  name,
  location,
  deliveryCoverage,
  image,
}: WarehouseInfoHeaderProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [showContact, setShowContact] = useState(false);

  return (
    <>
      <section className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center gap-5">
            {/* Warehouse Avatar */}
            <div className="shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg">
              <Building2 className="w-8 h-8 md:w-10 md:h-10 text-white" />
            </div>

            {/* Warehouse Details */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-1.5">
                {name}
              </h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                  {location}
                </span>
                <span className="hidden sm:block w-1 h-1 rounded-full bg-gray-300" />
                <span className="flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-gray-400 shrink-0" />
                  Delivery: {deliveryCoverage}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-2 md:mt-0">
              <Button
                variant={isFollowing ? "default" : "outline"}
                size="sm"
                onClick={() => setIsFollowing(!isFollowing)}
                className={
                  isFollowing
                    ? "gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
                    : "gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                }
              >
                {isFollowing ? (
                  <>
                    <UserCheck className="w-4 h-4" />
                    Following
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Follow Warehouse
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-gray-200 text-gray-700 hover:bg-gray-50"
                onClick={() => setShowContact(true)}
              >
                <MessageCircle className="w-4 h-4" />
                Contact
              </Button>
            </div>
          </div>
        </div>
      </section>

      {showContact && (
        <ContactModal name={name} onClose={() => setShowContact(false)} />
      )}
    </>
  );
}
