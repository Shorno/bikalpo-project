"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { orpc } from "@/utils/orpc";
import { Button } from "@/components/ui/button";

export default function B2BStatusPage() {
  const router = useRouter();

  // Try seller application first
  const {
    data: sellerApp,
    isPending: sellerPending,
    isFetching: sellerFetching,
  } = useQuery({
    ...orpc.sellerApplication.getMyApplication.queryOptions(),
    retry: false,
  });

  // Also try warehouse application
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
      <section className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-gray-200 border-t-[#003178] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-400">Loading your application...</p>
        </div>
      </section>
    );
  }

  // No application found
  if (!application) {
    return (
      <section className="min-h-[80vh] flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 mb-6">
            <span className="material-symbols-outlined text-4xl text-gray-300">
              search_off
            </span>
          </div>
          <h1
            className="text-2xl font-extrabold text-gray-900 mb-3"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            No Application Found
          </h1>
          <p className="text-gray-500 mb-8 text-sm leading-relaxed">
            We couldn&apos;t find a seller or warehouse application linked to
            your phone number. Start your journey by applying now.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/b2b/register"
              className="px-6 py-3 rounded-lg text-white font-bold text-sm shadow-lg shadow-[#003178]/20 hover:scale-[1.01] transition-all"
              style={{
                background:
                  "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
              }}
            >
              Apply Now
            </Link>
            <Link
              href="/b2b"
              className="px-6 py-3 rounded-lg border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-all"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const status = application.status as "pending" | "approved" | "rejected";

  return (
    <section className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <div className="max-w-lg w-full">
        {/* ========== PENDING ========== */}
        {status === "pending" && (
          <div className="text-center">
            {/* Animated Icon */}
            <div className="relative inline-flex items-center justify-center mb-6">
              <div className="absolute w-24 h-24 bg-amber-100 rounded-full animate-ping opacity-20" />
              <div className="relative w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center border-2 border-amber-200">
                <span
                  className="material-symbols-outlined text-4xl text-amber-600"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  schedule
                </span>
              </div>
            </div>

            <h1
              className="text-2xl font-extrabold text-gray-900 mb-2"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              Application Under Review
            </h1>
            <p className="text-gray-500 text-sm mb-8 max-w-sm mx-auto">
              Our team is reviewing your application for{" "}
              <strong className="text-gray-700">{shopName}</strong>. This
              usually takes within{" "}
              <strong className="text-gray-700">24 hours</strong>.
            </p>

            {/* Timeline */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 text-left">
              <h3 className="font-bold text-sm text-gray-900 mb-4">
                Application Progress
              </h3>
              <div className="space-y-4">
                {/* Step 1 - Done */}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <span
                        className="material-symbols-outlined text-green-600 text-sm"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check
                      </span>
                    </div>
                    <div className="w-0.5 h-6 bg-green-200 mt-1" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">
                      Application Submitted
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(application.createdAt).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}
                    </p>
                  </div>
                </div>

                {/* Step 2 - In progress */}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-[#003178]/10 flex items-center justify-center">
                      <span className="w-3 h-3 bg-[#003178] rounded-full animate-pulse" />
                    </div>
                    <div className="w-0.5 h-6 bg-gray-200 mt-1" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">
                      Under Review
                    </p>
                    <p className="text-xs text-gray-400">
                      Usually within 24 hours
                    </p>
                  </div>
                </div>

                {/* Step 3 - Pending */}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <span className="material-symbols-outlined text-gray-300 text-sm">
                        storefront
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-400">
                      Account Activated
                    </p>
                    <p className="text-xs text-gray-300">
                      Start selling on Bikalpo
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Application Details */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 text-left">
              <h3 className="font-bold text-sm text-gray-900 mb-3">
                Application Details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">
                    {applicationType === "seller" ? "Shop Name" : "Warehouse"}
                  </span>
                  <span className="font-medium text-gray-900">{shopName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Owner</span>
                  <span className="font-medium text-gray-900">
                    {application.ownerName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Phone</span>
                  <span className="font-medium text-gray-900">
                    {application.phoneNumber}
                  </span>
                </div>
                {application.selectedPlan && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Plan</span>
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-[#003178]/10 text-[#003178] text-xs font-semibold capitalize">
                      {application.selectedPlan.replace(/_/g, " ")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* While You Wait */}
            <div className="bg-[#003178]/5 rounded-xl p-5 mb-6 text-left">
              <h3 className="font-bold text-sm text-[#003178] mb-3 flex items-center gap-2">
                <span
                  className="material-symbols-outlined text-lg"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  lightbulb
                </span>
                While You Wait
              </h3>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <span
                    className="material-symbols-outlined text-[#003178] text-base"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    play_circle
                  </span>
                  Watch our seller setup guide
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <span
                    className="material-symbols-outlined text-[#003178] text-base"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    menu_book
                  </span>
                  Read the seller handbook
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <span
                    className="material-symbols-outlined text-[#003178] text-base"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    support_agent
                  </span>
                  Contact support if you need help
                </li>
              </ul>
            </div>

            <Link
              href="/b2b"
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ← Back to Bikalpo B2B
            </Link>
          </div>
        )}

        {/* ========== APPROVED ========== */}
        {status === "approved" && (
          <div className="text-center">
            {/* Celebration Icon */}
            <div className="relative inline-flex items-center justify-center mb-6">
              <div className="absolute w-28 h-28 bg-green-100 rounded-full animate-ping opacity-20" />
              <div className="relative w-20 h-20 bg-green-50 rounded-full flex items-center justify-center border-2 border-green-200">
                <span
                  className="material-symbols-outlined text-4xl text-green-600"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  celebration
                </span>
              </div>
            </div>

            <h1
              className="text-2xl font-extrabold text-gray-900 mb-2"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              🎉 Congratulations!
            </h1>
            <p className="text-gray-500 text-sm mb-8 max-w-sm mx-auto">
              Your application for{" "}
              <strong className="text-gray-700">{shopName}</strong> has been
              approved! Here&apos;s what to do next.
            </p>

            {/* Next Steps */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 text-left">
              <h3 className="font-bold text-sm text-gray-900 mb-5">
                Getting Started — Next Steps
              </h3>
              <div className="space-y-5">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#003178]/10 flex items-center justify-center">
                    <span className="text-[#003178] font-extrabold text-sm">
                      1
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900 mb-1">
                      Access Your Dashboard
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Log in to the main site to access your shop dashboard
                      where you can manage everything.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#003178]/10 flex items-center justify-center">
                    <span className="text-[#003178] font-extrabold text-sm">
                      2
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900 mb-1">
                      Set Up Your Catalogue
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Add your products with photos, pricing, and descriptions.
                      Browse existing products or request new items.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#003178]/10 flex items-center justify-center">
                    <span className="text-[#003178] font-extrabold text-sm">
                      3
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900 mb-1">
                      Configure Pricing & Delivery
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Set your product prices, delivery zones, and payment
                      preferences from the dashboard settings.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                    <span
                      className="material-symbols-outlined text-green-600 text-lg"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      rocket_launch
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900 mb-1">
                      Start Selling!
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Once set up, your shop goes live and customers can start
                      placing orders.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col gap-3">
              <Button asChild size="lg" className="w-full">
                <Link
                  href={
                    applicationType === "warehouse"
                      ? `${process.env.NEXT_PUBLIC_WAREHOUSE_SUBDOMAIN_URL || "http://warehouse.bikalpo.localhost:3001"}/dashboard`
                      : `${process.env.NEXT_PUBLIC_SHOP_SUBDOMAIN_URL || "http://shop.bikalpo.localhost:3001"}/dashboard`
                  }
                  className="gap-2"
                >
                  <span
                    className="material-symbols-outlined text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    dashboard
                  </span>
                  {applicationType === "warehouse"
                    ? "Go to Warehouse Dashboard"
                    : "Go to Shop Dashboard"}
                </Link>
              </Button>
              <Link
                href="/b2b"
                className="text-xs text-gray-400 hover:text-gray-600 text-center"
              >
                ← Back to Bikalpo B2B
              </Link>
            </div>
          </div>
        )}

        {/* ========== REJECTED ========== */}
        {status === "rejected" && (
          <div className="text-center">
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-50 border-2 border-red-200 mb-6">
              <span
                className="material-symbols-outlined text-4xl text-red-500"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                error
              </span>
            </div>

            <h1
              className="text-2xl font-extrabold text-gray-900 mb-2"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              Application Not Approved
            </h1>
            <p className="text-gray-500 text-sm mb-8 max-w-sm mx-auto">
              Unfortunately, your application for{" "}
              <strong className="text-gray-700">{shopName}</strong> was not
              approved at this time.
            </p>

            {/* Admin Notes */}
            {application.adminNotes && (
              <div className="bg-red-50 rounded-2xl border border-red-100 p-5 mb-6 text-left">
                <h3 className="font-bold text-sm text-red-800 mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">
                    info
                  </span>
                  Reason
                </h3>
                <p className="text-sm text-red-700 leading-relaxed">
                  {application.adminNotes}
                </p>
              </div>
            )}

            {/* What can you do */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 text-left">
              <h3 className="font-bold text-sm text-gray-900 mb-3">
                What You Can Do
              </h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="material-symbols-outlined text-[#003178] text-base mt-0.5">
                    edit_document
                  </span>
                  Review the feedback above and update your documents
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="material-symbols-outlined text-[#003178] text-base mt-0.5">
                    refresh
                  </span>
                  Re-apply with corrected information
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="material-symbols-outlined text-[#003178] text-base mt-0.5">
                    support_agent
                  </span>
                  Contact support for more details
                </li>
              </ul>
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/b2b/register"
                className="px-6 py-3 rounded-lg text-white font-bold text-sm shadow-lg shadow-[#003178]/20 hover:scale-[1.01] transition-all"
                style={{
                  background:
                    "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
                }}
              >
                Re-apply
              </Link>
              <Link
                href="/b2b/contact"
                className="px-6 py-3 rounded-lg border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-all"
              >
                Contact Support
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
