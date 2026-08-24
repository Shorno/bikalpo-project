"use client";

import {
  Building2,
  CalendarDays,
  ExternalLink,
  Eye,
  Loader2,
  MapPin,
  Megaphone,
  Pause,
  Share2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useMarkToLetUnitRented,
  useMyToLetPosts,
  usePauseToLetUnitListing,
} from "@/hooks/use-to-let-property-api";
import { cn } from "@/lib/utils";
import { PropertyErrorState, PropertyPageHeader } from "./property-ui";
import type { ListingStatus, ListingVisibility, UnitStatus } from "./types";

type PostFilter = "all" | "active" | "paused" | "booked" | "contract";

interface OwnerPost {
  listingCode: string;
  propertyCode: string;
  propertyName: string;
  qrToken: string;
  location: string;
  unitCode: string;
  unitName: string;
  unitType: string;
  unitStatus: UnitStatus;
  managementStatus: ListingStatus | "booked" | "contract";
  marketplaceStatus: "available" | "booked" | null;
  marketplaceVisibleUntil: Date | string | null;
  title: string;
  description: string | null;
  monthlyRent: number;
  availableFrom: string;
  imageUrls: string[];
  visibility: ListingVisibility;
  status: ListingStatus;
  viewCount: number;
}

function postsFromResponse(data: unknown): OwnerPost[] {
  if (!data || typeof data !== "object" || !("posts" in data)) return [];
  const posts = (data as { posts?: unknown }).posts;
  return Array.isArray(posts) ? (posts as OwnerPost[]) : [];
}

function formatMoney(value: number) {
  return `৳${new Intl.NumberFormat("en-BD").format(value)}`;
}

function formatDate(value: Date | string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

const filterOptions: Array<{ value: PostFilter; label: string }> = [
  { value: "all", label: "All posts" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "booked", label: "Booked" },
  { value: "contract", label: "Contract" },
];

const statusStyles: Record<OwnerPost["managementStatus"], string> = {
  draft: "border-amber-200 bg-amber-50 text-amber-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  paused: "border-blue-200 bg-blue-50 text-blue-700",
  closed: "border-gray-200 bg-gray-100 text-gray-600",
  booked: "border-sky-200 bg-sky-50 text-sky-700",
  contract: "border-violet-200 bg-violet-50 text-violet-700",
};

function statusLabel(post: OwnerPost) {
  if (post.managementStatus === "active") return "Active";
  if (post.managementStatus === "contract") return "Contract";
  return `${post.managementStatus.charAt(0).toUpperCase()}${post.managementStatus.slice(1)}`;
}

function MyPostsLoading() {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm text-gray-500">
      <Loader2 className="mr-2 size-4 animate-spin" /> Loading My Posts
    </div>
  );
}

export function MyPostsClient() {
  const query = useMyToLetPosts();
  const pauseListing = usePauseToLetUnitListing();
  const markBooked = useMarkToLetUnitRented();
  const [filter, setFilter] = useState<PostFilter>("all");
  const posts = postsFromResponse(query.data);
  const visiblePosts = useMemo(
    () =>
      filter === "all"
        ? posts
        : posts.filter((post) => post.managementStatus === filter),
    [filter, posts],
  );

  if (query.isLoading) return <MyPostsLoading />;
  if (query.isError) {
    return (
      <PropertyErrorState
        message="We could not load your To-Let posts."
        onRetry={() => query.refetch()}
      />
    );
  }

  const sharePost = async (post: OwnerPost) => {
    const path =
      post.visibility === "public"
        ? `/to-let/listings/${post.listingCode}`
        : `/to-let/qr/${post.qrToken}`;
    const url = new URL(path, window.location.origin).toString();
    const text = `${post.title} is available for ${formatMoney(post.monthlyRent)} per month in ${post.location}.`;

    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast.success("Listing link and caption copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Could not share this Listing");
    }
  };

  return (
    <div className="space-y-5">
      <PropertyPageHeader
        title="My Posts"
        description="Manage every current Unit advertisement from one place."
        action={
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
            <Link href="/account/to-let/properties">
              <Building2 /> My Property
            </Link>
          </Button>
        }
      />

      <div
        className="flex flex-wrap gap-2 border-b border-gray-200 pb-3"
        role="group"
        aria-label="Filter To-Let posts"
      >
        {filterOptions.map((option) => {
          const count =
            option.value === "all"
              ? posts.length
              : posts.filter((post) => post.managementStatus === option.value)
                  .length;
          return (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={filter === option.value ? "default" : "outline"}
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
              className={cn(
                filter === option.value &&
                  "bg-emerald-600 text-white hover:bg-emerald-700",
              )}
            >
              {option.label} <span aria-hidden="true">({count})</span>
            </Button>
          );
        })}
      </div>

      {visiblePosts.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white px-6 py-14 text-center">
          <Megaphone className="mx-auto size-10 text-gray-300" />
          <h2 className="mt-3 font-semibold text-gray-900">
            {posts.length === 0
              ? "No To-Let posts yet"
              : "No posts in this status"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
            {posts.length === 0
              ? "Create a Unit from My Property, then create and publish its Listing."
              : "Choose another status to see your current Unit advertisements."}
          </p>
          {posts.length === 0 ? (
            <Button asChild variant="outline" className="mt-4">
              <Link href="/account/to-let/properties">Open My Property</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {visiblePosts.map((post, index) => {
            const detailsHref = `/account/to-let/properties/${post.propertyCode}/units/${post.unitCode}`;
            const manageHref = `${detailsHref}/listing`;
            const liveHref =
              post.visibility === "public"
                ? `/to-let/listings/${post.listingCode}`
                : `/to-let/qr/${post.qrToken}`;
            const canOpenLive = post.marketplaceStatus !== null;
            const canManage =
              post.managementStatus === "draft" ||
              post.managementStatus === "active" ||
              post.managementStatus === "paused" ||
              (post.managementStatus === "closed" &&
                post.unitStatus === "vacant");
            const canBookOffline =
              post.status === "active" && post.unitStatus === "vacant";

            return (
              <article
                key={post.listingCode}
                className="overflow-hidden rounded-lg border border-gray-200 bg-white"
              >
                <div className="grid md:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="relative min-h-44 bg-gray-100 md:min-h-full">
                    {post.imageUrls[0] ? (
                      <Image
                        src={post.imageUrls[0]}
                        alt={post.title}
                        fill
                        priority={index === 0}
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 220px"
                        unoptimized={post.imageUrls[0].startsWith("http")}
                      />
                    ) : (
                      <div className="flex size-full min-h-44 items-center justify-center text-gray-300">
                        <Building2 className="size-12" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={statusStyles[post.managementStatus]}
                          >
                            {statusLabel(post)}
                          </Badge>
                          <span className="font-mono text-xs text-gray-500">
                            {post.listingCode}
                          </span>
                        </div>
                        <h2 className="mt-2 text-lg font-semibold text-gray-900">
                          {post.title}
                        </h2>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                          <MapPin className="size-3.5 shrink-0" />
                          <span className="truncate">{post.location}</span>
                        </p>
                      </div>
                      <p className="text-lg font-bold text-emerald-700">
                        {formatMoney(post.monthlyRent)}
                        <span className="block text-right text-xs font-normal text-gray-500">
                          per month
                        </span>
                      </p>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
                      <span>{post.propertyName}</span>
                      <span>{post.unitName}</span>
                      <span className="flex items-center gap-1.5">
                        <Eye className="size-3.5" /> {post.viewCount} views
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" />
                        {post.managementStatus === "booked" ||
                        post.managementStatus === "contract"
                          ? `Visible until ${formatDate(post.marketplaceVisibleUntil)}`
                          : `Available ${formatDate(post.availableFrom)}`}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                      <Button asChild variant="outline" size="sm">
                        <Link href={detailsHref}>Unit Details</Link>
                      </Button>
                      {canManage ? (
                        <Button asChild size="sm">
                          <Link href={manageHref}>
                            <Megaphone />
                            {post.status === "closed"
                              ? "Re-List"
                              : "Manage Listing"}
                          </Link>
                        </Button>
                      ) : null}
                      {canOpenLive ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href={liveHref} target="_blank">
                            <ExternalLink /> View Live
                          </Link>
                        </Button>
                      ) : null}
                      {post.status === "active" &&
                      post.unitStatus === "vacant" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pauseListing.isPending}
                          onClick={() =>
                            pauseListing.mutate({
                              propertyCode: post.propertyCode,
                              unitCode: post.unitCode,
                              listingCode: post.listingCode,
                            })
                          }
                        >
                          <Pause /> Pause
                        </Button>
                      ) : null}
                      {canBookOffline ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button type="button" variant="outline" size="sm">
                              Mark as Booked
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Mark {post.unitName} as booked?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Use this only for an offline deal. The Unit
                                becomes Booked and new Booking Requests stop.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel
                                disabled={markBooked.isPending}
                              >
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                disabled={markBooked.isPending}
                                onClick={() =>
                                  markBooked.mutate({
                                    propertyCode: post.propertyCode,
                                    unitCode: post.unitCode,
                                    listingCode: post.listingCode,
                                  })
                                }
                              >
                                {markBooked.isPending
                                  ? "Updating..."
                                  : "Confirm Booking"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : null}
                      {canOpenLive ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void sharePost(post)}
                        >
                          <Share2 /> Share
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
