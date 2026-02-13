import Image from "next/image";
import Link from "next/link";
import { HeroButtons } from "@/components/features/home/hero-buttons";
import { OrpcBrandsCarousel } from "@/components/features/home/orpc-brands-carousel";
import { OrpcCategoriesCarousel } from "@/components/features/home/orpc-categories-carousel";
import { OrpcFeaturedProducts } from "@/components/features/home/orpc-featured-products";
import { VerifiedCustomersSection } from "@/components/features/home/verified-customers-section";
import { OrpcCategoryListing } from "@/components/features/products/orpc-category-listing";
import { Button } from "@/components/ui/button";
import { getVerifiedUsersForHome } from "@/lib/public-data";

export const revalidate = 1800;

export default async function HomePage() {
  const verifiedUsers = await getVerifiedUsersForHome(revalidate);

  return (
    <>
      <section className="relative h-125 flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/images/hero-cover.jpg')",
          }}
        >
          <div className="absolute inset-0 bg-black/60" />
        </div>

        <div className="relative z-10 text-center px-4 max-w-4xl">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
            Wholesale & B2B Supplies Delivered
            <br />
            to Your Business
          </h1>
          <p className="text-lg text-white/90 mb-8">
            Fast delivery, best pricing, verified B2B marketplace.
          </p>
          <HeroButtons />
        </div>
      </section>

      <OrpcBrandsCarousel />

      <OrpcCategoriesCarousel />

      <div className="container mx-auto">
        <OrpcCategoryListing />
      </div>

      <OrpcFeaturedProducts
        title="New Arrivals"
        subtitle="Check out our latest products"
        type="new-arrivals"
        limit={8}
        href="/products?sort=newest"
      />

      <OrpcFeaturedProducts
        title="Best Selling"
        subtitle="Most popular products this month"
        type="best-selling"
        limit={8}
        href="/products?sort=popular"
        className="bg-gray-50"
      />

      <VerifiedCustomersSection customers={verifiedUsers} />

      <section className="relative py-20 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1600&h=600&fit=crop')",
          }}
        >
          <div className="absolute inset-0 bg-black/70" />
        </div>

        <div className="relative z-10 container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">
            Join 10,000+ Verified B2B Buyers
          </h2>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button size="lg" asChild>
              <Link href="/signup">Register Your Business</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="bg-transparent text-white border-white hover:bg-white/10"
              asChild
            >
              <Link href="/verified-customers">
                Check Verified Customer List
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Order Faster with our Web
              </h2>
              <Link
                href="https://play.google.com/store"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Image
                  src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
                  alt="Get it on Google Play"
                  width={200}
                  height={60}
                  className="hover:opacity-80 transition-opacity"
                />
              </Link>
            </div>
            <div className="relative w-48 h-48 bg-white p-4 rounded-lg border-2 border-gray-200">
              <Image
                src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://bikalpo.com/download"
                alt="QR Code to Download App"
                fill
                className="object-contain p-2"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
