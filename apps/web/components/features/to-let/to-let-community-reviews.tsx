"use client";

import { ArrowRight, ChevronLeft, ChevronRight, MessageSquarePlus, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";
import { Button } from "@/components/ui/button";
import { ToLetAccountLink } from "./to-let-account-link";
import { toLetPrimaryButton } from "./to-let-button";

type ReviewCardData = {
  id: string;
  name: string;
  role: string;
  rating: number | null;
  body: string;
  createdAt?: string;
};

const demoReviews: ReviewCardData[] = [
  { id: "demo-1", name: "আরিফ", role: "নমুনা প্রোফাইল", rating: 5, body: "এলাকা ও বাসার ধরন বেছে একসঙ্গে কয়েকটি লিস্টিং দেখতে সুবিধা হয়েছে। ছবি আর রুমের তথ্য পাশাপাশি থাকায় তুলনা করা সহজ।" },
  { id: "demo-2", name: "নাবিলা", role: "নমুনা প্রোফাইল", rating: 4, body: "মোবাইল থেকে ফ্ল্যাটের বিস্তারিত দেখতে পেরেছি। লোকেশন আর বাসার আয়তন এক জায়গায় পাওয়াটা কাজে লেগেছে।" },
  { id: "demo-3", name: "সায়েম", role: "নমুনা প্রোফাইল", rating: 5, body: "পরিবারের জন্য বাসা খুঁজতে category filter ব্যবহার করেছি। পছন্দের লিস্টিং থেকে মালিকের সঙ্গে যোগাযোগের অপশন সহজে পাওয়া যায়।" },
];

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toUpperCase();
}

function Stars({ rating, size = "size-3.5" }: { rating: number; size?: string }) {
  return (
    <span role="img" aria-label={`${rating} out of 5 stars`} className="flex shrink-0 gap-0.5 text-amber-500">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden="true" className={`${size} ${n <= rating ? "fill-current" : "text-muted-foreground/40"}`} />
      ))}
    </span>
  );
}

function ReviewCard({ review }: { review: ReviewCardData }) {
  return (
    <figure className="flex h-full flex-col justify-between gap-5 rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/30">
      <blockquote className="line-clamp-4 whitespace-pre-wrap break-words text-sm leading-6 text-foreground [overflow-wrap:anywhere]">
        {review.body}
      </blockquote>
      <figcaption className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {initials(review.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{review.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {review.role}
            {review.createdAt ? (
              <>
                {" · "}
                <time dateTime={review.createdAt}>
                  {new Intl.DateTimeFormat("bn-BD", { dateStyle: "medium", timeZone: "Asia/Dhaka" }).format(new Date(review.createdAt))}
                </time>
              </>
            ) : null}
          </span>
        </span>
        {review.rating ? <Stars rating={review.rating} /> : null}
      </figcaption>
    </figure>
  );
}

function ReviewCarousel({ reviews }: { reviews: ReviewCardData[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const updateEdges = () => {
    const element = track.current;
    if (!element) return;
    setEdges({
      start: element.scrollLeft <= 4,
      end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 4,
    });
  };

  useEffect(() => {
    updateEdges();
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, [reviews.length]);

  const move = (direction: 1 | -1) => {
    const element = track.current;
    if (!element) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({ left: direction * element.clientWidth * 0.9, behavior: reduceMotion ? "instant" : "smooth" });
  };

  const scrollable = !(edges.start && edges.end);

  return (
    <div>
      <div
        ref={track}
        onScroll={updateEdges}
        role="region"
        aria-roledescription="carousel"
        aria-label="Customer comments"
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {reviews.map((review) => (
          <div key={review.id} className="w-[85%] shrink-0 snap-start sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-3rem)/4)]">
            <ReviewCard review={review} />
          </div>
        ))}
      </div>
      {scrollable ? (
        <div className="mt-5 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => move(-1)}
            disabled={edges.start}
            aria-label="Previous comments"
            className="flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            disabled={edges.end}
            aria-label="Next comments"
            className="flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ReviewForm({ reviewsEnabled }: { reviewsEnabled: boolean | undefined }) {
  const client = useQueryClient();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const isConsumer = session?.user.role === "consumer";
  const eligible = useQuery({ ...orpc.toLetRental.eligibleReviewRentals.queryOptions(), enabled: isConsumer && reviewsEnabled === true });
  const [bookingCode, setBookingCode] = useState("");
  const [body, setBody] = useState("");
  const [rating, setRating] = useState(0);
  const [consent, setConsent] = useState(false);
  const [saved, setSaved] = useState(false);
  const submit = useMutation({
    ...orpc.toLetRental.addComment.mutationOptions(),
    onSuccess: () => {
      setBody(""); setRating(0); setConsent(false); setSaved(true);
      client.invalidateQueries({ queryKey: orpc.toLetRental.listPublicReviews.key() });
      client.invalidateQueries({ queryKey: orpc.toLetRental.getForBooking.key() });
    },
  });
  const rentals = eligible.data?.rentals ?? [];
  const selectedBooking = bookingCode || rentals[0]?.bookingCode || "";

  return (
    <form id="write-review" className="min-w-0 scroll-mt-28 rounded-lg border border-border bg-card p-5 sm:p-7" onSubmit={event => {
      event.preventDefault(); setSaved(false);
      if (consent && selectedBooking && rating) submit.mutate({ bookingCode: selectedBooking, body: body.trim(), rating, isPublic: true });
    }}>
      <h3 className="text-lg font-semibold">{reviewsEnabled === false ? "মতামত প্রকাশ" : "মন্তব্য লিখুন"}</h3>
      {reviewsEnabled === false ? <p className="mt-3 text-sm leading-6 text-muted-foreground">Public reviews এখনো চালু হয়নি। আপনার rental-এর private comments আগের মতোই ব্যবহার করতে পারবেন।</p>
      : !hydrated || sessionPending ? <p role="status" className="mt-3 text-sm">Account লোড হচ্ছে…</p>
      : !session?.user ? <ToLetAccountLink href="/to-let#community-reviews" className="mt-3 inline-flex min-h-11 items-center text-primary">মতামত লিখতে লগইন করুন</ToLetAccountLink>
      : !isConsumer ? <p className="mt-3 text-sm">মতামত প্রকাশের জন্য consumer account প্রয়োজন।</p>
      : eligible.isPending ? <p role="status" className="mt-3 text-sm">আপনার rental লোড হচ্ছে…</p>
      : eligible.isError ? <div role="alert" className="mt-3"><p>Rental লোড করা যায়নি।</p><Button type="button" variant="outline" onClick={() => eligible.refetch()}>আবার চেষ্টা করুন</Button></div>
      : !rentals.length ? <p className="mt-3 text-sm leading-6">মতামত প্রকাশ করতে একটি বর্তমান rental contract প্রয়োজন। <Link href="/account/to-let" className="text-primary underline">My Bookings দেখুন</Link></p>
      : <>
        <label className="mt-5 block text-sm font-medium">আপনার rental<select value={selectedBooking} onChange={e => setBookingCode(e.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base">{rentals.map(r => <option key={r.bookingCode} value={r.bookingCode}>{r.title}</option>)}</select></label>
        <label className="mt-4 block text-sm font-medium">আপনার অভিজ্ঞতা<textarea required minLength={3} maxLength={2000} value={body} onChange={e => {setBody(e.target.value);setSaved(false);}} rows={4} className="mt-2 w-full rounded-md border border-input bg-background p-3 text-base" /></label>
        <fieldset className="mt-4"><legend className="text-sm font-medium">রেটিং</legend><div className="flex flex-wrap">{[1,2,3,4,5].map(n => <button type="button" key={n} aria-label={n + " stars"} aria-pressed={rating === n} onClick={() => setRating(n)} className="flex size-11 items-center justify-center rounded-md text-amber-500 focus-visible:outline-2"><Star className={"size-6 " + (n <= rating ? "fill-current" : "")} /></button>)}</div></fieldset>
        <label className="mt-4 flex min-h-11 items-start gap-3 text-sm leading-6"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 size-4 shrink-0" />আমার নাম, রেটিং ও এই মতামত সবার জন্য প্রকাশ করতে সম্মতি দিচ্ছি। ব্যক্তিগত ফোন, ঠিকানা বা payment তথ্য লিখব না।</label>
        {submit.isError && <p role="alert" className="mt-3 text-sm text-destructive">{submit.error.message}</p>}
        <Button type="submit" className="mt-5 min-h-11 w-full" disabled={submit.isPending || !consent || !rating || body.trim().length < 3}>{submit.isPending ? "প্রকাশ হচ্ছে…" : "মন্তব্য প্রকাশ করুন"}</Button>
      </>}
      {saved && <p role="status" className="mt-4 text-sm text-primary">আপনার মতামত প্রকাশিত হয়েছে।</p>}
    </form>
  );
}

export function ToLetCommunityReviews({ all = false, page = 1 }: { all?: boolean; page?: number }) {
  const reviews = useQuery(orpc.toLetRental.listPublicReviews.queryOptions({ input: { page, limit: 12 } }));
  const [formOpen, setFormOpen] = useState(all);
  const totalPages = Math.max(1, Math.ceil((reviews.data?.total ?? 0) / 12));
  const isDemo = reviews.data?.enabled === false && page === 1;
  const cards: ReviewCardData[] = isDemo
    ? demoReviews
    : (reviews.data?.reviews ?? []).map((review) => ({
        id: review.id,
        name: review.authorName,
        role: "Verified tenant",
        rating: review.rating,
        body: review.body,
        createdAt: new Date(review.createdAt).toISOString(),
      }));

  const openForm = () => {
    setFormOpen(true);
    requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById("write-review")?.scrollIntoView({ block: "center", behavior: reduceMotion ? "instant" : "smooth" });
    });
  };

  let content: ReactNode;
  if (reviews.isPending) {
    content = <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Loading reviews">{[1, 2, 3, 4].map(n => <div key={n} className={`h-40 animate-pulse rounded-lg bg-muted motion-reduce:animate-none ${n > 1 ? "hidden sm:block" : ""} ${n > 2 ? "sm:hidden lg:block" : ""}`} />)}</div>;
  } else if (reviews.isError) {
    content = <div role="alert" className="rounded-lg border border-border bg-card p-6"><p>মতামত লোড করা যায়নি।</p><Button variant="outline" className="mt-3" onClick={() => reviews.refetch()}>আবার চেষ্টা করুন</Button></div>;
  } else if (!cards.length) {
    content = <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{page > 1 ? "এই পেজে কোনো মতামত নেই।" : "এখনো কোনো public review নেই। আপনার অভিজ্ঞতা জানান।"}</p>;
  } else if (all) {
    content = <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(review => <ReviewCard key={review.id} review={review} />)}</div>;
  } else {
    content = <ReviewCarousel reviews={cards} />;
  }

  return (
    <section id="community-reviews" aria-labelledby="community-reviews-heading" className="border-y border-border bg-muted/30 py-10 sm:py-16">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h2 id="community-reviews-heading" className="text-2xl font-bold leading-snug tracking-tight text-balance text-foreground sm:text-3xl">ব্যবহারকারীদের মতামত ও অভিজ্ঞতা</h2>
            {isDemo ? <p className="mt-1.5 text-sm text-muted-foreground">Demo / নমুনা — নিচের নাম, রেটিং ও মন্তব্য শুধু design preview; বাস্তব গ্রাহকের review নয়।</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {!all && <Link href="/to-let/reviews" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-primary hover:underline">সব মন্তব্য দেখুন <ArrowRight className="size-4" aria-hidden="true" /></Link>}
            {!all && <button type="button" onClick={openForm} aria-expanded={formOpen} aria-controls="write-review" className={toLetPrimaryButton}><MessageSquarePlus className="size-4" aria-hidden="true" /> মন্তব্য করুন</button>}
          </div>
        </div>

        <div aria-live="polite">{content}</div>

        {all && <nav aria-label="Review pages" className="mt-6 flex items-center justify-between gap-3">
          {page > 1 ? <Link className="inline-flex min-h-11 items-center text-primary" href={"/to-let/reviews?page=" + (page - 1)}>Previous</Link> : <span />}
          <span className="text-sm">Page {page} / {totalPages}</span>
          {page < totalPages ? <Link className="inline-flex min-h-11 items-center text-primary" href={"/to-let/reviews?page=" + (page + 1)}>Next</Link> : <span />}
        </nav>}

        {formOpen ? <div className="mx-auto mt-8 max-w-xl"><ReviewForm reviewsEnabled={reviews.data?.enabled} /></div> : null}
      </div>
    </section>
  );
}
