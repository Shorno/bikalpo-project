"use client";

import { ArrowRight, MessageSquareText, Star } from "lucide-react";
import { useState } from "react";
import { ToLetAccountLink } from "./to-let-account-link";

const sampleReviews = [
  {
    title: "সাম্প্রতিক মন্তব্য",
    comment: "Property Account তৈরি করতে মাত্র কয়েক মিনিট লেগেছে।",
    author: "মোঃ রফিকুল ইসলাম",
    date: "২ ঘণ্টা আগে",
  },
  {
    title: "ভাড়াটিয়ার অভিজ্ঞতা",
    comment: "Verified Listing হওয়ায় কোনো ঝামেলা ছাড়াই বুকিং সম্পন্ন করেছি।",
    author: "নুসরাত জাহান",
    date: "গতকাল",
  },
  {
    title: "মালিকের মতামত",
    comment: "QR Poster ব্যবহারের পরে অনেক বেশি কল পাচ্ছি।",
    author: "আব্দুল করিম",
    date: "৩ দিন আগে",
  },
] as const;

export function ToLetCommunityReviews() {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [showBookingGate, setShowBookingGate] = useState(false);

  return (
    <section
      id="community-reviews"
      aria-labelledby="community-reviews-heading"
      className="border-y border-border/70 bg-background py-14 sm:py-20"
    >
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-col justify-between gap-5 border-b border-border pb-8 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <h2
              id="community-reviews-heading"
              className="text-balance text-2xl font-semibold leading-[1.5] sm:text-3xl"
            >
              ব্যবহারকারীদের মতামত ও বাস্তব অভিজ্ঞতা দেখুন
            </h2>
          </div>
          <ToLetAccountLink
            href="/account/to-let"
            className="inline-flex min-h-11 shrink-0 items-center gap-3 self-start text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary md:self-auto"
          >
            সব মন্তব্য দেখুন <ArrowRight className="size-4" />
          </ToLetAccountLink>
        </div>

        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">সাম্প্রতিক মন্তব্য</h3>
              <span className="rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                নমুনা মন্তব্য
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              To-Let ব্যবহারকারীদের অভিজ্ঞতা ও মতামতের উদাহরণ।
            </p>
            <div className="mt-3 divide-y divide-border">
              {sampleReviews.map((review, index) => (
                <figure
                  key={review.author}
                  className="py-7 first:pt-6 last:pb-0"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-medium text-muted-foreground">
                      {review.title}
                    </span>
                    <span
                      role="img"
                      aria-label="5 out of 5 stars"
                      className="flex gap-1 text-amber-500"
                    >
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          aria-hidden="true"
                          className="size-3.5 fill-current"
                        />
                      ))}
                    </span>
                  </div>
                  <blockquote
                    className={
                      index === 0
                        ? "text-xl font-medium leading-[1.8] sm:text-2xl"
                        : "text-base font-medium leading-[1.8] sm:text-lg"
                    }
                  >
                    “{review.comment}”
                  </blockquote>
                  <figcaption className="mt-5 flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground"
                    >
                      {review.author.split(" ").at(-1)?.slice(0, 1)}
                    </span>
                    <span className="min-w-0 text-sm font-semibold">
                      {review.author}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {review.date}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
          <form
            className="rounded-xl border border-border bg-muted/30 p-5 sm:p-7"
            onSubmit={(event) => {
              event.preventDefault();
              setShowBookingGate(true);
            }}
          >
            <h3 className="text-xl font-semibold">মন্তব্য লিখুন</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              মতামত প্রকাশ করতে একটি confirmed booking প্রয়োজন।
            </p>

            <label
              htmlFor="to-let-review-comment"
              className="mt-6 block text-sm font-semibold"
            >
              আপনার মতামত বা পরামর্শ
            </label>
            <textarea
              id="to-let-review-comment"
              value={comment}
              onChange={(event) => {
                setComment(event.target.value);
                setShowBookingGate(false);
              }}
              rows={4}
              maxLength={1000}
              placeholder="আপনার rental experience সম্পর্কে লিখুন..."
              className="mt-2 min-h-36 w-full resize-y rounded-lg border border-input bg-background px-4 py-3 text-sm leading-6 caret-primary outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <div className="mt-2 text-right text-xs tabular-nums text-muted-foreground">
              {comment.length}/1000
            </div>

            <fieldset className="mt-5">
              <legend className="text-sm font-semibold">আপনার রেটিং</legend>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {Array.from({ length: 5 }, (_, index) => {
                  const value = index + 1;
                  const selected = value <= (hoverRating || rating);
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-label={`${value} star${value === 1 ? "" : "s"}`}
                      aria-pressed={rating === value}
                      onMouseEnter={() => setHoverRating(value)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => {
                        setRating(value);
                        setShowBookingGate(false);
                      }}
                      className="inline-flex size-11 items-center justify-center rounded-lg text-amber-500 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <Star
                        className={`size-6 ${
                          selected ? "fill-current" : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  );
                })}
                <span
                  aria-live="polite"
                  className="ml-2 text-xs tabular-nums text-muted-foreground"
                >
                  {rating > 0 ? `${rating}/5` : "রেটিং দিন"}
                </span>
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={rating === 0 || comment.trim().length < 3}
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              <MessageSquareText className="size-4" /> মন্তব্য প্রকাশ করুন
            </button>

            {showBookingGate ? (
              <div
                role="status"
                className="mt-5 border-t border-border pt-4 text-sm leading-6 text-foreground"
              >
                এই review প্রকাশ করতে একটি confirmed booking নির্বাচন করুন।
                <ToLetAccountLink
                  href="/account/to-let"
                  className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  My Bookings খুলুন <ArrowRight className="size-4" />
                </ToLetAccountLink>
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </section>
  );
}
