"use client";

import { ArrowRight, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";
import { Button } from "@/components/ui/button";
import { ToLetAccountLink } from "./to-let-account-link";

export function ToLetCommunityReviews({ all = false, page = 1 }: { all?: boolean; page?: number }) {
  const client = useQueryClient();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const isConsumer = session?.user.role === "consumer";
  const reviews = useQuery(orpc.toLetRental.listPublicReviews.queryOptions({ input: { page, limit: all ? 12 : 3 } }));
  const eligible = useQuery({ ...orpc.toLetRental.eligibleReviewRentals.queryOptions(), enabled: isConsumer && reviews.data?.enabled === true });
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
  const totalPages = Math.max(1, Math.ceil((reviews.data?.total ?? 0) / 12));

  return (
    <section id="community-reviews" aria-labelledby="community-reviews-heading" className="border-y border-border bg-background py-10 sm:py-16">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
          <h2 id="community-reviews-heading" className="text-2xl font-semibold leading-relaxed">ব্যবহারকারীদের মতামত ও অভিজ্ঞতা</h2>
          {!all && <Link href="/to-let/reviews" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">সব মন্তব্য দেখুন <ArrowRight className="size-4" /></Link>}
        </div>
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0" aria-live="polite">
            {reviews.isPending ? <div className="space-y-4" role="status" aria-label="Loading reviews">{[1,2,3].map(n => <div key={n} className="h-28 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />)}</div>
            : reviews.isError ? <div role="alert"><p>মতামত লোড করা যায়নি।</p><Button variant="outline" className="mt-3" onClick={() => reviews.refetch()}>আবার চেষ্টা করুন</Button></div>
            : !reviews.data.reviews.length ? <p className="py-8 text-muted-foreground">{reviews.data.enabled === false ? "Public reviews চালু হলে এখানে ভাড়াটিয়াদের প্রকাশিত মতামত দেখা যাবে।" : page > 1 ? "এই পেজে কোনো মতামত নেই।" : "এখনো কোনো public review নেই। আপনার অভিজ্ঞতা জানান।"}</p>
            : <div className="divide-y divide-border">{reviews.data.reviews.map(review => <figure key={review.id} className="py-6 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">Verified tenant</span>
                  {review.rating && <span role="img" aria-label={review.rating + " out of 5 stars"} className="flex gap-1 text-amber-600">{[1,2,3,4,5].map(n => <Star key={n} aria-hidden="true" className={"size-4 " + (n <= review.rating! ? "fill-current" : "")} />)}</span>}
                </div>
                <blockquote className="mt-3 whitespace-pre-wrap break-words text-base leading-8 [overflow-wrap:anywhere]">{review.body}</blockquote>
                <figcaption className="mt-4 flex flex-wrap justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words font-semibold">{review.authorName}</span>
                  <time dateTime={new Date(review.createdAt).toISOString()} className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("bn-BD", { dateStyle: "medium", timeZone: "Asia/Dhaka" }).format(new Date(review.createdAt))}</time>
                </figcaption>
              </figure>)}</div>}
            {all && <nav aria-label="Review pages" className="mt-6 flex items-center justify-between gap-3">
              {page > 1 ? <Link className="inline-flex min-h-11 items-center text-primary" href={"/to-let/reviews?page=" + (page - 1)}>Previous</Link> : <span />}
              <span className="text-sm">Page {page} / {totalPages}</span>
              {page < totalPages && <Link className="inline-flex min-h-11 items-center text-primary" href={"/to-let/reviews?page=" + (page + 1)}>Next</Link>}
            </nav>}
          </div>
          <form className="min-w-0 rounded-xl border border-border p-5 sm:p-7" onSubmit={event => {
            event.preventDefault(); setSaved(false);
            if (consent && selectedBooking && rating) submit.mutate({ bookingCode: selectedBooking, body: body.trim(), rating, isPublic: true });
          }}>
            <h3 className="text-xl font-semibold">{reviews.data?.enabled === false ? "মতামত প্রকাশ" : "মন্তব্য লিখুন"}</h3>
            {reviews.data?.enabled === false ? <p className="mt-4 text-sm leading-6">Public reviews এখনো চালু হয়নি। আপনার rental-এর private comments আগের মতোই ব্যবহার করতে পারবেন।</p>
            : !hydrated || sessionPending ? <p role="status" className="mt-4">Account লোড হচ্ছে…</p>
            : !session?.user ? <ToLetAccountLink href="/to-let#community-reviews" className="mt-4 inline-flex min-h-11 items-center text-primary">মতামত লিখতে লগইন করুন</ToLetAccountLink>
            : !isConsumer ? <p className="mt-4 text-sm">মতামত প্রকাশের জন্য consumer account প্রয়োজন।</p>
            : eligible.isPending ? <p role="status" className="mt-4">আপনার rental লোড হচ্ছে…</p>
            : eligible.isError ? <div role="alert" className="mt-4"><p>Rental লোড করা যায়নি।</p><Button type="button" variant="outline" onClick={() => eligible.refetch()}>আবার চেষ্টা করুন</Button></div>
            : !rentals.length ? <p className="mt-4 text-sm leading-6">মতামত প্রকাশ করতে একটি বর্তমান rental contract প্রয়োজন। <Link href="/account/to-let" className="text-primary underline">My Bookings দেখুন</Link></p>
            : <>
              <label className="mt-5 block text-sm font-medium">আপনার rental<select value={selectedBooking} onChange={e => setBookingCode(e.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base">{rentals.map(r => <option key={r.bookingCode} value={r.bookingCode}>{r.title}</option>)}</select></label>
              <label className="mt-4 block text-sm font-medium">আপনার অভিজ্ঞতা<textarea required minLength={3} maxLength={2000} value={body} onChange={e => {setBody(e.target.value);setSaved(false);}} rows={4} className="mt-2 w-full rounded-md border border-input bg-background p-3 text-base" /></label>
              <fieldset className="mt-4"><legend className="text-sm font-medium">রেটিং</legend><div className="flex flex-wrap">{[1,2,3,4,5].map(n => <button type="button" key={n} aria-label={n + " stars"} aria-pressed={rating === n} onClick={() => setRating(n)} className="flex size-11 items-center justify-center rounded-md text-amber-600 focus-visible:outline-2"><Star className={"size-6 " + (n <= rating ? "fill-current" : "")} /></button>)}</div></fieldset>
              <label className="mt-4 flex min-h-11 items-start gap-3 text-sm leading-6"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 size-4 shrink-0" />আমার নাম, রেটিং ও এই মতামত সবার জন্য প্রকাশ করতে সম্মতি দিচ্ছি। ব্যক্তিগত ফোন, ঠিকানা বা payment তথ্য লিখব না।</label>
              {submit.isError && <p role="alert" className="mt-3 text-sm text-destructive">{submit.error.message}</p>}
              <Button type="submit" className="mt-5 min-h-11 w-full" disabled={submit.isPending || !consent || !rating || body.trim().length < 3}>{submit.isPending ? "প্রকাশ হচ্ছে…" : "মন্তব্য প্রকাশ করুন"}</Button>
            </>}
            {saved && <p role="status" className="mt-4 text-sm text-primary">আপনার মতামত প্রকাশিত হয়েছে।</p>}
          </form>
        </div>
      </div>
    </section>
  );
}
