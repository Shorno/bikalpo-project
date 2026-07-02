"use client";



import { Check, Circle } from "lucide-react";

import Link from "next/link";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { RegistrationReviewRow } from "@/components/features/onboarding/registration-primitives";



function TimelineStep({

  title,

  subtitle,

  status,

  isLast,

}: {

  title: string;

  subtitle: string;

  status: "done" | "current" | "pending";

  isLast?: boolean;

}) {

  return (

    <div className="flex gap-3">

      <div className="flex flex-col items-center">

        <div

          className={`flex h-8 w-8 items-center justify-center rounded-full border ${

            status === "done"

              ? "border-primary bg-primary text-primary-foreground"

              : status === "current"

                ? "border-primary bg-muted"

                : "border-border bg-muted"

          }`}

        >

          {status === "done" ? (

            <Check className="h-4 w-4" />

          ) : status === "current" ? (

            <Circle className="h-3 w-3 fill-primary text-primary" />

          ) : (

            <Circle className="h-3 w-3 text-muted-foreground/40" />

          )}

        </div>

        {!isLast && (

          <div

            className={`mt-1 h-6 w-px ${

              status === "done" ? "bg-primary" : "bg-border"

            }`}

          />

        )}

      </div>

      <div className="pb-4">

        <p

          className={`text-sm font-medium ${

            status === "pending" ? "text-muted-foreground" : "text-foreground"

          }`}

        >

          {title}

        </p>

        <p className="text-xs text-muted-foreground">{subtitle}</p>

      </div>

    </div>

  );

}



export default function RegisterSuccessPage() {

  const [applicationNumber, setApplicationNumber] = useState<string | null>(

    null,

  );



  useEffect(() => {

    const stored = sessionStorage.getItem("b2b_application_number");

    if (stored) {

      setApplicationNumber(stored);

      sessionStorage.removeItem("b2b_application_number");

    }

  }, []);



  return (

    <section className="flex min-h-[80vh] items-center justify-center px-4 py-12">

      <div className="w-full max-w-lg">

        <div className="mb-8 text-center">

          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">

            <Check className="h-8 w-8 text-primary" />

          </div>

          <h1 className="mb-3 text-2xl font-semibold text-foreground">

            Application submitted successfully

          </h1>

          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">

            Thank you for applying to join Bikalpo. Our team will review your

            application within <strong className="text-foreground">24–72 hours</strong>.

          </p>

        </div>



        <div className="mb-6 rounded-lg border border-border bg-card p-6">

          <dl>

            {applicationNumber && (

              <RegistrationReviewRow label="Application ID" value={applicationNumber} />

            )}

            <RegistrationReviewRow label="Current status" value="Pending verification" />

            <RegistrationReviewRow label="Admin review time" value="24–72 hours" />

            <RegistrationReviewRow

              label="Next step"

              value="Seller account approval, then dashboard activation"

            />

          </dl>

        </div>



        <div className="mb-8 rounded-lg border border-border bg-card p-6">

          <h3 className="mb-4 text-sm font-semibold text-foreground">

            Application status

          </h3>

          <TimelineStep

            title="Application submitted"

            subtitle="Just now"

            status="done"

          />

          <TimelineStep

            title="Under review"

            subtitle="Usually within 24–72 hours"

            status="current"

          />

          <TimelineStep

            title="Account activated"

            subtitle="Start selling on Bikalpo"

            status="pending"

            isLast

          />

        </div>



        <div className="flex flex-col justify-center gap-3 sm:flex-row">

          <Button size="lg" className="min-h-11 flex-1" asChild>

            <Link href="/b2b/status">Check application status</Link>

          </Button>

          <Button size="lg" variant="outline" className="min-h-11" asChild>

            <Link href="/b2b">Back to home</Link>

          </Button>

        </div>



        <p className="mt-6 text-center text-xs text-muted-foreground">

          You will receive an SMS notification when your application status changes

        </p>

      </div>

    </section>

  );

}

