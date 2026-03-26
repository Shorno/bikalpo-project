"use client";

import { useState } from "react";

interface StepReviewProps {
  formData: {
    account: {
      phone: string;
      fullName: string;
      email: string;
    };
    business: {
      businessType: string;
      shopName: string;
      businessCategory: string;
      yearsInBusiness: string;
      monthlyRevenue: string;
    };
    location: {
      address: string;
      area: string;
      district: string;
      postCode: string;
      shopContactNumber: string;
    };
    documents: {
      nidDocumentName: string;
      tradeLicenseName: string;
      tinCertificateName: string;
    };
    plan: {
      selectedPlan: string;
    };
  };
  onEdit: (step: number) => void;
  onSubmit: () => void;
  onBack: () => void;
}

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  retail: "Retail Shop",
  restaurant: "Restaurant",
  warehouse: "Warehouse",
};

const PLAN_LABELS: Record<string, string> = {
  free_trial: "Free Trial (14 days)",
  starter: "Starter — ৳999/mo",
  growth: "Growth — ৳2,499/mo",
};

function ReviewSection({
  title,
  icon,
  step,
  onEdit,
  children,
}: {
  title: string;
  icon: string;
  step: number;
  onEdit: (step: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[#003178] text-lg"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {icon}
          </span>
          <h3 className="font-bold text-sm text-gray-900">{title}</h3>
        </div>
        <button
          onClick={() => onEdit(step)}
          className="text-xs font-semibold text-[#003178] hover:underline flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-sm">edit</span>
          Edit
        </button>
      </div>
      <div className="px-4 py-3 space-y-2">{children}</div>
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

export function StepReview({
  formData,
  onEdit,
  onSubmit,
  onBack,
}: StepReviewProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await onSubmit();
    setIsSubmitting(false);
  };

  // Count completed sections
  const sections = [
    formData.account.fullName,
    formData.business.shopName,
    formData.location.address,
    true, // documents are optional
    formData.plan.selectedPlan,
  ].filter(Boolean).length;
  const completionPct = Math.round((sections / 5) * 100);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#003178]/5 mb-4">
          <span
            className="material-symbols-outlined text-3xl text-[#003178]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            fact_check
          </span>
        </div>
        <h2
          className="text-2xl font-bold text-gray-900 mb-2"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          Review Your Application
        </h2>
        <p className="text-gray-500">
          Please review and confirm your details before submitting
        </p>

        {/* Completion Badge */}
        <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-green-50 rounded-full border border-green-100">
          <span
            className="material-symbols-outlined text-green-600 text-lg"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            verified
          </span>
          <span className="text-sm font-semibold text-green-700">
            {completionPct}% Complete
          </span>
        </div>
      </div>

      {/* Review Sections */}
      <div className="space-y-4">
        {/* Account */}
        <ReviewSection title="Account" icon="person" step={1} onEdit={onEdit}>
          <ReviewField label="Name" value={formData.account.fullName} />
          <ReviewField label="Phone" value={`+880 ${formData.account.phone}`} />
          <ReviewField label="Email" value={formData.account.email || "—"} />
        </ReviewSection>

        {/* Business */}
        <ReviewSection
          title="Business"
          icon="storefront"
          step={2}
          onEdit={onEdit}
        >
          <ReviewField
            label="Type"
            value={BUSINESS_TYPE_LABELS[formData.business.businessType] || "—"}
          />
          <ReviewField label="Name" value={formData.business.shopName} />
          <ReviewField
            label="Category"
            value={formData.business.businessCategory}
          />
          <ReviewField
            label="Experience"
            value={formData.business.yearsInBusiness || "—"}
          />
        </ReviewSection>

        {/* Location */}
        <ReviewSection
          title="Location"
          icon="location_on"
          step={3}
          onEdit={onEdit}
        >
          <ReviewField label="Address" value={formData.location.address} />
          <ReviewField label="Area" value={formData.location.area || "—"} />
          <ReviewField
            label="District"
            value={formData.location.district || "—"}
          />
          <ReviewField
            label="Post Code"
            value={formData.location.postCode || "—"}
          />
        </ReviewSection>

        {/* Documents */}
        <ReviewSection
          title="Documents"
          icon="description"
          step={4}
          onEdit={onEdit}
        >
          <ReviewField
            label="NID"
            value={formData.documents.nidDocumentName || "Not uploaded"}
          />
          <ReviewField
            label="Trade License"
            value={formData.documents.tradeLicenseName || "Not uploaded"}
          />
          <ReviewField
            label="TIN Certificate"
            value={formData.documents.tinCertificateName || "Not uploaded"}
          />
        </ReviewSection>

        {/* Plan */}
        <ReviewSection
          title="Plan"
          icon="workspace_premium"
          step={5}
          onEdit={onEdit}
        >
          <ReviewField
            label="Selected Plan"
            value={PLAN_LABELS[formData.plan.selectedPlan] || "Free Trial"}
          />
        </ReviewSection>
      </div>

      {/* Terms Agreement */}
      <label className="flex items-start gap-3 mt-6 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 w-4 h-4 rounded border-gray-300 text-[#003178] focus:ring-[#003178]"
        />
        <span className="text-sm text-gray-600">
          I agree to the{" "}
          <a href="#" className="text-[#003178] font-medium hover:underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="text-[#003178] font-medium hover:underline">
            Privacy Policy
          </a>
          . I confirm that the information provided is accurate.
        </span>
      </label>

      {/* Navigation */}
      <div className="flex gap-3 mt-8">
        <button
          onClick={onBack}
          className="px-6 py-3.5 rounded-lg border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">
            arrow_back
          </span>
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={!agreed || isSubmitting}
          className="flex-1 py-3.5 rounded-lg text-white font-bold shadow-lg shadow-[#003178]/20 hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all flex items-center justify-center gap-2"
          style={{
            background: agreed
              ? "linear-gradient(135deg, #003178 0%, #0d47a1 100%)"
              : "#94a3b8",
          }}
        >
          {isSubmitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-lg">
                send
              </span>
              Submit Application
            </>
          )}
        </button>
      </div>
    </div>
  );
}
