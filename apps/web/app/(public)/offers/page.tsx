import { ArrowRight, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getActiveOffers } from "@/lib/public-data";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Current Offers",
  description: "View active offers currently available on Bikalpo.",
};

export default async function OffersPage() {
  const offers = await getActiveOffers(50, 60);

  return (
    <main className="min-h-[70vh] bg-[oklch(0.985_0.004_260)] py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
            Catalog offers
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Current offers
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            Only active offers managed through the platform are listed here.
          </p>
        </div>

        {offers.length > 0 ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => {
              const image = offer.bannerImage || offer.imageUrl;
              return (
                <Link
                  key={offer.id}
                  href={`/offers/${offer.id}`}
                  className="group overflow-hidden rounded-md border border-border bg-background transition-colors hover:border-primary/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <div className="relative aspect-[16/9] border-b border-border bg-muted">
                    {image ? (
                      <Image
                        src={image}
                        alt={offer.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-[oklch(0.94_0.015_260)]">
                        <ShoppingBag className="size-9 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="line-clamp-2 font-semibold leading-6">
                        {offer.title}
                      </h2>
                      {offer.discountPercentage > 0 ? (
                        <span className="shrink-0 rounded-sm bg-primary/10 px-2 py-1 text-xs font-semibold tabular-nums text-primary">
                          {offer.discountPercentage}% off
                        </span>
                      ) : null}
                    </div>
                    {offer.description ? (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {offer.description}
                      </p>
                    ) : null}
                    <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                      View offer
                      <ArrowRight className="size-4" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 flex min-h-64 flex-col items-center justify-center border border-dashed border-border bg-background px-6 text-center">
            <ShoppingBag className="mb-4 size-8 text-muted-foreground" />
            <h2 className="text-lg font-semibold">No active offers</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              New offers will appear here when they are published.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
