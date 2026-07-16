import {
  ArrowRight,
  Building2,
  ChevronRight,
  LayoutGrid,
  Package,
  ShoppingBag,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ConsumerProductCard } from "@/components/features/products/consumer-product-card";
import { Button } from "@/components/ui/button";
import {
  getActiveBrands,
  getActiveOffers,
  getCategoriesWithProducts,
  getReferenceProductsWithQuery,
} from "@/lib/public-data";

export const revalidate = 60;

export const metadata: Metadata = {
  title: { absolute: "Bikalpo | Shop Everyday Products" },
  description:
    "Browse recently added products, active categories, brands, and offers on Bikalpo.",
};

type HomeCategory = Awaited<
  ReturnType<typeof getCategoriesWithProducts>
>[number];
type HomeBrand = Awaited<ReturnType<typeof getActiveBrands>>[number];
type HomeOffer = Awaited<ReturnType<typeof getActiveOffers>>[number];

export default async function HomePage() {
  const [categoryRows, productResult, brands, offers] = await Promise.all([
    getCategoriesWithProducts(1, 60),
    getReferenceProductsWithQuery(
      { page: "1", limit: "12", sort: "newest" },
      60,
    ),
    getActiveBrands(60),
    getActiveOffers(4, 60),
  ]);

  const products = Array.from(
    new Map(
      productResult.products.map((product) => [product.id, product]),
    ).values(),
  );

  return (
    <div className="min-h-screen bg-[oklch(0.985_0.004_260)] text-foreground">
      <ConsumerHero categories={categoryRows} />

      <main>
        {offers.length > 0 ? <ActiveOffers offers={offers} /> : null}

        <section className="border-b border-border/70 bg-background py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              title="Recently added"
              description="Explore the newest products available in the customer catalog."
              href="/products"
              linkLabel="View all products"
            />

            {products.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
                {products.map((product) => (
                  <ConsumerProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/25 px-6 text-center">
                <Package className="mb-4 size-9 text-muted-foreground/70" />
                <h2 className="text-lg font-semibold">Catalog coming soon</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  There are no public products available right now. Please check
                  again after new products are published.
                </p>
              </div>
            )}
          </div>
        </section>

        {brands.length > 0 ? <BrandDirectory brands={brands} /> : null}
      </main>
    </div>
  );
}

function ConsumerHero({ categories }: { categories: HomeCategory[] }) {
  return (
    <section className="border-b border-border/70 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <div
          className={
            categories.length > 0
              ? "grid gap-4 lg:grid-cols-[15.5rem_minmax(0,1fr)]"
              : "grid"
          }
        >
          {categories.length > 0 ? (
            <aside className="hidden min-h-[390px] overflow-hidden rounded-xl border border-border bg-background lg:flex lg:flex-col">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
                <LayoutGrid className="size-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">
                  Shop by category
                </h2>
              </div>
              <nav
                aria-label="Product categories"
                className="min-h-0 flex-1 overflow-y-auto"
              >
                <ul className="divide-y divide-border/70">
                  {categories.map((category) => (
                    <li key={category.id}>
                      <Link
                        href={`/products?category=${category.slug}`}
                        className="group flex min-h-14 items-center gap-3 px-3 py-2.5 transition-colors duration-200 ease-out hover:bg-primary/[0.045] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
                      >
                        <CategoryImage category={category} size="small" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                          {category.name}
                        </span>
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-primary" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
          ) : null}

          <div className="relative min-h-[320px] overflow-hidden rounded-xl bg-[oklch(0.28_0.025_250)] sm:min-h-[360px] lg:min-h-[390px]">
            <Image
              src="/images/hero-cover.jpg"
              alt="Shopping bag ready for everyday purchases"
              fill
              priority
              className="object-cover object-center"
              sizes="(max-width: 1024px) 100vw, 960px"
            />
            <div className="absolute inset-0 bg-[oklch(0.16_0.025_250/0.62)]" />
            <div className="relative flex min-h-[320px] max-w-2xl flex-col justify-center px-6 py-10 text-[oklch(0.985_0.004_250)] sm:min-h-[360px] sm:px-10 lg:min-h-[390px] lg:px-12">
              <p className="text-xs font-semibold tracking-[0.16em] text-blue-200 uppercase">
                Shop the live catalog
              </p>
              <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-[1.08] tracking-[-0.035em] sm:text-5xl">
                Everyday shopping, made easier.
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-6 text-slate-100/90 sm:text-base sm:leading-7">
                Browse available products, compare configured variants, and
                choose what works for you.
              </p>
              <div className="mt-7">
                <Button asChild size="lg" className="rounded-lg px-5">
                  <Link href="/products">
                    Browse products
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {categories.length > 0 ? (
          <div className="mt-6 lg:hidden">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-foreground">
                Shop by category
              </h2>
              <Link
                href="/products"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
              >
                All products
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <nav aria-label="Product categories">
              <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
                {categories.map((category) => (
                  <li key={category.id} className="w-24 shrink-0 snap-start">
                    <Link
                      href={`/products?category=${category.slug}`}
                      className="group flex flex-col items-center gap-2 rounded-lg border border-border bg-background p-2.5 text-center transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <CategoryImage category={category} size="large" />
                      <span className="line-clamp-2 text-xs font-medium leading-4 text-foreground">
                        {category.name}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CategoryImage({
  category,
  size,
}: {
  category: HomeCategory;
  size: "small" | "large";
}) {
  const sizeClasses = size === "small" ? "size-9" : "size-14";

  return (
    <div
      className={`relative ${sizeClasses} shrink-0 overflow-hidden rounded-md bg-[oklch(0.965_0.008_250)]`}
    >
      {category.image ? (
        <Image
          src={category.image}
          alt=""
          fill
          className="object-contain p-1.5"
          sizes={size === "small" ? "36px" : "56px"}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
          {category.name.charAt(0)}
        </div>
      )}
    </div>
  );
}

function ActiveOffers({ offers }: { offers: HomeOffer[] }) {
  return (
    <section className="border-b border-border/70 bg-[oklch(0.972_0.008_250)] py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Current offers"
          description="Explore offers currently available through Bikalpo."
          href="/offers"
          linkLabel="View all offers"
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {offers.map((offer) => {
            const image = offer.bannerImage || offer.imageUrl;
            return (
              <Link
                key={offer.id}
                href={`/offers/${offer.id}`}
                className="group overflow-hidden rounded-xl border border-border bg-background shadow-sm transition-[border-color,box-shadow] duration-200 ease-out hover:border-primary/35 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <div className="relative aspect-[16/9] border-b border-border bg-muted">
                  {image ? (
                    <Image
                      src={image}
                      alt={offer.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-[oklch(0.94_0.02_250)]">
                      <ShoppingBag className="size-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-5">
                      {offer.title}
                    </h3>
                    {offer.discountPercentage > 0 ? (
                      <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold tabular-nums text-primary">
                        {offer.discountPercentage}% off
                      </span>
                    ) : null}
                  </div>
                  {offer.description ? (
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {offer.description}
                    </p>
                  ) : null}
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                    View offer
                    <ArrowRight className="size-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BrandDirectory({ brands }: { brands: HomeBrand[] }) {
  return (
    <section className="bg-[oklch(0.985_0.004_260)] py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Browse brands"
          description="Find products from brands available in the catalog."
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {brands.map((brand) => (
            <Link
              key={brand.id}
              href={`/products?brand=${brand.slug}`}
              className="group flex min-h-28 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-5 text-center transition-[border-color,box-shadow] duration-200 ease-out hover:border-primary/35 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <div className="relative h-10 w-24">
                {brand.logo ? (
                  <Image
                    src={brand.logo}
                    alt=""
                    fill
                    className="object-contain"
                    sizes="96px"
                  />
                ) : (
                  <Building2 className="mx-auto size-8 text-muted-foreground" />
                )}
              </div>
              <span className="line-clamp-1 text-xs font-medium text-foreground">
                {brand.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  title,
  description,
  href,
  linkLabel,
}: {
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {href && linkLabel ? (
        <Link
          href={href}
          className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline hover:underline-offset-4 sm:inline-flex"
        >
          {linkLabel}
          <ArrowRight className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}
