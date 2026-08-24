"use client";

import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  MessageSquareText,
  ShieldCheck,
  Star,
} from "lucide-react";
import { useState } from "react";
import { ToLetAccountLink } from "./to-let-account-link";

const verificationSteps = [
  {
    title: "Confirmed booking",
    description: "Owner accepts a real Booking Request.",
    icon: CalendarCheck2,
  },
  {
    title: "Contract linked",
    description: "The tenant account is linked to the rental contract.",
    icon: BadgeCheck,
  },
  {
    title: "Review published",
    description: "Rating and comment are submitted from My Bookings.",
    icon: ShieldCheck,
  },
] as const;

export function ToLetCommunityReviews() {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [showBookingGate, setShowBookingGate] = useState(false);

  return (
    <section
      id="community-reviews"
      aria-labelledby="community-reviews-heading"
      className="border-y border-stone-200/80 bg-white py-14 sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-3xl">
            <h2
              id="community-reviews-heading"
              className="text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl"
            >
              ব্যবহারকারীদের মতামত ও বাস্তব অভিজ্ঞতা দেখুন
            </h2>
            <p className="mt-4 max-w-[70ch] text-sm leading-7 text-muted-foreground sm:text-base">
              শুধু confirmed rental-এর সঙ্গে যুক্ত tenant-এর rating ও comment প্রকাশ করা
              যাবে। এতে feedback যাচাইযোগ্য থাকে এবং ভুয়া review প্রতিরোধ হয়।
            </p>
          </div>
          <ToLetAccountLink
            href="/account/to-let"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            সব মন্তব্য দেখুন <ArrowRight className="size-4" />
          </ToLetAccountLink>
        </div>

        <div className="grid overflow-hidden rounded-xl border border-border bg-background lg:grid-cols-[1.08fr_0.92fr]">
          <form
            className="border-b border-border p-5 sm:p-8 lg:border-r lg:border-b-0"
            onSubmit={(event) => {
              event.preventDefault();
              setShowBookingGate(true);
            }}
          >
            <h3 className="text-2xl font-semibold tracking-[-0.03em]">
              মন্তব্য লিখুন
            </h3>

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
              rows={5}
              maxLength={1000}
              placeholder="আপনার rental experience সম্পর্কে লিখুন..."
              className="mt-2 w-full resize-y rounded-lg border border-input bg-background px-4 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <div className="mt-2 text-right text-xs tabular-nums text-muted-foreground">
              {comment.length}/1000
            </div>

            <fieldset className="mt-5">
              <legend className="text-sm font-semibold">আপনার রেটিং</legend>
              <div className="mt-2 flex items-center gap-1">
                {Array.from({ length: 5 }, (_, index) => {
                  const value = index + 1;
                  const selected = value <= rating;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-label={`${value} star${value === 1 ? "" : "s"}`}
                      aria-pressed={rating === value}
                      onClick={() => {
                        setRating(value);
                        setShowBookingGate(false);
                      }}
                      className="inline-flex size-11 items-center justify-center rounded-lg text-amber-500 transition-colors hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <Star
                        className={`size-6 ${
                          selected ? "fill-current" : "text-muted-foreground/45"
                        }`}
                      />
                    </button>
                  );
                })}
                <span className="ml-2 text-sm tabular-nums text-muted-foreground">
                  {rating > 0 ? `${rating}/5` : "Select rating"}
                </span>
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={rating === 0 || comment.trim().length < 3}
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-45"
            >
              <MessageSquareText className="size-4" /> মন্তব্য প্রকাশ করুন
            </button>

            {showBookingGate ? (
              <div
                role="status"
                className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950"
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

          <div className="bg-stone-50/70 p-5 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">
                  Verified tenant feedback
                </h3>
              </div>
              <ShieldCheck className="size-6 text-primary" />
            </div>

            <div className="mt-6 rounded-lg border border-dashed border-border bg-background p-6">
              <MessageSquareText className="size-6 text-muted-foreground" />
              <h4 className="mt-4 font-semibold">Public reviews coming here</h4>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Public consent ও moderation সম্পন্ন হওয়া verified comments এখানে দেখা
                যাবে। Sample testimonial-কে real data হিসেবে দেখানো হচ্ছে না।
              </p>
            </div>

            <ol className="mt-6 divide-y divide-border border-y border-border">
              {verificationSteps.map(({ title, description, icon: Icon }) => (
                <li key={title} className="flex gap-3 py-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold">{title}</h4>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
