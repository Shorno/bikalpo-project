"use client";

import { Bath, BedDouble, Bell, Check, Eye, MapPin, Plus, Ruler } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toLetAlertCategoryOptions, useMarkToLetAlertsRead, useToLetAlertNotifications } from "@/hooks/use-to-let-rental-api";
import { authClient } from "@/lib/auth-client";
import { ListingImageCarousel } from "@/components/features/to-let/listing-image-carousel";

function alertDate(value: string, withTime = false) {
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return "Not specified";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } as const : {}) });
}

export function ToLetAlertInbox({ onCreateAlert }: { onCreateAlert: () => void }) {
  const { data: session, isPending } = authClient.useSession();
  const [page, setPage] = useState(1);
  const isConsumer = (session?.user as { role?: string } | undefined)?.role === "consumer";
  const inbox = useToLetAlertNotifications(isConsumer, page);
  const markRead = useMarkToLetAlertsRead();
  const unread = inbox.data?.unreadCount ?? 0;
  const notifications = inbox.data?.notifications ?? [];
  const unreadIds = notifications.filter(item => !item.readAt).map(item => item.id);

  if (!isPending && !isConsumer) return null;

  return (
    <section aria-labelledby="alert-inbox-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="alert-inbox-heading" className="text-lg font-semibold">All Alerts</h2>
            {unread > 0 && <span aria-label={`${unread} unread alerts`} className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold tabular-nums text-primary-foreground">{unread}</span>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Matching rentals for your saved searches. Open View Details to explore a property.</p>
        </div>
        {unreadIds.length > 0 && <Button variant="outline" size="sm" disabled={markRead.isPending} onClick={() => markRead.mutate({ notificationIds: unreadIds })}><Check className="size-4" />Mark shown as read</Button>}
      </div>

      {isPending || inbox.isLoading ? (
        <div role="status" className="rounded-xl border border-border bg-white p-6 text-sm text-muted-foreground">Loading matching rentals…</div>
      ) : inbox.isError ? (
        <div role="alert" className="rounded-xl border border-border bg-white p-6">
          <p className="text-sm">Your alerts could not be loaded.</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => void inbox.refetch()} disabled={inbox.isFetching}>Try again</Button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-6 py-10 text-center">
          <Bell className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <h3 className="mt-3 font-semibold">No matching alerts yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Create an alert. Available listings that match your category, location and minimum size will appear here.</p>
          <Button variant="outline" className="mt-4" onClick={onCreateAlert}><Plus className="size-4" />Create Alert</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map(item => {
            const listing = item.listing;
            return (
              <article key={item.id} className="overflow-hidden rounded-xl border border-border bg-white">
                {listing ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
                      <div>
                        <p className="text-xs text-gray-500">Received on {alertDate(item.createdAt, true)}</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">{item.readAt ? "Rental match" : "New rental match"}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${listing.status === "booked" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{listing.status === "booked" ? "Booked" : "Available"}</span>
                        <Button asChild size="sm" variant="outline"><Link href={`/to-let/listings/${listing.listingCode}`} onClick={() => { if (!item.readAt) markRead.mutate({ notificationIds: [item.id] }); }} aria-label={`View details for ${listing.title}`}><Eye className="size-4" />View Details</Link></Button>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-[13rem_minmax(0,1fr)]">
                      <ListingImageCarousel imageUrls={listing.imageUrls?.length ? listing.imageUrls : listing.imageUrl ? [listing.imageUrl] : []} alt={listing.title} className="md:h-full md:min-h-64 md:aspect-auto" sizes="(max-width: 768px) 100vw, 208px" galleryHref={`/to-let/listings/${listing.listingCode}`} />
                      <div className="min-w-0 space-y-4 p-4 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 basis-40">
                            <p className="text-xs font-semibold text-emerald-700">{toLetAlertCategoryOptions.find(option => option.value === listing.unitType)?.label ?? listing.unitType}</p>
                            <h3 className="mt-1 break-words text-lg font-semibold text-gray-900">{listing.title}</h3>
                            <p className="mt-1 break-words text-sm text-gray-500">{listing.propertyName} · {listing.unitName}</p>
                          </div>
                          <div className="sm:text-right">
                            <p className="text-lg font-bold tabular-nums text-emerald-700">{listing.monthlyRent === null ? "Contact for rent" : `৳${listing.monthlyRent.toLocaleString("en-BD")}`}</p>
                            {listing.monthlyRent !== null && <p className="text-xs text-gray-500">monthly rent</p>}
                          </div>
                        </div>
                        <p className="flex items-start gap-2 text-sm text-gray-600"><MapPin className="mt-0.5 size-4 shrink-0 text-gray-400" aria-hidden="true" />{listing.location}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm tabular-nums text-gray-600">
                          <span className="inline-flex items-center gap-1.5"><BedDouble className="size-4 text-gray-400" aria-hidden="true" />{listing.bedrooms} beds</span>
                          <span className="inline-flex items-center gap-1.5"><Bath className="size-4 text-gray-400" aria-hidden="true" />{listing.bathrooms} baths</span>
                          <span className="inline-flex items-center gap-1.5"><Ruler className="size-4 text-gray-400" aria-hidden="true" />{listing.sizeSqFt.toLocaleString("en-BD")} sq ft</span>
                        </div>
                        {!!listing.facilities?.length && <p className="text-sm text-gray-600"><span className="font-medium text-gray-900">Facilities:</span> {listing.facilities.slice(0, 3).join(" · ")}{listing.facilities.length > 3 ? ` +${listing.facilities.length - 3} more` : ""}</p>}
                        <div className="rounded-lg bg-gray-50 p-3 text-sm"><span className="text-gray-500">Available from:</span> <span className="font-medium text-gray-900">{listing.availableFrom ? alertDate(listing.availableFrom) : "Not specified"}</span></div>
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
                          <p className="text-xs text-gray-500">Matches your category, location & minimum size</p>
                          {item.readAt ? <span className="inline-flex items-center gap-1 text-xs text-gray-500"><Check className="size-3.5" aria-hidden="true" />Read</span> : <Button size="sm" variant="outline" disabled={markRead.isPending} onClick={() => markRead.mutate({ notificationIds: [item.id] })}><Check className="size-3.5" />Mark as read</Button>}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3 p-5">
                    <h3 className="font-semibold">Listing no longer available</h3>
                    <p className="text-sm text-muted-foreground">This matched listing has expired or is no longer public.</p>
                    {!item.readAt && <Button size="sm" variant="outline" disabled={markRead.isPending} onClick={() => markRead.mutate({ notificationIds: [item.id] })}>Mark as read</Button>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {(inbox.data?.total ?? 0) > 12 && <nav aria-label="Alert pages" className="flex items-center justify-between gap-3">
        <Button variant="outline" disabled={page === 1 || inbox.isFetching} onClick={() => setPage(value => value - 1)}>Previous</Button>
        <span className="text-sm tabular-nums">Page {page} of {Math.ceil((inbox.data?.total ?? 0) / 12)}</span>
        <Button variant="outline" disabled={page * 12 >= (inbox.data?.total ?? 0) || inbox.isFetching} onClick={() => setPage(value => value + 1)}>Next</Button>
      </nav>}
    </section>
  );
}
