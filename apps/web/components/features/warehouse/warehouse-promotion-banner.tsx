"use client";

import { Percent, Package, Zap, Gift } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface PromoBanner {
  id: number;
  title: string;
  subtitle: string;
  discount: string;
  gradient: string;
  icon: React.ReactNode;
}

const defaultBanners: PromoBanner[] = [
  {
    id: 1,
    title: "Wholesale Discount",
    subtitle: "Bulk Order Special Offer",
    discount: "Up to 20% Discount",
    gradient: "from-orange-500 to-red-600",
    icon: <Percent className="w-10 h-10 text-white/80" />,
  },
  {
    id: 2,
    title: "Free Delivery",
    subtitle: "On Orders Above ৳10,000",
    discount: "Save on Shipping",
    gradient: "from-emerald-500 to-teal-600",
    icon: <Package className="w-10 h-10 text-white/80" />,
  },
  {
    id: 3,
    title: "Flash Sale",
    subtitle: "Limited Time Only",
    discount: "Up to 30% Off",
    gradient: "from-purple-500 to-indigo-600",
    icon: <Zap className="w-10 h-10 text-white/80" />,
  },
  {
    id: 4,
    title: "New Arrival Bonus",
    subtitle: "First Order Exclusive",
    discount: "Extra 5% Off",
    gradient: "from-blue-500 to-cyan-600",
    icon: <Gift className="w-10 h-10 text-white/80" />,
  },
];

interface WarehousePromotionBannerProps {
  banners?: PromoBanner[];
}

export function WarehousePromotionBanner({
  banners = defaultBanners,
}: WarehousePromotionBannerProps) {
  return (
    <section className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">
          B2B Offers & Promotions
        </h2>
      </div>

      <Carousel opts={{ loop: true }} className="w-full">
        <CarouselContent className="-ml-3">
          {banners.map((banner) => (
            <CarouselItem key={banner.id} className="pl-3 md:basis-1/2">
              <div
                className={`relative overflow-hidden rounded-xl bg-gradient-to-r ${banner.gradient} p-6 md:p-8 text-white shadow-lg cursor-pointer hover:shadow-xl transition-shadow duration-300`}
              >
                {/* Decorative circles */}
                <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10" />
                <div className="absolute -right-2 -bottom-8 w-24 h-24 rounded-full bg-white/5" />

                <div className="relative z-10 flex items-center gap-4">
                  <div className="shrink-0 w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    {banner.icon}
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-bold">
                      {banner.title}
                    </h3>
                    <p className="text-sm text-white/80 mt-0.5">
                      {banner.subtitle}
                    </p>
                    <span className="inline-block mt-2 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-sm">
                      {banner.discount}
                    </span>
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-0 -translate-x-1/2" />
        <CarouselNext className="right-0 translate-x-1/2" />
      </Carousel>
    </section>
  );
}
