import { Clock, CreditCard, Headphones, ShieldCheck } from "lucide-react";
import { OrpcAnnouncementBanner } from "@/components/features/home/orpc-announcement-banner";
import { HomepageCategorySidebar } from "@/components/features/home/homepage-category-sidebar";
import { HomeBannerCarousel } from "@/components/features/home/home-banner-carousel";
import { OrpcBrandsCarousel } from "@/components/features/home/orpc-brands-carousel";
import { OrpcCategoriesCarousel } from "@/components/features/home/orpc-categories-carousel";
import { OrpcFeaturedProducts } from "@/components/features/home/orpc-featured-products";
import { WeekendDeals } from "@/components/features/home/weekend-deals";
import { OffersByCategory } from "@/components/features/home/offers-by-category";
import { FeatureBadge } from "@/components/shared/feature-badge";

export const revalidate = 1800;

const featureBadges = [
  {
    icon: Clock,
    title: "Fast Delivery",
    subtitle: "Free shipping over ৳1500",
  },
  {
    icon: ShieldCheck,
    title: "Authorized Products",
    subtitle: "Within 30 days for an exchange",
  },
  {
    icon: Headphones,
    title: "Customer Service Support",
    subtitle: "8am to 10pm",
  },
  {
    icon: CreditCard,
    title: "Flexible Payments",
    subtitle: "Pay with multiple credit cards",
  },
];

export default async function HomePage() {
  return (
    <>
      {/* ── Shwapno-style Hero: Category sidebar + Banner ──────── */}
      <section className="bg-white">
        <div className="container mx-auto px-4">
          <div className="flex gap-4">
            {/* Left: Category sidebar (desktop only) */}
            <div className="hidden lg:block w-60 shrink-0">
              <HomepageCategorySidebar />
            </div>

            {/* Right: Hero banner carousel */}
            <div className="flex-1 min-w-0">
              <HomeBannerCarousel />
            </div>
          </div>
        </div>
      </section>

      {/* Feature Badges */}
      <section className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {featureBadges.map((badge) => (
              <FeatureBadge
                key={badge.title}
                icon={badge.icon}
                title={badge.title}
                subtitle={badge.subtitle}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Hot Offers Section */}
      <OffersByCategory />

      {/* Categories Carousel */}
      <OrpcCategoriesCarousel />

      {/* Brands */}
      <OrpcBrandsCarousel />

      {/* Weekend Deals */}
      <WeekendDeals />

      {/* Recommended For You */}
      <OrpcFeaturedProducts
        title="Recommended For You"
        type="featured"
        limit={8}
        href="/products"
      />

      {/* Hot & Trending */}
      <OrpcFeaturedProducts
        title="Hot & Trending Right Now 🔥"
        type="best-selling"
        limit={8}
        href="/products?sort=popular"
        className="bg-gray-50"
      />

      {/* New Arrivals */}
      <OrpcFeaturedProducts
        title="New Arrivals"
        subtitle="Fresh products just added"
        type="new-arrivals"
        limit={8}
        href="/products?sort=newest"
      />
    </>
  );
}
