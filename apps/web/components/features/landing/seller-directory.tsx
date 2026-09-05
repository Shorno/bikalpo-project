"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { orpc } from "@/utils/orpc";

export function SellerLocationLinks() {
  const { data, isPending, isError, refetch } = useQuery({
    ...orpc.sellerDirectory.locations.queryOptions({ input: undefined }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  return (
    <nav aria-labelledby="footer-sellers">
      <h2
        id="footer-sellers"
        className="text-sm font-semibold text-[var(--footer-brand)]"
      >
        Bikalpo sellers
      </h2>
      {isPending ? (
        <p role="status" className="mt-4 text-sm text-[var(--footer-ink)]">
          Loading seller locations…
        </p>
      ) : isError ? (
        <div className="mt-4 text-sm text-[var(--footer-ink)]">
          <p>Seller locations are unavailable.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="min-h-11 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[var(--footer-brand)]"
          >
            Try again
          </button>
        </div>
      ) : data?.locations.length ? (
        <ul className="mt-2 max-h-64 overflow-y-auto pr-2">
          {data.locations.map((location) => (
            <li key={`${location.divisionKey}/${location.districtKey}`}>
              <Link
                href={`/sellers?${new URLSearchParams({ district: location.districtKey, division: location.divisionKey })}`}
                className="inline-flex min-h-11 lg:min-h-8 items-center gap-2 py-1 text-sm text-[var(--footer-ink)] hover:text-[var(--footer-brand)] hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--footer-brand)]"
                aria-label={`${location.district}, ${location.division}: ${location.count} sellers`}
              >
                <span>
                  {location.district}
                  {location.division !== location.district ? (
                    <span className="ml-2 text-xs text-[var(--footer-muted)]">
                      {location.division}
                    </span>
                  ) : null}
                </span>
                <span aria-hidden="true">-</span>
                <span className="shrink-0 font-semibold tabular-nums text-[var(--footer-brand)]">
                  {location.count.toLocaleString("en-BD")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-6 text-[var(--footer-ink)]">
          No registered seller locations are available yet.
        </p>
      )}
    </nav>
  );
}

export function SellerDirectory() {
  const params = useSearchParams();
  const district = params.get("district")?.trim().slice(0, 100) || "";
  const division = params.get("division")?.trim().slice(0, 100) || "";
  const requestedPage = Number(params.get("page"));
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const { data, isPending, isError, refetch } = useQuery({
    ...orpc.sellerDirectory.list.queryOptions({
      input: { district, division, page, limit: 24 },
    }),
    enabled: Boolean(district && division),
    staleTime: 60_000,
  });
  const pageHref = (nextPage: number) =>
    `/sellers?${new URLSearchParams({ district, division, page: String(nextPage) })}`;
  const locationLabel = data?.sellers[0]?.district || district;
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center text-sm text-primary hover:underline"
      >
        Back to home
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        {district ? `Sellers in ${locationLabel}` : "Bikalpo sellers"}
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
        Retailers, warehouses, manufacturers, importers, wholesalers, and
        distributors, listed by their registered business location.
      </p>
      {!district || !division ? (
        <p className="mt-8">
          Choose a location from the footer to browse sellers.
        </p>
      ) : isPending ? (
        <p role="status" className="mt-8">
          Loading sellers…
        </p>
      ) : isError ? (
        <div className="mt-8">
          <p>We couldn&apos;t load sellers for this location.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-2 min-h-11 text-primary underline"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <p className="mt-8 text-sm text-muted-foreground">
            {data?.totalCount.toLocaleString("en-BD")} sellers ·{" "}
            {data?.sellers[0]?.division || division}
          </p>
          {data?.sellers.length ? (
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {data.sellers.map((seller) => {
                const href = seller.slug
                  ? `${seller.role === "warehouse" ? "/w" : "/stores"}/${encodeURIComponent(seller.slug)}`
                  : null;
                return (
                  <li
                    key={seller.id}
                    className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <h2 className="text-lg font-semibold">
                        {seller.name || "Registered business"}
                      </h2>
                      <p className="mt-1 text-sm capitalize text-muted-foreground">
                        {seller.nature?.replaceAll("_", " ") ||
                          (seller.role === "warehouse"
                            ? "Warehouse"
                            : "Seller")}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {seller.address}
                      </p>
                    </div>
                    {href ? (
                      <Link
                        href={href}
                        className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
                      >
                        View{" "}
                        {seller.role === "warehouse" ? "warehouse" : "store"}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Storefront coming soon
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-5">
              No sellers are currently registered in this location.
            </p>
          )}
          {data && data.totalPages > 1 ? (
            <nav
              aria-label="Seller pages"
              className="mt-6 flex items-center gap-6"
            >
              {data.page > 1 ? (
                <Link
                  href={pageHref(data.page - 1)}
                  className="inline-flex min-h-11 items-center text-primary hover:underline"
                >
                  Previous
                </Link>
              ) : null}
              <span className="text-sm">
                Page {data.page} of {data.totalPages}
              </span>
              {data.page < data.totalPages ? (
                <Link
                  href={pageHref(data.page + 1)}
                  className="inline-flex min-h-11 items-center text-primary hover:underline"
                >
                  Next
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </section>
  );
}
