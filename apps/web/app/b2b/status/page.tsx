"use client";



import { useQuery } from "@tanstack/react-query";

import {

  AlertCircle,

  Check,

  Circle,

  Loader2,

  SearchX,

} from "lucide-react";

import Link from "next/link";

import { Button } from "@/components/ui/button";

import { RegistrationReviewRow } from "@/components/features/onboarding/registration-primitives";

import { orpc } from "@/utils/orpc";



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



export default function B2BStatusPage() {

  const {

    data: sellerApp,

    isPending: sellerPending,

    isFetching: sellerFetching,

  } = useQuery({

    ...orpc.sellerApplication.getMyApplication.queryOptions(),

    retry: false,

  });



  const {

    data: warehouseApp,

    isPending: warehousePending,

    isFetching: warehouseFetching,

  } = useQuery({

    ...orpc.warehouseApplication.getMyApplication.queryOptions(),

    retry: false,

  });



  const loading = sellerPending || warehousePending || sellerFetching || warehouseFetching;

  const application = sellerApp || warehouseApp;

  const applicationType = sellerApp ? "seller" : "warehouse";

  const shopName = sellerApp

    ? sellerApp.shopName

    : warehouseApp

      ? warehouseApp.warehouseName

      : "";



  if (loading) {

    return (

      <section className="flex min-h-[80vh] items-center justify-center">

        <div className="text-center">

          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />

          <p className="text-sm text-muted-foreground">Loading your application...</p>

        </div>

      </section>

    );

  }



  if (!application) {

    return (

      <section className="flex min-h-[80vh] items-center justify-center px-4 py-12">

        <div className="w-full max-w-md text-center">

          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">

            <SearchX className="h-8 w-8 text-muted-foreground" />

          </div>

          <h1 className="mb-3 text-2xl font-semibold text-foreground">

            No application found

          </h1>

          <p className="mb-8 text-sm leading-relaxed text-muted-foreground">

            We couldn&apos;t find a seller or warehouse application linked to

            your phone number. Start your journey by applying now.

          </p>

          <div className="flex flex-col justify-center gap-3 sm:flex-row">

            <Button size="lg" className="min-h-11" asChild>

              <Link href="/b2b/register">Apply now</Link>

            </Button>

            <Button size="lg" variant="outline" className="min-h-11" asChild>

              <Link href="/b2b">Back to home</Link>

            </Button>

          </div>

        </div>

      </section>

    );

  }



  const status = application.status as "pending" | "approved" | "rejected";



  return (

    <section className="flex min-h-[80vh] items-center justify-center px-4 py-12">

      <div className="w-full max-w-lg">

        {status === "pending" && (

          <div>

            <div className="mb-8 text-center">

              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">

                <Circle className="h-8 w-8 text-primary" />

              </div>

              <h1 className="mb-2 text-2xl font-semibold text-foreground">

                Application under review

              </h1>

              <p className="mx-auto max-w-sm text-sm text-muted-foreground">

                Our team is reviewing your application for{" "}

                <strong className="text-foreground">{shopName}</strong>. This

                usually takes within{" "}

                <strong className="text-foreground">24–72 hours</strong>.

              </p>

            </div>



            <div className="mb-6 rounded-lg border border-border bg-card p-6">

              <h3 className="mb-4 text-sm font-semibold text-foreground">

                Application progress

              </h3>

              <TimelineStep

                title="Application submitted"

                subtitle={new Date(application.createdAt).toLocaleDateString(

                  "en-US",

                  { month: "short", day: "numeric", year: "numeric" },

                )}

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



            <div className="mb-6 rounded-lg border border-border bg-card p-6">

              <h3 className="mb-3 text-sm font-semibold text-foreground">

                Application details

              </h3>

              <dl>

                {"applicationNumber" in application &&

                  application.applicationNumber && (

                    <RegistrationReviewRow

                      label="Application ID"

                      value={application.applicationNumber}

                    />

                  )}

                <RegistrationReviewRow

                  label={applicationType === "seller" ? "Shop name" : "Warehouse"}

                  value={shopName}

                />

                <RegistrationReviewRow label="Owner" value={application.ownerName} />

                <RegistrationReviewRow label="Phone" value={application.phoneNumber} />

                {application.selectedPlan && (

                  <RegistrationReviewRow

                    label="Plan"

                    value={application.selectedPlan.replace(/_/g, " ")}

                  />

                )}

              </dl>

            </div>



            <div className="mb-6 rounded-lg border border-border bg-muted/30 p-5">

              <h3 className="mb-3 text-sm font-semibold text-foreground">

                While you wait

              </h3>

              <ul className="space-y-2 text-sm text-muted-foreground">

                <li>Watch our seller setup guide</li>

                <li>Read the seller handbook</li>

                <li>Contact support if you need help</li>

              </ul>

            </div>



            <Link

              href="/b2b"

              className="block text-center text-xs text-muted-foreground hover:text-foreground"

            >

              ← Back to Bikalpo B2B

            </Link>

          </div>

        )}



        {status === "approved" && (

          <div>

            <div className="mb-8 text-center">

              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">

                <Check className="h-8 w-8 text-primary" />

              </div>

              <h1 className="mb-2 text-2xl font-semibold text-foreground">

                Application approved

              </h1>

              <p className="mx-auto max-w-sm text-sm text-muted-foreground">

                Your application for{" "}

                <strong className="text-foreground">{shopName}</strong> has been

                approved. Here&apos;s what to do next.

              </p>

            </div>



            <div className="mb-6 rounded-lg border border-border bg-card p-6">

              <h3 className="mb-5 text-sm font-semibold text-foreground">

                Getting started — next steps

              </h3>

              <ol className="space-y-4 text-sm">

                {[

                  {

                    title: "Access your dashboard",

                    body: "Log in to the main site to access your shop dashboard where you can manage everything.",

                  },

                  {

                    title: "Set up your catalogue",

                    body: "Add your products with photos, pricing, and descriptions. Browse existing products or request new items.",

                  },

                  {

                    title: "Configure pricing & delivery",

                    body: "Set your product prices, delivery zones, and payment preferences from the dashboard settings.",

                  },

                  {

                    title: "Start selling",

                    body: "Once set up, your shop goes live and customers can start placing orders.",

                  },

                ].map((step, index) => (

                  <li key={step.title} className="flex gap-4">

                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-xs font-semibold text-foreground">

                      {index + 1}

                    </span>

                    <div>

                      <p className="mb-1 font-medium text-foreground">{step.title}</p>

                      <p className="text-xs leading-relaxed text-muted-foreground">

                        {step.body}

                      </p>

                    </div>

                  </li>

                ))}

              </ol>

            </div>



            <Button size="lg" className="min-h-11 w-full" asChild>

              <Link

                href={

                  applicationType === "warehouse"

                    ? `${process.env.NEXT_PUBLIC_WAREHOUSE_SUBDOMAIN_URL || "http://warehouse.bikalpo.localhost:3001"}/dashboard`

                    : `${process.env.NEXT_PUBLIC_SHOP_SUBDOMAIN_URL || "http://shop.bikalpo.localhost:3001"}/dashboard`

                }

              >

                {applicationType === "warehouse"

                  ? "Go to warehouse dashboard"

                  : "Go to shop dashboard"}

              </Link>

            </Button>

            <Link

              href="/b2b"

              className="mt-4 block text-center text-xs text-muted-foreground hover:text-foreground"

            >

              ← Back to Bikalpo B2B

            </Link>

          </div>

        )}



        {status === "rejected" && (

          <div>

            <div className="mb-8 text-center">

              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10">

                <AlertCircle className="h-8 w-8 text-destructive" />

              </div>

              <h1 className="mb-2 text-2xl font-semibold text-foreground">

                Application not approved

              </h1>

              <p className="mx-auto max-w-sm text-sm text-muted-foreground">

                Unfortunately, your application for{" "}

                <strong className="text-foreground">{shopName}</strong> was not

                approved at this time.

              </p>

            </div>



            {application.adminNotes && (

              <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 p-5">

                <h3 className="mb-2 text-sm font-semibold text-destructive">

                  Reason

                </h3>

                <p className="text-sm leading-relaxed text-destructive/90">

                  {application.adminNotes}

                </p>

              </div>

            )}



            <div className="mb-6 rounded-lg border border-border bg-card p-5">

              <h3 className="mb-3 text-sm font-semibold text-foreground">

                What you can do

              </h3>

              <ul className="space-y-2 text-sm text-muted-foreground">

                <li>Review the feedback above and update your documents</li>

                <li>Re-apply with corrected information</li>

                <li>Contact support for more details</li>

              </ul>

            </div>



            <div className="flex flex-col justify-center gap-3 sm:flex-row">

              <Button size="lg" className="min-h-11 flex-1" asChild>

                <Link href="/b2b/register">Re-apply</Link>

              </Button>

              <Button size="lg" variant="outline" className="min-h-11" asChild>

                <Link href="/b2b/contact">Contact support</Link>

              </Button>

            </div>

          </div>

        )}

      </div>

    </section>

  );

}

