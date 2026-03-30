"use client";

import { useState } from "react";
import {
  Calendar,
  Layers,
  Award,
  Gift,
  ChevronRight,
  X,
  Tag,
  Clock,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface DealDetail {
  description: string;
  validUntil: string;
  terms: string[];
  discountAmount: string;
}

interface DealCard {
  id: number;
  title: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  iconBg: string;
  detail: DealDetail;
}

const defaultDeals: DealCard[] = [
  {
    id: 1,
    title: "Weekly Deals",
    icon: <Calendar className="w-6 h-6" />,
    color: "text-blue-600 bg-blue-50",
    borderColor: "border-blue-100 hover:border-blue-300",
    iconBg: "from-blue-500 to-blue-700",
    detail: {
      description:
        "Get exclusive weekly deals on top-selling wholesale products. Prices refresh every Monday with new selections across categories.",
      validUntil: "Every Monday - Sunday",
      discountAmount: "Up to 15% Off",
      terms: [
        "Minimum order of 5 cartons required",
        "Cannot be combined with other offers",
        "Deals refresh every Monday at 12:00 AM",
        "Subject to stock availability",
      ],
    },
  },
  {
    id: 2,
    title: "Bulk Discount",
    icon: <Layers className="w-6 h-6" />,
    color: "text-emerald-600 bg-emerald-50",
    borderColor: "border-emerald-100 hover:border-emerald-300",
    iconBg: "from-emerald-500 to-emerald-700",
    detail: {
      description:
        "Order in larger quantities and save more. The more you buy, the bigger the discount. Tiered pricing available on all products.",
      validUntil: "Ongoing",
      discountAmount: "Up to 25% Off",
      terms: [
        "10+ cartons: 10% off",
        "25+ cartons: 15% off",
        "50+ cartons: 20% off",
        "100+ cartons: 25% off",
      ],
    },
  },
  {
    id: 3,
    title: "Brand Campaign",
    icon: <Award className="w-6 h-6" />,
    color: "text-purple-600 bg-purple-50",
    borderColor: "border-purple-100 hover:border-purple-300",
    iconBg: "from-purple-500 to-purple-700",
    detail: {
      description:
        "Featured brands running special promotions this month. IFAD, Teer, and Pran brands with additional cashback and rewards.",
      validUntil: "March 1 - March 31, 2026",
      discountAmount: "৳500 Cashback",
      terms: [
        "Valid on IFAD, Teer, and Pran products",
        "Minimum order ৳15,000",
        "Cashback credited within 48 hours",
        "One redemption per shop per campaign",
      ],
    },
  },
  {
    id: 4,
    title: "More Offers",
    icon: <Gift className="w-6 h-6" />,
    color: "text-orange-600 bg-orange-50",
    borderColor: "border-orange-100 hover:border-orange-300",
    iconBg: "from-orange-500 to-orange-700",
    detail: {
      description:
        "Explore additional seasonal offers, clearance sales, and new arrival bonuses. Check back frequently for updated promotions.",
      validUntil: "Various dates",
      discountAmount: "Up to 30% Off",
      terms: [
        "New arrival bonus: Extra 5% off first purchase",
        "Clearance items: Up to 30% off limited stock",
        "Free delivery on orders above ৳10,000",
        "Loyalty points on every order",
      ],
    },
  },
];

function DealDetailModal({
  deal,
  onClose,
}: {
  deal: DealCard;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`relative bg-gradient-to-r ${deal.iconBg} p-6 rounded-t-2xl text-white`}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              {deal.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold">{deal.title}</h2>
              <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-medium">
                <Tag className="w-3 h-3" />
                {deal.detail.discountAmount}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            {deal.detail.description}
          </p>

          {/* Valid period */}
          <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
            <Clock className="w-4 h-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Valid Period</p>
              <p className="text-sm font-medium text-gray-900">
                {deal.detail.validUntil}
              </p>
            </div>
          </div>

          {/* Terms */}
          <div className="mb-5">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Terms & Details
            </h4>
            <ul className="space-y-2">
              {deal.detail.terms.map((term, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-gray-600"
                >
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                  {term}
                </li>
              ))}
            </ul>
          </div>

          {/* Action */}
          <div className="flex gap-3">
            <Button className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium gap-2">
              <ShoppingCart className="w-4 h-4" />
              Shop Now
            </Button>
            <Button
              variant="outline"
              className="h-10 px-5 border-gray-200 font-medium"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface WarehouseDealsSectionProps {
  deals?: DealCard[];
}

export function WarehouseDealsSection({
  deals = defaultDeals,
}: WarehouseDealsSectionProps) {
  const [selectedDeal, setSelectedDeal] = useState<DealCard | null>(null);

  return (
    <>
      <section className="container mx-auto px-4 py-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Deals & Bulk Offers
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {deals.map((deal) => (
            <button
              type="button"
              key={deal.id}
              onClick={() => setSelectedDeal(deal)}
              className={`group flex flex-col items-center gap-3 p-5 bg-white rounded-xl border ${deal.borderColor} transition-all duration-200 hover:shadow-md cursor-pointer`}
            >
              <div
                className={`w-12 h-12 rounded-xl ${deal.color} flex items-center justify-center transition-transform group-hover:scale-110`}
              >
                {deal.icon}
              </div>
              <span className="text-sm font-medium text-gray-700 text-center">
                {deal.title}
              </span>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </button>
          ))}
        </div>
      </section>

      {selectedDeal && (
        <DealDetailModal
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
        />
      )}
    </>
  );
}
